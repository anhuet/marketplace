# API Reference

> Base URL: `/api/v1`
> Auth: Auth0 Bearer token required on all endpoints unless noted **Auth required: No**
> Error envelope: `{ "error": { "code": string, "message": string, "details"?: [...] } }`

---

## Conventions

### Authentication

Protected endpoints require an `Authorization: Bearer <token>` header containing a valid Auth0 JWT.
The token is validated against `https://${AUTH0_DOMAIN}/.well-known/jwks.json` using RS256.

### Error Codes

| HTTP status | Code | Meaning |
|-------------|------|---------|
| 400 | `VALIDATION_ERROR` | Request body / query / params failed Zod validation |
| 401 | `UNAUTHENTICATED` | Missing or invalid Bearer token |
| 403 | `FORBIDDEN` | Authenticated but not authorised to access this resource |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Resource already exists or state conflict |
| 422 | `UNPROCESSABLE` | Semantically invalid request |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Health

#### GET /api/v1/health

**Auth required**: No
**Description**: Returns the liveness status of the server and its database connection. Used by load balancers and monitoring tools.

**Response 200**:
```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": "2026-03-29T00:00:00.000Z"
}
```

**Error codes**:
- `500` — Database unreachable

---

## Auth

### POST /api/v1/auth/validate-invite

**Auth required**: No
**Description**: Validates an invite code before the client redirects the user to Auth0 signup. Returns whether the code exists and is unused. Does not consume the code — call `redeem-invite` after the Auth0 account is created.

**Request body**:
```json
{
  "code": "string — invite code to check (e.g. MKT-XXXX-XXXX)"
}
```

**Response 200**:
```json
{
  "valid": true
}
```

**Error codes**:
- `400` — Code not found or already used (error code `INVALID_INVITE_CODE`)
- `400` — Validation error (missing `code` field)

---

### POST /api/v1/auth/redeem-invite

**Auth required**: Yes
**Description**: Redeems an invite code after the user has authenticated via Auth0 for the first time. Links the invite code to the newly created DB user record and marks it as used. Can only be called once per user.

**Request body**:
```json
{
  "code": "string — invite code to redeem"
}
```

**Response 200**:
```json
{
  "success": true
}
```

**Error codes**:
- `400` — Validation error
- `401` — Missing or invalid Auth0 Bearer token
- `409` — User has already redeemed an invite code (error code `CONFLICT`)

---

### GET /api/v1/auth/me

**Auth required**: Yes
**Description**: Returns the authenticated user's full DB profile record. On first call, auto-creates the DB user record from the Auth0 token claims and generates their invite code.

**Response 200**:
```json
{
  "user": {
    "id": "string — UUID",
    "auth0Id": "string",
    "email": "string",
    "displayName": "string",
    "avatarUrl": "string | null",
    "bio": "string | null",
    "averageRating": "number",
    "ratingCount": "number",
    "inviteCodeUsedId": "string | null",
    "createdAt": "string — ISO 8601",
    "updatedAt": "string — ISO 8601"
  }
}
```

**Error codes**:
- `401` — Missing or invalid Auth0 Bearer token

---

## Invites

### GET /api/v1/invites/validate/:code

**Auth required**: No
**Description**: Public endpoint to check whether an invite code is valid and unused. Safe to expose — does not reveal the owner or any sensitive data.

**Path parameters**:
- `code` — the invite code string (e.g. `MKT-XXXX-XXXX`)

**Response 200 (valid)**:
```json
{
  "valid": true
}
```

**Response 200 (invalid)**:
```json
{
  "valid": false,
  "reason": "string — human-readable reason (Invite code not found | Invite code has already been used)"
}
```

**Error codes**:
- `400` — Validation error (empty code param)

---

### GET /api/v1/invites/mine

**Auth required**: Yes
**Description**: Returns the authenticated user's own invite code. The code is auto-generated when the user's DB record is first created, so it always exists. The `isUsed` flag indicates whether someone has already used this code to sign up.

**Response 200**:
```json
{
  "code": "string — the invite code (e.g. MKT-XXXX-XXXX)",
  "usedAt": "string | null — ISO 8601 timestamp when the code was redeemed, or null",
  "isUsed": "boolean"
}
```

