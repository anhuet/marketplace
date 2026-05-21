# Task 025: Similar Items Suggestion

> **Status**: Planning
> **Priority**: Medium
> **Depends on**: #007 (Discovery API), #015 (Listing Detail Screen)
> **Blocked by**: None

---

## Overview

Show a "Similar Items" section on listing detail screens. Items are considered similar when they share the same category, are geographically nearby, and are in a comparable price range. Also shown when a listing is sold or deleted, providing alternatives for interested buyers.

---

## Architecture Decision: Reuse Existing Haversine Logic + Simple Scoring

This feature does NOT require a recommendation engine, ML model, or separate search service. The query is a parameterised SQL query reusing the existing Haversine bounding-box pattern from the discovery endpoint. The similarity criteria are deterministic and rule-based.

### Why not use full-text search or Elasticsearch?

The similar items query is bounded (same category, nearby, similar price) and returns a small set (4-6 items). It does not need relevance scoring across free-text fields. PostgreSQL handles this efficiently with the existing indexes. Adding a search service would be premature complexity for this use case.

---

## 1. Database Schema Changes

**None required.** The existing `listings`, `listing_images`, `categories`, and `users` tables have all columns needed. Existing indexes (`idx_listings_lat_lng`, `idx_listings_status`, `idx_listings_category_id`) support the query.

---

## 2. API Endpoint

### GET /api/v1/listings/:id/similar

**Auth required**: No
**Description**: Returns up to 6 active listings similar to the given listing based on category, proximity, and price range. Excludes the listing itself and listings by the same seller.

**Path parameters**:
- `id` -- listing UUID (the reference listing)

**Query parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | No | `6` | Number of results (1-12) |
| `radiusKm` | number | No | `25` | Search radius in km (1-100) |
| `priceRange` | number | No | `0.3` | Price tolerance as fraction (0.3 = +/-30%) |

**Response 200**:
```json
{
  "listings": [
    {
      "id": "uuid",
      "title": "string",
      "price": "49.99",
      "condition": "GOOD",
      "status": "ACTIVE",
      "latitude": 53.349,
      "longitude": -6.260,
      "distanceKm": 2.4,
      "createdAt": "ISO 8601",
      "coverImageUrl": "string | null",
      "sellerDisplayName": "string",
      "sellerAverageRating": 4.5,
      "categoryName": "Electronics",
      "categorySlug": "electronics"
    }
  ]
}
```

**Error codes**:
- `404` -- Reference listing not found (or DELETED)

---

## 3. Query Strategy

### SQL Implementation

```sql
-- Parameters: $1=listing.latitude, $2=listing.longitude, $3=radiusKm,
--             $4=listing.categoryId, $5=listing.id, $6=listing.sellerId,
--             $7=minPrice, $8=maxPrice, $9=limit

SELECT
  l.id, l.title, l.price, l.condition, l.status,
  l.latitude, l.longitude, l.created_at,
  (
    6371 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians($1)) * cos(radians(l.latitude))
        * cos(radians(l.longitude) - radians($2))
        + sin(radians($1)) * sin(radians(l.latitude))
      ))
    )
  ) AS distance_km,
  li.url AS cover_image_url,
  u.display_name AS seller_display_name,
  u.average_rating AS seller_average_rating,
  c.name AS category_name,
  c.slug AS category_slug
FROM listings l
LEFT JOIN listing_images li ON li.listing_id = l.id AND li."order" = 0
JOIN users u ON u.id = l.seller_id
JOIN categories c ON c.id = l.category_id
WHERE
  l.status = 'ACTIVE'
  AND l.id != $5
  AND l.seller_id != $6
  AND l.category_id = $4
  AND l.price BETWEEN $7 AND $8
  -- Bounding box pre-filter
  AND l.latitude BETWEEN ($1 - $3 / 111.0) AND ($1 + $3 / 111.0)
  AND l.longitude BETWEEN ($2 - $3 / (111.0 * cos(radians($1)))) AND ($2 + $3 / (111.0 * cos(radians($1))))
HAVING distance_km <= $3
ORDER BY distance_km ASC
LIMIT $9;
```

### Scoring/Ordering Rationale

Primary sort is **distance** (closest first). This was chosen over a composite score because:
- Users on a marketplace prioritize items they can physically access
- Price and category are already filtered (not ranked), so distance is the remaining differentiator
- A composite relevance score adds complexity without clear UX benefit for 4-6 items

### Price Range Calculation

```
minPrice = listing.price * (1 - priceRange)  // default: listing.price * 0.7
maxPrice = listing.price * (1 + priceRange)  // default: listing.price * 1.3
```

For listings priced at 0 (free items): `minPrice = 0`, `maxPrice = 20` (hardcoded cap for free item similarity).

### Fallback Strategy

If the query returns fewer than 2 results (too few for a useful section):
1. **First fallback**: Expand price range to +/-60%
2. **Second fallback**: Remove price filter entirely (same category + nearby only)
3. **Third fallback**: Remove category filter (nearby only, different price range)
4. If still < 2 results, return whatever was found (even empty). The mobile client hides the section if 0 results.

This is implemented as sequential queries in the service layer (not a single complex query) to keep the SQL simple and debuggable.

---

## 4. Caching Strategy

### Application-Level Cache (In-Memory TTL)

- Cache key: `similar:{listingId}:{limit}:{radiusKm}:{priceRange}`
- TTL: **5 minutes**
- Invalidation: None (TTL-based expiry only). Similar items don't change frequently enough to warrant active invalidation.
- Implementation: Simple `Map<string, { data, expiresAt }>` in the service layer (no Redis needed at current scale)

