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

### PATCH /api/v1/users/me

**Auth required**: Yes
**Description**: Updates the authenticated user's own profile. All fields are optional — only the fields provided are updated. Pass `null` for `bio` or `avatarUrl` to explicitly clear those fields.

**Request body**:
```json
{
  "displayName": "string — optional, 1–60 chars",
  "bio": "string | null — optional, max 300 chars; null clears the field",
  "avatarUrl": "string | null — optional, must be a valid URL; null clears the field"
}
```

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
    "createdAt": "string — ISO 8601",
    "updatedAt": "string — ISO 8601"
  }
}
```

**Error codes**:
- `400` — Validation error (displayName too long, bio too long, invalid avatarUrl format)
- `401` — Missing or invalid Auth0 Bearer token

---

### GET /api/v1/users/:id/reviews

**Auth required**: No
**Description**: Returns paginated reviews received by the specified user, ordered newest first. Each review includes the reviewer's display name and avatar, and the listing title it relates to.

**Path parameters**:
- `id` — user UUID

**Query parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | `1` | Page number (min 1) |
| `limit` | integer | No | `20` | Results per page (1 – 50) |

**Response 200**:
```json
{
  "reviews": [
    {
      "id": "string — UUID",
      "listingId": "string — UUID",
      "reviewerId": "string — UUID",
      "revieweeId": "string — UUID",
      "rating": "number — integer 1–5",
      "comment": "string | null",
      "createdAt": "string — ISO 8601",
      "reviewer": {
        "id": "string — UUID",
        "displayName": "string",
        "avatarUrl": "string | null"
      },
      "listing": {
        "id": "string — UUID",
        "title": "string"
      }
    }
  ],
  "total": "number — total reviews for this user",
  "page": "number — current page",
  "limit": "number — results per page",
  "hasMore": "boolean"
}
```

**Error codes**:
- `400` — Validation error (invalid page/limit values)

---

### GET /api/v1/users/:id/rating

**Auth required**: No
**Description**: Returns the cached average rating and total review count for the specified user. Values are updated atomically after each new review.

**Path parameters**:
- `id` — user UUID

**Response 200**:
```json
{
  "averageRating": "number — float, 0 if no reviews yet",
  "ratingCount": "number — integer, count of reviews received"
}
```

**Error codes**:
- `404` — User not found

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
**Description**: Updates the status of a listing. Currently supports transitioning to `SOLD` only. Optionally records which buyer purchased the item via `buyerId`. Only the listing owner may call this endpoint.

**Path parameters**:
- `id` — listing UUID

**Request body**:
```json
{
  "status": "SOLD",
  "buyerId": "string | undefined — optional UUID of the buyer who purchased the item"
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
- `400` — Validation error (invalid or unsupported status value, buyerId not a valid UUID)
- `401` — Missing or invalid Auth0 Bearer token
- `403` — Authenticated user is not the listing owner
- `404` — Listing not found or soft-deleted

---

### GET /api/v1/listings/:id/buyers

**Auth required**: Yes
**Description**: Returns the list of users who have started a conversation on the specified listing, ordered by most recently active conversation first. Only the listing owner may call this endpoint. Used to populate the buyer selection UI when marking a listing as sold.

**Path parameters**:
- `id` — listing UUID

**Response 200**:
```json
{
  "buyers": [
    {
      "id": "string — UUID",
      "displayName": "string",
      "avatarUrl": "string | null"
    }
  ]
}
```

**Error codes**:
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

### POST /api/v1/conversations

**Auth required**: Yes
**Description**: Creates or retrieves an existing conversation between the authenticated buyer and the listing owner. The unique constraint `(listingId, buyerId)` makes this operation idempotent — calling it twice returns the same conversation. The authenticated user cannot start a conversation on their own listing.

**Request body**:
```json
{
  "listingId": "string — UUID of the listing to enquire about"
}
```

**Response 201**:
```json
{
  "conversation": {
    "id": "string — UUID",
    "listingId": "string — UUID",
    "buyerId": "string — UUID",
    "createdAt": "string — ISO 8601",
    "updatedAt": "string — ISO 8601",
    "listing": {
      "id": "string — UUID",
      "title": "string",
      "status": "string — ACTIVE | SOLD | DELETED",
      "sellerId": "string — UUID",
      "images": [{ "id": "string", "url": "string", "order": 0 }]
    },
    "buyer": {
      "id": "string — UUID",
      "displayName": "string",
      "avatarUrl": "string | null"
    }
  }
}
```

**Error codes**:
- `400` — Validation error (listingId not a UUID, or buyer is the seller)
- `401` — Missing or invalid Auth0 Bearer token
- `404` — Listing not found

---

### GET /api/v1/conversations

**Auth required**: Yes
**Description**: Returns all conversations for the authenticated user — both as buyer and as seller. Each entry includes the last message and an unread count. Results are ordered by most recently updated first.

**Response 200**:
```json
{
  "conversations": [
    {
      "id": "string — UUID",
      "listingId": "string — UUID",
      "buyerId": "string — UUID",
      "createdAt": "string — ISO 8601",
      "updatedAt": "string — ISO 8601",
      "listing": {
        "id": "string — UUID",
        "title": "string",
        "status": "string — ACTIVE | SOLD | DELETED",
        "sellerId": "string — UUID",
        "images": [{ "id": "string", "url": "string", "order": 0 }]
      },
      "buyer": {
        "id": "string — UUID",
        "displayName": "string",
        "avatarUrl": "string | null"
      },
      "messages": [
        {
          "id": "string — UUID",
          "conversationId": "string — UUID",
          "senderId": "string — UUID",
          "content": "string",
          "readAt": "string | null — ISO 8601",
          "createdAt": "string — ISO 8601"
        }
      ],
      "unreadCount": "number — count of unread messages sent by the other participant"
    }
  ]
}
```

**Error codes**:
- `401` — Missing or invalid Auth0 Bearer token

---

### GET /api/v1/conversations/:id/messages

**Auth required**: Yes
**Description**: Returns the message history for a conversation in ascending chronological order. Only participants (buyer or seller) may access this endpoint. Fetching messages marks all unread messages from the other participant as read. Supports cursor-based pagination via the `cursor` query parameter.

**Path parameters**:
- `id` — conversation UUID

**Query parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `cursor` | string (UUID) | No | — | ID of the last message seen; returns messages after this cursor |
| `limit` | integer | No | `30` | Number of messages to return (1 – 100) |

**Response 200**:
```json
{
  "messages": [
    {
      "id": "string — UUID",
      "conversationId": "string — UUID",
      "senderId": "string — UUID",
      "content": "string",
      "readAt": "string | null — ISO 8601",
      "createdAt": "string — ISO 8601"
    }
  ]
}
```

**Error codes**:
- `401` — Missing or invalid Auth0 Bearer token
- `403` — Authenticated user is not a participant in this conversation

---

### POST /api/v1/conversations/:id/messages

**Auth required**: Yes
**Description**: Persists a new message in the conversation and emits a `new_message` Socket.io event to the `conversation:{id}` room so all connected participants receive it in real time. Only participants may send messages.

**Path parameters**:
- `id` — conversation UUID

**Request body**:
```json
{
  "content": "string — message text, 1–2000 characters"
}
```

**Response 201**:
```json
{
  "message": {
    "id": "string — UUID",
    "conversationId": "string — UUID",
    "senderId": "string — UUID",
    "content": "string",
    "readAt": null,
    "createdAt": "string — ISO 8601"
  }
}
```

**Error codes**:
- `400` — Validation error (empty content or exceeds 2000 chars)
- `401` — Missing or invalid Auth0 Bearer token
- `403` — Authenticated user is not a participant in this conversation

---

## Socket.io — Real-Time Messaging

**Connection URL**: Same host as the REST API (Socket.io shares the HTTP server).
**Transport**: WebSocket with HTTP long-polling fallback.

### Authentication

Pass the Auth0 JWT in the `auth` handshake object:

```javascript
const socket = io(SERVER_URL, {
  auth: { token: '<auth0-access-token>' }
});
```

Connections without a valid token are rejected with an error event. On successful connection, the server automatically joins the socket to `conversation:{id}` rooms for all conversations the authenticated user participates in.

### Client Events (emit to server)

| Event | Payload | Description |
|-------|---------|-------------|
| `join_conversation` | `conversationId: string` | Join a specific conversation room, e.g. after `POST /conversations` creates a new one |

### Server Events (received by client)

| Event | Payload | Description |
|-------|---------|-------------|
| `new_message` | `Message` object (same shape as REST response) | Emitted to `conversation:{id}` room when a new message is sent via `POST /conversations/:id/messages` |

---

## Reviews

### POST /api/v1/reviews

**Auth required**: Yes
**Description**: Creates a review for a completed transaction. The listing must have status `SOLD`. The authenticated user must be either the buyer (a participant in a conversation on the listing) or the seller. One review is allowed per direction per listing — duplicate attempts return a 409.

**Request body**:
```json
{
  "listingId": "string — UUID of the SOLD listing",
  "revieweeId": "string — UUID of the user being reviewed",
  "rating": "number — integer 1–5",
  "comment": "string | undefined — optional text, max 1000 chars"
}
```

**Response 201**:
```json
{
  "review": {
    "id": "string — UUID",
    "listingId": "string — UUID",
    "reviewerId": "string — UUID",
    "revieweeId": "string — UUID",
    "rating": "number — integer 1–5",
    "comment": "string | null",
    "createdAt": "string — ISO 8601"
  }
}
```

**Error codes**:
- `400` — Validation error (invalid UUID, rating out of range, comment too long, self-review attempt)
- `401` — Missing or invalid Auth0 Bearer token
- `403` — Authenticated user is not a participant in this transaction
- `404` — Listing not found
- `409` — Review already submitted for this direction on this listing (error code `CONFLICT`)
- `422` — Listing is not in `SOLD` status (error code `UNPROCESSABLE`)

---

## Push Tokens

### POST /api/v1/push-tokens

**Auth required**: Yes
**Description**: Registers or updates an Expo push token for the authenticated user's current device. Uses an upsert — if the token already exists (e.g. app reinstall), the `userId` and `updatedAt` fields are refreshed. A user may have multiple tokens across multiple devices.

**Request body**:
```json
{
  "token": "string — Expo push token (e.g. ExponentPushToken[xxx])",
  "platform": "string — IOS | ANDROID"
}
```

**Response 200**:
```json
{
  "success": true
}
```

**Error codes**:
- `400` — Validation error (missing token, invalid platform value)
- `401` — Missing or invalid Auth0 Bearer token

---

### DELETE /api/v1/push-tokens/:token

**Auth required**: Yes
**Description**: Removes a push token from the database, opting the device out of push notifications (FR-063). Only the token's registered owner may delete it.

**Path parameters**:
- `token` — the Expo push token string (URL-encoded if necessary)

**Response 200**:
```json
{
  "success": true
}
```

**Error codes**:
- `401` — Missing or invalid Auth0 Bearer token
- `403` — Token does not belong to the authenticated user
- `404` — Push token not found
