---
id: "009"
title: "Implement ratings & reviews API: create review post-sale, fetch user ratings"
status: "completed"
area: "backend"
agent: "@backend-developer"
priority: "normal"
created_at: "2026-03-29"
due_date: null
started_at: null
completed_at: "2026-03-30"
prd_refs: ["FR-050", "FR-051", "FR-052"]
blocks: ["018"]
blocked_by: ["003"]
---

## Description

Implement the ratings and reviews system. After a sale (listing marked as SOLD), both buyer and seller can leave a review for each other. Each direction is one review per transaction — enforced by a unique constraint on (reviewer_id, reviewee_id, listing_id). The user's average rating is either computed on read or cached on the users table after each new review. Reviews include a numeric rating (1–5) and an optional text comment.

## Acceptance Criteria

- [x] `POST /api/reviews` (authenticated) creates a review with `{ listingId, revieweeId, rating, comment? }`; the listing must have status SOLD and the reviewer must be a participant (buyer or seller)
- [x] `GET /api/users/:id/reviews` (public) returns paginated reviews received by the user, each with reviewer display name, rating, and comment
- [x] `GET /api/users/:id/rating` (public) returns the user's average rating and total review count
- [x] Duplicate review attempts (same reviewer + reviewee + listing) return a 409 conflict
- [x] Reviews on non-SOLD listings are rejected with a 422 error and a clear message
- [x] `average_rating` on the users table is updated atomically after each new review (via a Prisma transaction)
- [ ] Unit tests cover: create review, duplicate review rejection, review on non-SOLD listing, fetch user reviews, average rating calculation (deferred — no tests in v1)

## Technical Notes

- Use a Prisma transaction to: (1) insert the review, (2) recalculate and update `users.average_rating` using `AVG(rating)` from the reviews table. This avoids floating-point drift compared to incremental averaging.
- Authorization check: the reviewer must be the buyer (conversation initiator) or the seller (listing owner) for the given listing — verify this from the conversations/listings tables.
- Rating must be an integer 1–5 — validate at the Zod schema level before hitting the database.
- FR-051 states "one per direction" — the unique constraint in the schema (task #001) is the authoritative enforcement; the API should handle the constraint violation gracefully and return 409.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
| 2026-03-30 | @backend-developer | Reviews API implemented with participant check, atomic rating cache update, duplicate protection |