**Error codes**:
- `401` — Missing or invalid Auth0 Bearer token

---

## Users

> Routes to be added in a future task.

---

## Listings

### POST /api/v1/listings

**Auth required**: Yes
**Description**: Creates a new listing for the authenticated seller. Accepts multipart/form-data with listing fields and up to 8 images. Images are stored in S3; URLs are persisted in `listing_images`. At least one image is required.

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string (3–100 chars) | Yes | Listing headline |
| `description` | string (10–2000 chars) | Yes | Full item description |
| `price` | number ≥ 0 | Yes | Asking price |
| `condition` | enum | Yes | `NEW`, `LIKE_NEW`, `GOOD`, `FAIR`, or `POOR` |
| `latitude` | number (−90 to 90) | Yes | WGS-84 latitude |
| `longitude` | number (−180 to 180) | Yes | WGS-84 longitude |
| `categoryId` | UUID string | Yes | ID of an existing category |
| `images` | file(s) | Yes | 1–8 image files (JPEG, PNG, etc.; max 10 MB each) |

**Response 201**:
```json
{
  "listing": {
    "id": "string — UUID",
    "title": "string",
    "description": "string",
    "price": "string — decimal string (e.g. \"49.99\")",
    "condition": "string — enum Condition",
    "status": "ACTIVE",
    "latitude": "number",
    "longitude": "number",
    "categoryId": "string — UUID",
    "sellerId": "string — UUID",
    "createdAt": "string — ISO 8601",
    "updatedAt": "string — ISO 8601",
    "images": [
      { "id": "string", "url": "string — HTTPS URL", "order": "number" }
    ],
    "seller": {
      "id": "string",
      "displayName": "string",
      "avatarUrl": "string | null",
      "averageRating": "number",
      "ratingCount": "number"
    },
    "category": { "id": "string", "name": "string", "slug": "string" }
  }
}
```

**Error codes**:
- `400` — Validation error (missing/invalid fields, no image provided, too many images)
- `401` — Missing or invalid Auth0 Bearer token

---

### GET /api/v1/listings/:id

**Auth required**: No
**Description**: Returns a single listing by ID including seller info, category, and all images in display order. Returns 404 for listings with status `DELETED`.

**Path parameters**:
- `id` — listing UUID

**Response 200**:
```json
{
  "listing": {
    "id": "string — UUID",
    "title": "string",
    "description": "string",
    "price": "string — decimal string",
    "condition": "string — enum Condition",
    "status": "string — ACTIVE | SOLD",
    "latitude": "number",
    "longitude": "number",
    "categoryId": "string — UUID",
    "sellerId": "string — UUID",
    "createdAt": "string — ISO 8601",
    "updatedAt": "string — ISO 8601",
    "images": [
      { "id": "string", "url": "string — HTTPS URL", "order": "number" }
    ],
    "seller": {
      "id": "string",
      "displayName": "string",
      "avatarUrl": "string | null",
      "averageRating": "number",
      "ratingCount": "number"
    },
    "category": { "id": "string", "name": "string", "slug": "string" }
  }
}
```

**Error codes**:
- `404` — Listing not found or soft-deleted

---

### PUT /api/v1/listings/:id

**Auth required**: Yes
**Description**: Replaces the editable fields of a listing. Only the listing owner may call this endpoint. Sending new `images` files replaces all existing images; omitting `images` leaves them unchanged.

**Path parameters**:
- `id` — listing UUID

**Request**: `multipart/form-data` — same fields as POST, all optional.

**Response 200**:
```json
{
  "listing": { "...same shape as POST 201 response..." }
}
```

**Error codes**:
- `400` — Validation error
- `401` — Missing or invalid Auth0 Bearer token
- `403` — Authenticated user is not the listing owner
- `404` — Listing not found or soft-deleted

---

### DELETE /api/v1/listings/:id

**Auth required**: Yes
**Description**: Soft-deletes a listing by setting its status to `DELETED`. The row is retained in the database for referential integrity. Only the listing owner may call this endpoint.

**Path parameters**:
- `id` — listing UUID

**Response 200**:
```json
{
  "success": true
}
```

**Error codes**:
- `401` — Missing or invalid Auth0 Bearer token
- `403` — Authenticated user is not the listing owner
- `404` — Listing not found or already deleted

---

