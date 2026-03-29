<!--
DOCUMENT METADATA
Owner: @database-expert
Update trigger: Any schema change, migration, index addition, or significant query pattern decision
Update scope: Full document
Read by: @backend-developer (to write queries), @systems-architect (for scaling and architecture decisions)
-->

# Database Reference

> **Engine**: PostgreSQL 15 (AWS RDS, eu-west-1)
> **ORM / Query layer**: Prisma 5.x
> **Connection**: Via `DATABASE_URL` environment variable (see `.env.example`)
> **Last updated**: 2026-03-29

---

## Schema Overview

The Marketplace database contains 9 entities that support user authentication, inventory management, peer-to-peer messaging, seller reputation, and push notification delivery.

```
users ──< listings ──< listing_images
  │           │
  │           └──< conversations ──< messages
  │           └──< reviews
  │
  ├──── invite_codes (1:1 created, 1:1 used)
  └──< push_tokens

categories ──< listings
```

**Key relationships**:
- `users` 1:1 `invite_codes` (created): each user may generate exactly one invite code
- `users` 1:1 `invite_codes` (used): each user may have consumed exactly one invite code to register
- `users` 1:N `listings`: a seller owns many listings
- `listings` 1:N `listing_images`: each listing has ordered images
- `listings` 1:N `conversations`: a listing may have many buyer inquiries, each scoped to one buyer
- `conversations` 1:N `messages`: an ordered message thread within a conversation
- `listings` 1:N `reviews`: a completed transaction produces at most one review per direction
- `users` 1:N `push_tokens`: a user may be logged in on multiple devices
- `categories` 1:N `listings`: each listing belongs to one category

---

## Tables

---

### users

**Purpose**: Stores all registered user accounts. Auth0 is the credential authority; this table holds profile data and cached reputation metrics. A row is created on first successful Auth0 login.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, NOT NULL, DEFAULT gen_random_uuid() | Internal primary key |
| auth0_id | text | NOT NULL, UNIQUE | Auth0 `sub` claim — the permanent link between Auth0 and this record |
| email | text | NOT NULL, UNIQUE | User's email address — sourced from Auth0, kept in sync |
| display_name | text | NOT NULL | Publicly visible name chosen by the user |
| avatar_url | text | NULL | URL to profile image (hosted on CDN / S3) |
| bio | text | NULL | Optional free-text self-description |
| average_rating | float8 | NOT NULL, DEFAULT 0 | Cached mean of all `reviews.rating` values received. Updated by application on each new review — avoids aggregation on every profile read |
| rating_count | int4 | NOT NULL, DEFAULT 0 | Count of reviews received. Updated alongside `average_rating` |
| invite_code_used_id | uuid | UNIQUE, FK → invite_codes.id, NULL | The invite code the user redeemed at registration. NULL for the founding users seeded before invite enforcement |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Record creation time |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last modification time (managed by Prisma `@updatedAt`) |

**Indexes**:
- Implicit unique index on `auth0_id` — lookup on every authenticated request
- Implicit unique index on `email` — deduplication on registration
- Implicit unique index on `invite_code_used_id` — enforces one-code-per-user

**Relationships**:
- `invite_code_used_id` → `invite_codes.id` (no cascade — retain invite record if user is deleted)

**Notes**: Hard deletes are used. Listings and conversations should be anonymised or cascade-deleted before user deletion. `average_rating` and `rating_count` are denormalised for read performance — keep them consistent via the review creation transaction.

---

### invite_codes

**Purpose**: Stores user-generated invite codes that gate new registrations. Each user may generate exactly one code; each code may be used exactly once. There is no expiry.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, NOT NULL, DEFAULT gen_random_uuid() | Primary key |
| code | text | NOT NULL, UNIQUE | Human-readable invite string (e.g., `MKTPLACE-X7K2`) |
| created_by_id | uuid | NOT NULL, UNIQUE, FK → users.id | The user who generated this code. UNIQUE enforces one code per user |
| used_at | timestamptz | NULL | Timestamp of redemption. NULL means the code has not yet been used |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Code generation time |

**Indexes**:
- Implicit unique index on `code` — lookup during registration validation
- Implicit unique index on `created_by_id` — enforces one-code-per-user invariant

**Relationships**:
- `created_by_id` → `users.id` (no cascade — retain code history if creator is deleted)
- `users.invite_code_used_id` → `invite_codes.id` — the reverse pointer on the `users` table indicates which code was used

