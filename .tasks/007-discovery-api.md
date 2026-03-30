---
id: "007"
title: "Implement GPS-based discovery API: listings by distance (PostGIS or Haversine), filters (radius, category, keyword)"
status: "completed"
area: "backend"
agent: "@backend-developer"
priority: "normal"
created_at: "2026-03-29"
due_date: null
started_at: "2026-03-30"
completed_at: "2026-03-30"
prd_refs: ["FR-030", "FR-031", "FR-032", "FR-033", "FR-034"]
blocks: ["014"]
blocked_by: ["003"]
---

## Description

Implement the listing discovery endpoint that returns active listings sorted by distance from the caller's GPS coordinates. The endpoint supports filtering by radius (km), category, and keyword search (title/description). Results should be paginated (cursor or offset-based). The implementation must use a Haversine formula in raw SQL or Prisma `$queryRaw` since PostGIS is not guaranteed on the initial RDS tier — document the upgrade path to PostGIS as a future optimisation.

## Acceptance Criteria

- [x] `GET /api/v1/discover/nearby` accepts query params: `lat`, `lng`, `radiusKm` (default 10), `categoryId` (optional UUID), `q` (keyword, optional), `page` / `limit` for pagination
- [x] Returns listings sorted by ascending distance in kilometres, each listing including a computed `distanceKm` field
- [x] Only ACTIVE listings are returned; SOLD and DELETED listings are excluded
- [x] Keyword search matches against listing `title` and `description` (case-insensitive, partial match via ILIKE)
- [x] Pagination works correctly — `total`, `page`, `limit`, and `hasMore` returned in the response envelope
- [x] Bounding-box pre-filter on `idx_listings_lat_lng` index narrows candidates before Haversine; LEAST(1.0, …) guards against acos(NaN) on floating-point edge cases
- [ ] Unit/integration tests — skipped per project convention (no tests in v1)

## Technical Notes

- Haversine formula in Prisma `$queryRaw`: `6371 * acos(cos(radians($lat)) * cos(radians(latitude)) * cos(radians(longitude) - radians($lng)) + sin(radians($lat)) * sin(radians(latitude)))` — parameterise all inputs to prevent SQL injection.
- Add a composite btree index on `(latitude, longitude)` in the schema (task #001) to narrow the candidate set with a bounding box pre-filter before applying Haversine.
- PostGIS upgrade path: if the RDS instance has PostGIS, replace with `ST_DWithin` + `ST_Distance` on a `GEOGRAPHY` column for accuracy and performance. Document this in `docs/technical/DECISIONS.md`.
- Caller's lat/lng should be treated as user-supplied input — validate range before use in raw query.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
| 2026-03-30 | @backend-developer | Discovery API implemented: Haversine raw SQL with bounding-box pre-filter, LEAST(1.0) NaN guard, offset pagination, optional category (UUID) and keyword (ILIKE) filters, categories endpoint. Routes registered at /api/v1/discover. API.md updated. |
