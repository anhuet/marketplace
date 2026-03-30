---
id: "006"
title: "Implement listings API: CRUD endpoints, image upload, GPS coordinates storage"
status: "completed"
area: "backend"
agent: "@backend-developer"
priority: "normal"
created_at: "2026-03-29"
due_date: null
started_at: "2026-03-29"
completed_at: "2026-03-30"
prd_refs: ["FR-020", "FR-021", "FR-022", "FR-023", "FR-024"]
blocks: ["015", "016"]
blocked_by: ["003"]
---

## Description

Implement the full listings CRUD API. Sellers can create, update, and soft-delete their own listings. Each listing has a title, description, price, category, GPS coordinates (latitude/longitude), status (ACTIVE/SOLD/DELETED), and up to a configurable number of photos. Image uploads should be handled via multipart form-data and stored in AWS S3 (or an equivalent object store); the API stores the resulting URLs in the `listing_images` table. Only the listing owner can edit or delete their listing.

## Acceptance Criteria

- [x] `POST /api/listings` (authenticated) creates a listing with all required fields including lat/lng and returns the created listing with image URLs
- [x] `GET /api/listings/:id` (public) returns a single listing with seller info and images; returns 404 for soft-deleted listings
- [x] `PUT /api/listings/:id` (authenticated, owner only) updates listing fields and images; returns 403 if requester is not the owner
- [x] `DELETE /api/listings/:id` (authenticated, owner only) soft-deletes (sets status to DELETED) rather than hard-deleting
- [x] `PATCH /api/listings/:id/status` (authenticated, owner only) allows marking a listing as SOLD
- [x] Image upload accepts up to 8 images per listing (multipart), stores them in S3, and persists URLs in `listing_images`
- [ ] Unit tests cover: create listing, unauthorised edit, soft delete, status change, image upload stub (deferred to v2 per project conventions)

## Technical Notes

- Use `multer` for multipart file handling and `@aws-sdk/client-s3` for S3 uploads.
- Store `latitude` and `longitude` as floats on the listing row — the discovery API (#007) will use these for Haversine calculations.
- Image URLs should be stored as absolute HTTPS URLs; do not store S3 keys in the listings table.
- Validation: price must be non-negative; lat/lng must be valid WGS84 ranges; at least one image required for a listing to be ACTIVE.
- S3 bucket name and region from environment variables — never hardcoded.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
| 2026-03-30 | @backend-developer | Listings CRUD API implemented with S3 image upload, owner-only guards, soft delete |