**Notes**: The `usedBy` relationship is navigated through `users.invite_code_used_id`. There is no `used_by_id` column on this table — the relationship is owned by `users` to avoid a circular FK dependency. Codes have no expiry by design (product decision). The combination of UNIQUE on `created_by_id` and UNIQUE on `users.invite_code_used_id` ensures: one code generated per user, one code consumed per user.

---

### categories

**Purpose**: Reference table of listing categories. Seeded at deploy time; not user-editable in v1.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, NOT NULL, DEFAULT gen_random_uuid() | Primary key |
| name | text | NOT NULL, UNIQUE | Human-readable category name (e.g., "Electronics") |
| slug | text | NOT NULL, UNIQUE | URL-safe identifier (e.g., "electronics") |

**Indexes**:
- Implicit unique index on `name`
- Implicit unique index on `slug` — used in API filtering

**Notes**: No `created_at` column — this is a static reference table. Seed data should be applied in the initial migration.

---

### listings

**Purpose**: Core inventory entity. Represents an item a seller is offering for sale. Supports GPS-based discovery via `latitude` / `longitude` float columns.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, NOT NULL, DEFAULT gen_random_uuid() | Primary key |
| title | text | NOT NULL | Short listing headline |
| description | text | NOT NULL | Full item description |
| price | numeric(10,2) | NOT NULL | Asking price. Decimal type prevents floating-point rounding errors on currency |
| condition | enum Condition | NOT NULL | Item condition: NEW, LIKE_NEW, GOOD, FAIR, POOR |
| status | enum ListingStatus | NOT NULL, DEFAULT 'ACTIVE' | Listing lifecycle: ACTIVE, SOLD, DELETED |
| latitude | float8 | NOT NULL | WGS-84 latitude of the listing location. Used in Haversine distance queries |
| longitude | float8 | NOT NULL | WGS-84 longitude of the listing location. Used in Haversine distance queries |
| category_id | uuid | NOT NULL, FK → categories.id | The category this listing belongs to |
| seller_id | uuid | NOT NULL, FK → users.id | The user selling this item |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Listing creation time |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last modification time |

**Indexes**:
- `idx_listings_lat_lng` on `(latitude, longitude)` — supports bounding-box pre-filter in Haversine queries. Not sufficient alone for distance ordering; the application applies the Haversine formula in the WHERE/ORDER BY clause using raw SQL
- `idx_listings_status` on `(status)` — filters active listings efficiently; low cardinality but the ACTIVE bucket is the dominant query pattern
- `idx_listings_seller_id` on `(seller_id)` — fetch all listings by a seller for profile pages
- `idx_listings_category_id` on `(category_id)` — filter listings by category

**Relationships**:
- `seller_id` → `users.id` (no cascade — listings should be retained or anonymised if a seller is deleted)
- `category_id` → `categories.id` (no cascade)
- `listing_images` ON DELETE CASCADE — images are owned by the listing
- `conversations` — no cascade; conversations should be retained for audit
- `reviews` — no cascade; reviews should be retained for audit

**Notes**: `status = 'DELETED'` is a soft delete — the row is retained for referential integrity (conversations and reviews reference it). Queries for active inventory must include `WHERE status = 'ACTIVE'`. A partial index on `(latitude, longitude) WHERE status = 'ACTIVE'` would be more efficient but adds migration complexity; can be added in a future optimisation pass once query patterns are confirmed from production. PostGIS upgrade path: enable the `postgis` extension on the RDS instance and add a `location GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (ST_MakePoint(longitude, latitude)) STORED` column in a future migration.

---

### listing_images

**Purpose**: Stores ordered image URLs for a listing. Separated from `listings` to support multiple images without array columns.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, NOT NULL, DEFAULT gen_random_uuid() | Primary key |
| listing_id | uuid | NOT NULL, FK → listings.id ON DELETE CASCADE | The owning listing |
| url | text | NOT NULL | Fully-qualified URL to the image (CDN / S3 pre-signed URL) |
| order | int4 | NOT NULL, DEFAULT 0 | Display order. Lower values appear first. The first image (order=0) is the cover photo |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Upload time |

**Indexes**:
- `idx_listing_images_listing_id` on `(listing_id)` — fetch all images for a listing

**Relationships**:
- `listing_id` → `listings.id` (ON DELETE CASCADE — images are deleted when their listing is hard-deleted)

