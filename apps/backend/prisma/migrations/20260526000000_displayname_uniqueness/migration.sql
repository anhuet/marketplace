-- Migration: 20260526000000_displayname_uniqueness
-- Purpose: Make display_name nullable; add display_name_lower (case-insensitive uniqueness mirror)
--          and needs_display_name_setup flag; backfill existing rows.
--
-- Deployment risk: LOW
--   - Table has only a small number of rows in production.
--   - ALTER TABLE ... DROP NOT NULL acquires ACCESS EXCLUSIVE lock but releases it immediately
--     (no table rewrite required; it is a metadata-only change in PostgreSQL 15).
--   - ADD COLUMN with a NOT NULL DEFAULT is also metadata-only in PostgreSQL 11+.
--   - CREATE UNIQUE INDEX ... WHERE (partial) does not lock writes on the table; it runs
--     as a normal index build. At this table size it completes in milliseconds.
--   - Both UPDATE backfills are low-volume; no batching required.
--
-- Rollback DDL (see bottom of file).

-- ============================================================
-- FORWARD MIGRATION
-- ============================================================

-- 1. Make display_name nullable.
--    Rationale: users in the Auth0-signup → ProfileSetup window have no name yet.
ALTER TABLE users ALTER COLUMN display_name DROP NOT NULL;

-- 2. Add display_name_lower: application-maintained lowercase mirror used for
--    case-insensitive uniqueness checks. Nullable because users in setup-pending
--    state have no name and must not conflict with each other.
ALTER TABLE users ADD COLUMN display_name_lower text;

-- 3. Add needs_display_name_setup flag. NOT NULL DEFAULT false so existing rows
--    are safe — the backfill step below flips the relevant rows to true.
ALTER TABLE users ADD COLUMN needs_display_name_setup boolean NOT NULL DEFAULT false;

-- 4. Backfill display_name_lower for all users who already have a display_name.
UPDATE users
SET display_name_lower = lower(display_name)
WHERE display_name IS NOT NULL;

-- 5. Flag existing users whose displayName is their email prefix (PII leak pattern).
--    These users will be prompted to choose a real display name on next login.
--    split_part(email, '@', 1) extracts the local-part of the email address.
UPDATE users
SET needs_display_name_setup = true
WHERE display_name IS NOT NULL
  AND email IS NOT NULL
  AND display_name = split_part(email, '@', 1);

-- 6. Create a PARTIAL unique index on display_name_lower.
--    The WHERE clause excludes NULL values, so users in setup-pending state
--    (display_name_lower IS NULL) do not trigger a uniqueness violation against
--    each other. Only users who have chosen a name compete for uniqueness.
--    Index name follows Prisma's generated-name convention for @unique fields.
CREATE UNIQUE INDEX users_display_name_lower_key
    ON users (display_name_lower)
    WHERE display_name_lower IS NOT NULL;

-- ============================================================
-- ROLLBACK DDL  (include in the down-migration if needed)
-- WARNING: rolling back drops display_name_lower and needs_display_name_setup
--          columns — any data written to those columns after the forward migration
--          runs will be permanently lost.
-- ============================================================

-- DROP INDEX IF EXISTS users_display_name_lower_key;
-- ALTER TABLE users DROP COLUMN IF EXISTS needs_display_name_setup;
-- ALTER TABLE users DROP COLUMN IF EXISTS display_name_lower;
-- ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;
-- NOTE: the final step (SET NOT NULL) will fail if any row has a NULL display_name
-- at rollback time. Ensure all rows have a value before attempting rollback.
