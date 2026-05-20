-- DropIndex: remove the unique constraint on users.invite_code_used_id
-- Multiple users may now redeem the same invite code, so the column
-- becomes a plain nullable foreign key with no uniqueness requirement.
DROP INDEX "users_invite_code_used_id_key";

-- AlterTable: drop the used_at column from invite_codes
-- The concept of a code being "used up" no longer applies — codes are
-- reusable indefinitely. Existing non-null used_at values are discarded;
-- this is safe because the column's only consumer was the redemption
-- guard that is being removed along with this migration.
ALTER TABLE "invite_codes" DROP COLUMN "used_at";