**Notes**: Soft-deleted listings (`status = 'DELETED'`) retain their images. The `order` column is application-managed; the backend must validate uniqueness of order values per listing if strict ordering is required.

---

### conversations

**Purpose**: Represents a buyer's inquiry thread about a specific listing. A conversation is scoped to exactly one listing and one buyer; the seller is derived via `listings.seller_id`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, NOT NULL, DEFAULT gen_random_uuid() | Primary key |
| listing_id | uuid | NOT NULL, FK → listings.id | The listing being enquired about |
| buyer_id | uuid | NOT NULL, FK → users.id | The prospective buyer initiating the conversation |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Conversation creation time |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Updated when a new message is added (application-managed) |

**Indexes**:
- Implicit unique index on `(listing_id, buyer_id)` — enforces one conversation per buyer per listing; also serves as the lookup index for this common access pattern
- `idx_conversations_buyer_id` on `(buyer_id)` — fetch all conversations for a buyer's inbox

**Relationships**:
- `listing_id` → `listings.id` (no cascade)
- `buyer_id` → `users.id` (no cascade)
- `messages` ON DELETE CASCADE — messages are owned by the conversation

**Notes**: The seller's identity is not stored directly on this table. To retrieve the seller, JOIN to `listings` and read `listings.seller_id`. The UNIQUE constraint on `(listing_id, buyer_id)` means the application can safely upsert to find-or-create a conversation.

---

### messages

**Purpose**: Individual messages within a conversation. Supports unread tracking via `read_at`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, NOT NULL, DEFAULT gen_random_uuid() | Primary key |
| conversation_id | uuid | NOT NULL, FK → conversations.id ON DELETE CASCADE | The parent conversation |
| sender_id | uuid | NOT NULL | The user who sent the message. Not a FK with cascade to retain messages if sender is deleted |
| content | text | NOT NULL | Message body |
| read_at | timestamptz | NULL | Timestamp when the recipient read the message. NULL = unread |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Message send time |

**Indexes**:
- `idx_messages_conversation_id` on `(conversation_id)` — fetch message thread; combined with ORDER BY created_at
- `idx_messages_sender_id` on `(sender_id)` — lookup messages by sender (used for moderation)

**Relationships**:
- `conversation_id` → `conversations.id` (ON DELETE CASCADE — messages deleted when conversation is deleted)

**Notes**: `read_at` tracks per-message read state. Unread count is computed as `COUNT(*) WHERE read_at IS NULL AND sender_id != <current_user_id>`. A partial index on `(conversation_id) WHERE read_at IS NULL` can be added if unread-count queries become a bottleneck.

---

### reviews

**Purpose**: Post-transaction seller reviews. A buyer submits a review of the seller after a sale is marked complete. The unique constraint enforces one review per direction per listing.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, NOT NULL, DEFAULT gen_random_uuid() | Primary key |
| listing_id | uuid | NOT NULL, FK → listings.id | The listing the transaction relates to |
| reviewer_id | uuid | NOT NULL, FK → users.id | The user writing the review (buyer) |
| reviewee_id | uuid | NOT NULL, FK → users.id | The user being reviewed (seller) |
| rating | int4 | NOT NULL | Score 1–5. Application layer validates the range; a CHECK constraint can be added: `CHECK (rating BETWEEN 1 AND 5)` |
| comment | text | NULL | Optional written feedback |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Review submission time |

**Indexes**:
- Implicit unique index on `(listing_id, reviewer_id, reviewee_id)` — prevents duplicate reviews and doubles as a lookup index
- `idx_reviews_reviewee_id` on `(reviewee_id)` — fetch all reviews for a seller's profile page

**Relationships**:
- `listing_id` → `listings.id` (no cascade — retain reviews for audit)
- `reviewer_id` → `users.id` (no cascade)
- `reviewee_id` → `users.id` (no cascade)

**Notes**: After inserting a review, the application must update `users.average_rating` and `users.rating_count` for the reviewee within the same transaction. Formula: `new_average = ((old_average * old_count) + new_rating) / (old_count + 1)`. The `rating` range (1–5) is currently enforced by the application layer. Adding `@@check("rating >= 1 AND rating <= 5")` at the database level is recommended as a future hardening step.

---

### push_tokens

