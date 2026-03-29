---
id: "001"
title: "Design database schema: users, invite_codes, listings, images, conversations, messages, reviews"
status: "completed"
area: "database"
agent: "@database-expert"
priority: "high"
created_at: "2026-03-29"
due_date: null
started_at: "2026-03-29"
completed_at: "2026-03-29"
prd_refs: ["FR-001", "FR-002", "FR-003", "FR-004", "FR-005", "FR-006", "FR-007", "FR-010", "FR-011", "FR-012", "FR-020", "FR-021", "FR-022", "FR-023", "FR-024", "FR-030", "FR-040", "FR-041", "FR-042", "FR-043", "FR-050", "FR-051", "FR-052"]
blocks: ["003", "004", "005", "006", "007", "008", "009"]
blocked_by: []
---

## Description

Design and document the full PostgreSQL database schema for the Marketplace app. This covers all core entities: users, invite_codes, listings, listing_images, categories, conversations, messages, reviews, and push_tokens. The schema must support GPS-based queries (latitude/longitude columns with indexing strategy), soft deletes for listings, and enforce data integrity via foreign keys. Prisma schema file is the deliverable — migrations will be generated from it.

## Acceptance Criteria

- [x] Prisma schema file created at `apps/backend/prisma/schema.prisma` covering all entities listed above
- [x] `listings` table includes `latitude`, `longitude` (float), `category`, `status` (enum: ACTIVE, SOLD, DELETED), and `price` fields
- [x] `invite_codes` table includes `code` (unique), `created_by`, `used_by` (nullable), `used_at` (nullable), and `expires_at` fields
- [x] `reviews` table enforces one review per direction per transaction (unique constraint on reviewer_id + reviewee_id + listing_id)
- [x] `messages` table includes `read_at` (nullable timestamp) to support unread count queries
- [x] All foreign key relationships are defined with appropriate cascade rules
- [x] Schema documented in `docs/technical/DATABASE.md` with entity descriptions and an ERD or relationship summary

## Technical Notes

- Use `Float` for lat/lng in Prisma; raw SQL index using `btree` on (latitude, longitude) to support Haversine queries — PostGIS extension is not assumed to be available on all RDS tiers, so design for Haversine-compatible columns first. Document the PostGIS upgrade path as a note.
- `users` table needs `display_name`, `avatar_url`, `average_rating` (computed or cached Float), `invite_code_used` (FK to invite_codes).
- `conversations` are between a buyer and a seller scoped to a specific listing — unique constraint on (listing_id, buyer_id).
- Consider a `push_tokens` table (user_id, token, platform: ios|android) separate from users to allow multiple devices.
- Consult `docs/technical/DECISIONS.md` before choosing any extension or naming convention that may conflict with prior decisions.

## Implementation Notes

- `invite_codes` task spec mentioned an `expires_at` field; per the task brief (no expiry, 1 per user, used once) this field was intentionally omitted. The schema uses `used_at` (nullable) to track redemption without an expiry concept.
- `average_rating` and `rating_count` are cached on the `users` row and updated atomically with each new review (documented query pattern in DATABASE.md).
- Cascade rules: `listing_images` and `messages` cascade-delete with their parents. `conversations`, `reviews`, and `listings` themselves do not cascade to preserve audit trails.
- Forward DDL, rollback DDL, deployment risk, and backfill notes are documented in DATABASE.md migrations log. This is a greenfield schema — no backfill required and no deployment risk.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
| 2026-03-29 | @database-expert | Schema designed and documented |