### Why not Redis or CDN cache?

- At current traffic levels (pre-launch/early), in-memory TTL cache in the Node.js process is sufficient
- The endpoint is not personalized, so responses are shareable across users viewing the same listing
- If the backend scales to multiple ECS tasks, each task has its own cache -- this is acceptable because cache misses just hit PostgreSQL (which handles this query in <50ms with existing indexes)
- Redis can be added later as a straightforward enhancement if cache hit rate monitoring shows it's needed

---

## 5. Mobile Screen/Component Changes

### ListingDetailScreen
- Add `SimilarItemsSection` below the existing listing content (after seller info, before footer)
- Fetch on mount: `GET /api/v1/listings/:id/similar`
- Show skeleton loader while fetching
- Hide section entirely if API returns 0 results
- Section title: "Similar Items Nearby"

### New Component: `SimilarItemsSection`
- Props: `listingId: string`
- Internal state: fetches data on mount, handles loading/empty/error states
- Renders a horizontal FlatList of `SimilarItemCard` components
- "See More" link at end navigates to SearchScreen with pre-filled category + location filters

### New Component: `SimilarItemCard`
- Compact card (width ~160px) showing:
  - Cover image (square, 160x160)
  - Title (1 line, truncated)
  - Price
  - Distance badge (e.g., "2.4 km away")
- Tapping navigates to that listing's detail screen (pushes onto the BrowseStack)

### ListingSoldScreen / ListingDeletedScreen (if they exist as separate states)
- If the listing detail screen shows a "This item has been sold" banner, the similar items section is shown below it with a header "Looking for something similar?"
- Same component, same API call -- the endpoint works for SOLD listings too (the reference listing can be in any status; the SIMILAR results are always ACTIVE)

### Navigation
- No new screens. `SimilarItemCard` tap pushes `ListingDetail` with the new listing ID onto the current stack.
- This creates a natural drill-down navigation (ListingDetail -> Similar Item -> Similar Item -> ...) which React Navigation handles with its standard stack behavior.

---

## 6. Shared Types Additions (`packages/shared`)

```typescript
export interface SimilarListing {
  id: string;
  title: string;
  price: string;
  condition: string;
  status: 'ACTIVE';
  latitude: number;
  longitude: number;
  distanceKm: number;
  createdAt: string;
  coverImageUrl: string | null;
  sellerDisplayName: string;
  sellerAverageRating: number;
  categoryName: string;
  categorySlug: string;
}

export interface SimilarListingsResponse {
  listings: SimilarListing[];
}
```

---

## 7. Implementation Order

| Phase | Task | Agent | Depends on |
|-------|------|-------|------------|
| 1 | Add `SimilarListing` types to shared package | @backend-developer | - |
| 2 | Implement similar listings service (query + fallback + cache) | @backend-developer | Phase 1 |
| 3 | Implement GET /api/v1/listings/:id/similar route + controller | @backend-developer | Phase 2 |
| 4 | Implement `SimilarItemCard` component | @react-native-developer | Phase 1 |
| 5 | Implement `SimilarItemsSection` component | @react-native-developer | Phase 3, 4 |
| 6 | Integrate section into ListingDetailScreen | @react-native-developer | Phase 5 |
| 7 | Handle sold/deleted listing state (show "Looking for similar?" variant) | @react-native-developer | Phase 6 |

---

## 8. Performance Budget

| Metric | Target | Rationale |
|--------|--------|-----------|
| Query time (cold) | < 80ms | Existing Haversine queries run in ~30-50ms with bounding box; adding price filter is negligible |
| Query time (cached) | < 5ms | In-memory map lookup |
| Mobile render | < 100ms | Horizontal FlatList with 6 items; images lazy-loaded |
| Endpoint P95 | < 200ms | Well within the 500ms API latency budget |

---

## 9. Edge Cases

| Case | Behavior |
|------|----------|
| Listing has price = 0 (free) | Use fixed maxPrice = 20 for similarity range |
| Listing has no category (shouldn't happen due to NOT NULL) | Return empty array |
| Reference listing is DELETED | Return 404 |
| Reference listing is SOLD | Return similar ACTIVE items (useful for "item sold" alternative suggestions) |
| Very rural area (no nearby items) | Fallback strategy expands radius; if still empty, hide section on mobile |
| New listing with no similar items yet | Hide section; no error shown to user |

---

## 10. Trade-offs

| Decision | Trade-off |
|----------|-----------|
| Same-category-only (no cross-category similarity) | Misses items that are functionally similar but in different categories (e.g., "iPhone" in Electronics vs. Phones). Simplicity wins for v1. |
| Distance-first ordering | A "relevance" score mixing price proximity + distance + recency would be more sophisticated but harder to tune and explain. Distance is the single most important factor in a local marketplace. |
| In-memory cache (not Redis) | Does not share across ECS tasks. Acceptable at single-task staging scale. Switch to Redis if cache hit rate drops below 60% after scaling. |
| Fixed +/-30% price range default | May be too narrow for cheap items ($5 +/- 30% = $3.50-$6.50) and too wide for expensive items ($5000 +/- 30%). Could use logarithmic scaling in future. |
| No ML/collaborative filtering | "Users who viewed X also viewed Y" would be more engaging but requires event tracking infrastructure not yet built. Rule-based is good enough for launch. |