**Purpose**: Stores Expo push notification tokens per device. A user may have tokens for multiple devices (phone + tablet, iOS reinstall, etc.). Stale tokens are purged when Expo returns a `DeviceNotRegistered` error.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, NOT NULL, DEFAULT gen_random_uuid() | Primary key |
| user_id | uuid | NOT NULL, FK → users.id ON DELETE CASCADE | The owning user |
| token | text | NOT NULL, UNIQUE | Expo push token (e.g., `ExponentPushToken[xxx]`). UNIQUE prevents duplicate registrations |
| platform | enum Platform | NOT NULL | IOS or ANDROID — used to tailor notification payload if needed |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Token registration time |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Last seen / re-registered time |

**Indexes**:
- Implicit unique index on `token` — deduplicates registration upserts
- `idx_push_tokens_user_id` on `(user_id)` — fetch all tokens for a user when sending a notification

**Relationships**:
- `user_id` → `users.id` (ON DELETE CASCADE — tokens deleted when user is deleted)

**Notes**: Token registration should be an upsert (`INSERT ... ON CONFLICT (token) DO UPDATE SET updated_at = now(), user_id = $userId`). When Expo returns `DeviceNotRegistered`, the token row must be deleted immediately to avoid wasted push calls.

---

## Enums

| Enum | Values | Used by |
|------|--------|---------|
| `ListingStatus` | ACTIVE, SOLD, DELETED | `listings.status` |
| `Condition` | NEW, LIKE_NEW, GOOD, FAIR, POOR | `listings.condition` |
| `Platform` | IOS, ANDROID | `push_tokens.platform` |

---

## Migrations Log

| Migration File | Date | Description | Reversible | Deployment Risk |
|----------------|------|-------------|------------|-----------------|
| `001_initial_schema` | 2026-03-29 | Full initial schema: all 9 tables, enums, indexes, FK constraints | Yes | None — new database, no existing data |

---

## Common Query Patterns

### 1. Nearby listings (Haversine bounding box + distance filter)

Prisma does not support Haversine natively. Use `$queryRaw` with a raw SQL query. The bounding-box index pre-filter (`latitude BETWEEN` / `longitude BETWEEN`) reduces the candidate set before the more expensive trigonometric calculation.

```sql
-- $1 = centre latitude, $2 = centre longitude, $3 = radius in km
SELECT
  l.id,
  l.title,
  l.price,
  l.latitude,
  l.longitude,
  (
    6371 * acos(
      cos(radians($1)) * cos(radians(l.latitude))
      * cos(radians(l.longitude) - radians($2))
      + sin(radians($1)) * sin(radians(l.latitude))
    )
  ) AS distance_km
FROM listings l
WHERE
  l.status = 'ACTIVE'
  AND l.latitude  BETWEEN ($1 - $3 / 111.0) AND ($1 + $3 / 111.0)
  AND l.longitude BETWEEN ($2 - $3 / (111.0 * cos(radians($1)))) AND ($2 + $3 / (111.0 * cos(radians($1))))
HAVING
  (
    6371 * acos(
      cos(radians($1)) * cos(radians(l.latitude))
      * cos(radians(l.longitude) - radians($2))
      + sin(radians($1)) * sin(radians(l.latitude))
    )
  ) <= $3
ORDER BY distance_km ASC
LIMIT 50;
```

Uses `idx_listings_lat_lng` and `idx_listings_status` for the pre-filter.

### 2. Unread message count per conversation

```sql
-- $1 = conversation_id, $2 = current user_id (the reader)
SELECT COUNT(*) AS unread_count
FROM messages
WHERE
  conversation_id = $1
  AND sender_id   != $2
  AND read_at     IS NULL;
```

Uses `idx_messages_conversation_id`. A partial index on `(conversation_id) WHERE read_at IS NULL` should be considered if this query runs at high frequency.

### 3. User's conversations with last message (inbox view)

```sql
-- $1 = current user_id
SELECT
  c.id            AS conversation_id,
  c.listing_id,
  l.title         AS listing_title,
  l.status        AS listing_status,
  limg.url        AS listing_cover_image,
  m.content       AS last_message,
  m.created_at    AS last_message_at,
  m.sender_id     AS last_message_sender_id,
  (
    SELECT COUNT(*)
    FROM messages unread
    WHERE unread.conversation_id = c.id
      AND unread.sender_id != $1
      AND unread.read_at IS NULL
  ) AS unread_count
FROM conversations c
JOIN listings l        ON l.id = c.listing_id
LEFT JOIN listing_images limg
  ON limg.listing_id = c.listing_id
  AND limg."order"   = 0
JOIN LATERAL (
  SELECT content, created_at, sender_id
  FROM messages
  WHERE conversation_id = c.id
  ORDER BY created_at DESC
  LIMIT 1
) m ON true
WHERE c.buyer_id = $1
   OR l.seller_id = $1
ORDER BY m.created_at DESC;
```