### PATCH /api/v1/listings/:id/status

**Auth required**: Yes
**Description**: Updates the status of a listing. Currently supports transitioning to `SOLD` only. Only the listing owner may call this endpoint.

**Path parameters**:
- `id` — listing UUID

**Request body**:
```json
{
  "status": "SOLD"
}
```

**Response 200**:
```json
{
  "listing": {
    "id": "string — UUID",
    "status": "SOLD",
    "updatedAt": "string — ISO 8601"
  }
}
```

**Error codes**:
- `400` — Validation error (invalid or unsupported status value)
- `401` — Missing or invalid Auth0 Bearer token
- `403` — Authenticated user is not the listing owner
- `404` — Listing not found or soft-deleted

---

### GET /api/v1/listings/seller/:sellerId

**Auth required**: No
**Description**: Returns all non-deleted listings for a given seller, ordered by newest first. Each listing includes its cover image (first image by order) and category.

**Path parameters**:
- `sellerId` — seller user UUID

**Response 200**:
```json
{
  "listings": [
    {
      "id": "string — UUID",
      "title": "string",
      "price": "string — decimal string",
      "condition": "string — enum Condition",
      "status": "string — ACTIVE | SOLD",
      "latitude": "number",
      "longitude": "number",
      "createdAt": "string — ISO 8601",
      "updatedAt": "string — ISO 8601",
      "images": [
        { "id": "string", "url": "string — HTTPS cover image URL", "order": 0 }
      ],
      "category": { "id": "string", "name": "string", "slug": "string" }
    }
  ]
}
```

**Error codes**:
- `500` — Unexpected server error

---

## Discovery

### GET /api/v1/discover/nearby

**Auth required**: No
**Description**: Returns active listings sorted by ascending distance from the caller's GPS coordinates. Supports optional radius, category, and keyword filters with offset-based pagination. Uses the Haversine formula in raw SQL with a bounding-box pre-filter on `(latitude, longitude)` for performance.

**Query parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `lat` | number | Yes | — | Centre latitude, WGS-84 (-90 to 90) |
| `lng` | number | Yes | — | Centre longitude, WGS-84 (-180 to 180) |
| `radiusKm` | number | No | `10` | Search radius in kilometres (0.1 – 100) |
| `categoryId` | UUID | No | — | Filter to a single category by its UUID |
| `q` | string | No | — | Keyword search against title and description (case-insensitive, max 200 chars) |
| `page` | integer | No | `1` | Page number (min 1) |
| `limit` | integer | No | `20` | Results per page (1 – 50) |

**Response 200**:
```json
{
  "listings": [
    {
      "id": "string — UUID",
      "title": "string",
      "description": "string",
      "price": "string — decimal as string (e.g. '29.99')",
      "condition": "string — NEW | LIKE_NEW | GOOD | FAIR | POOR",
      "status": "ACTIVE",
      "latitude": "number",
      "longitude": "number",
      "categoryId": "string — UUID",
      "sellerId": "string — UUID",
      "createdAt": "string — ISO 8601",
      "updatedAt": "string — ISO 8601",
      "distanceKm": "number — distance from query point",
      "coverImageUrl": "string | null — URL of first image (order=0), null if no images",
      "sellerDisplayName": "string",
      "sellerAverageRating": "number",
      "categoryName": "string",
      "categorySlug": "string"
    }
  ],
  "total": "number — total matching results (for pagination)",
  "page": "number — current page",
  "limit": "number — results per page",
  "hasMore": "boolean — true if more pages exist"
}
```

**Error codes**:
- `400` — `lat` or `lng` missing or out of range, `radiusKm` out of bounds, `categoryId` not a valid UUID, `q` exceeds 200 characters

---

### GET /api/v1/discover/categories

**Auth required**: No
**Description**: Returns all listing categories ordered alphabetically. Used to populate category filter dropdowns in the discovery UI.

**Response 200**:
```json
{
  "categories": [
    {
      "id": "string — UUID",
      "name": "string — e.g. 'Electronics'",
      "slug": "string — e.g. 'electronics'"
    }
  ]
}
```

**Error codes**:
- `500` — Database unreachable

---

## Conversations & Messages

> Routes to be added in task #008.

---

## Reviews

> Routes to be added in task #009.