Uses `idx_conversations_buyer_id` for the buyer branch. The LATERAL join retrieves the last message efficiently using `idx_messages_conversation_id`.

### 4. Update average rating after a new review (run in same transaction as INSERT into reviews)

```sql
-- $1 = new rating value (integer 1-5), $2 = reviewee user_id
UPDATE users
SET
  rating_count   = rating_count + 1,
  average_rating = ((average_rating * rating_count) + $1) / (rating_count + 1),
  updated_at     = now()
WHERE id = $2;
```

This must execute within the same database transaction as the `INSERT INTO reviews` to keep `average_rating` / `rating_count` consistent. If the transaction rolls back, neither the review nor the rating update is persisted.

---

## Key Design Decisions

### Auth0 as credential authority
Auth0 is the source of truth for passwords, MFA, and session tokens. The `auth0_id` column (`auth0_sub` claim) is the stable link between the Auth0 user record and this database. The `email` column is kept in sync from Auth0 claims on each login — it is not the primary lookup key. If an Auth0 user is deleted and recreated, a new `auth0_id` means a new DB user row.

### Latitude / longitude as Float columns
PostGIS is not assumed to be available on all RDS tiers. `latitude` and `longitude` are stored as `float8` (double precision) — sufficient for sub-metre accuracy. GPS queries use the Haversine formula in raw SQL with a bounding-box pre-filter. PostGIS upgrade path: enable the `postgis` extension on the RDS instance and add a `GEOGRAPHY(Point, 4326)` column derived from the existing float columns in a future additive migration. The float columns would be retained during transition.

### Cached rating fields on users
`average_rating` and `rating_count` are denormalised onto the `users` table. Recomputing them from `reviews` on every profile read is expensive and grows with the user's transaction history. The trade-off is that both fields must be updated atomically in the same transaction as a new review. Any bug that inserts a review without updating the cache produces drift — monitor with a periodic reconciliation job: `SELECT reviewee_id, COUNT(*), AVG(rating) FROM reviews GROUP BY reviewee_id`.

### Invite code ownership model
The relationship between a code and its creator is owned by `invite_codes.created_by_id` (UNIQUE FK to `users`). The relationship between a user and the code they used to register is owned by `users.invite_code_used_id` (UNIQUE FK to `invite_codes`). This avoids a circular dependency and makes both invariants enforced at the database level without triggers.

### Conversations uniqueness
The UNIQUE constraint on `(listing_id, buyer_id)` in `conversations` means the API can safely use an upsert to find-or-create a conversation, and duplicate conversation creation by the client is idempotent. The seller identity is not duplicated onto the conversation row — it is resolved via `listings.seller_id`.

### Soft deletes on listings only
Only listings use a soft delete (`status = 'DELETED'`). Users, conversations, messages, and reviews use hard deletes (with appropriate cascade rules). Listing soft deletes preserve referential integrity for conversations and reviews that reference the listing after it is taken down.

### Review direction uniqueness
The UNIQUE constraint on `(listing_id, reviewer_id, reviewee_id)` permits two reviews per listing (buyer reviews seller, and potentially seller reviews buyer in future) without allowing duplicates in either direction. In v1 only the buyer-reviews-seller direction is implemented.

---

## Known Issues and Tech Debt

| Issue | Impact | Plan |
|-------|--------|------|
| No CHECK constraint on `reviews.rating` range | Invalid rating values (e.g., 0, 6) can be inserted if application validation is bypassed | Add `CHECK (rating BETWEEN 1 AND 5)` in a future migration |
| `latitude`/`longitude` as float columns | Haversine queries require raw SQL; no spatial indexing | PostGIS upgrade path documented above |
| `average_rating` cache drift risk | A bug in review creation can desync cached fields | Add periodic reconciliation job; consider a DB trigger as a safety net |
| No partial index for active listing geo-queries | `idx_listings_lat_lng` indexes all rows including SOLD/DELETED | Add `WHERE status = 'ACTIVE'` partial index once query volume justifies it |
