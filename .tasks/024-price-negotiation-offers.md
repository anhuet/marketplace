# Task 024: Price Negotiation (Make an Offer)

> **Status**: Planning
> **Priority**: High
> **Depends on**: #006 (Listings API), #008 (Chat API & WebSocket), #010 (Push Notifications Backend), #015 (Listing Detail Screen), #017 (Chat Screens)
> **Blocked by**: None (all dependencies complete)

---

## Overview

Enable buyers to make price offers on listings. Sellers can accept, reject, or counter-offer. The negotiation history is visible inline within the chat thread as special "offer" message types.

---

## Architecture Decision: Offers as a Separate Table with Chat Integration

### Why a separate `offers` table (not embedded in `messages`)?

1. **State machine integrity**: Offers have a lifecycle (PENDING -> ACCEPTED/REJECTED/COUNTERED/EXPIRED/WITHDRAWN). Tracking this in a freeform `messages.content` column would require parsing JSON and lose database-level integrity.
2. **Query patterns differ**: "Get all pending offers on my listings" and "auto-expire offers when listing sells" are relational queries that need proper columns and indexes, not JSON scanning.
3. **Concurrent offer handling**: Multiple buyers can have pending offers simultaneously. The seller needs a clean view of all active offers across conversations. A separate table with proper FK relationships enables this.
4. **Audit trail**: Offer amount, timestamp, who made it, and its resolution are business-critical data that deserve first-class columns.

### Chat integration approach

Each offer action (create, counter, accept, reject) ALSO inserts a message into the conversation with `type = 'OFFER'` and a `metadata` JSON column containing the offer ID and action. This gives the chat thread a complete chronological view without querying the offers table for rendering.

---

## 1. Database Schema Changes

### New Enum: `OfferStatus`

```prisma
enum OfferStatus {
  PENDING
  ACCEPTED
  REJECTED
  COUNTERED
  EXPIRED
  WITHDRAWN
}
```

### New Table: `offers`

```prisma
model Offer {
  id              String      @id @default(uuid())
  listingId       String      @map("listing_id")
  conversationId  String      @map("conversation_id")
  senderId        String      @map("sender_id")       // Who made this specific offer/counter
  amount          Decimal     @db.Decimal(10, 2)
  status          OfferStatus @default(PENDING)
  parentOfferId   String?     @map("parent_offer_id") // Links counter-offers to the original chain
  expiresAt       DateTime?   @map("expires_at")      // Optional auto-expiry (e.g., 48h)
  respondedAt     DateTime?   @map("responded_at")    // When status changed from PENDING
  createdAt       DateTime    @default(now()) @map("created_at")

  // Relations
  listing      Listing       @relation(fields: [listingId], references: [id])
  conversation Conversation  @relation(fields: [conversationId], references: [id])
  sender       User          @relation("OfferSender", fields: [senderId], references: [id])
  parentOffer  Offer?        @relation("OfferChain", fields: [parentOfferId], references: [id])
  counterOffers Offer[]      @relation("OfferChain")

  @@index([listingId, status])          // "All pending offers on this listing"
  @@index([conversationId])             // "Offer history for this chat"
  @@index([senderId])                   // "All offers I've made"
  @@index([expiresAt])                  // Expiry cron job
  @@map("offers")
}
```

### Modified Table: `messages`

Add a `type` enum and optional `metadata` JSON column:

```prisma
enum MessageType {
  TEXT
  OFFER
  SYSTEM
}

// Update Message model:
model Message {
  id             String      @id @default(uuid())
  conversationId String      @map("conversation_id")
  senderId       String      @map("sender_id")
  content        String
  type           MessageType @default(TEXT) @map("type")
  metadata       Json?       @map("metadata")  // For OFFER type: { offerId, action, amount }
  readAt         DateTime?   @map("read_at")
  createdAt      DateTime    @default(now()) @map("created_at")

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@index([senderId])
  @@map("messages")
}
```

### Modified Models (add relations)

```prisma
// Add to User model:
  offersSent Offer[] @relation("OfferSender")

// Add to Listing model:
  offers Offer[]

// Add to Conversation model:
  offers Offer[]
```

### Indexes Rationale

- `(listing_id, status)`: Seller dashboard query "show me all pending offers on listing X" and the bulk-expire query when a listing is sold.
- `(conversation_id)`: Render offer history within a chat thread.
- `(expires_at)`: Scheduled job to transition PENDING -> EXPIRED.

---

## 2. API Endpoints

### POST /api/v1/offers

**Auth required**: Yes
**Description**: Create a new offer or counter-offer on a listing.

**Request body**:
```json
{
  "listingId": "uuid",
  "amount": 45.00,
  "parentOfferId": "uuid | undefined"  // Set when counter-offering
}
```

**Business rules**:
- Buyer cannot offer on own listing (403)
- Listing must be ACTIVE (422 if SOLD/DELETED)
- If `parentOfferId` is set, that offer must be PENDING and addressed to the current user (i.e., buyer countering seller's counter, or seller countering buyer's offer)
- When a counter-offer is created, the parent offer transitions to COUNTERED
- A conversation is auto-created (or found) for `(listingId, buyerId)` -- reuses existing upsert logic
- A message with `type: OFFER` is auto-inserted into the conversation

**Response 201**:
```json
{
  "offer": {
    "id": "uuid",
    "listingId": "uuid",
    "conversationId": "uuid",
    "senderId": "uuid",
    "amount": "45.00",
    "status": "PENDING",
    "parentOfferId": "uuid | null",
    "expiresAt": "ISO 8601 | null",
    "createdAt": "ISO 8601"
  }
}
```

---

### PATCH /api/v1/offers/:id/respond

**Auth required**: Yes
**Description**: Accept or reject a pending offer.

**Request body**:
```json
{
  "action": "ACCEPT" | "REJECT"
}
```

**Business rules**:
- Only the recipient of the offer can respond (the person who did NOT send it, within the conversation)
- Offer must be in PENDING status (409 otherwise)
- On ACCEPT:
  - Offer status -> ACCEPTED
  - All other PENDING offers on the same listing -> EXPIRED (bulk update)
  - Listing status -> SOLD, listing.buyerId set to the buyer in the conversation
  - A message with `type: OFFER, metadata: { action: 'ACCEPTED', amount }` is inserted
  - Push notification to offer sender
- On REJECT:
  - Offer status -> REJECTED
  - A message with `type: OFFER, metadata: { action: 'REJECTED', amount }` is inserted
  - Push notification to offer sender

**Response 200**:
```json
{
  "offer": {
    "id": "uuid",
    "status": "ACCEPTED | REJECTED",
    "respondedAt": "ISO 8601"
  }
}
```

---

### DELETE /api/v1/offers/:id

**Auth required**: Yes
**Description**: Withdraw a pending offer (only the sender can do this).

**Business rules**:
- Only the offer sender can withdraw
- Offer must be PENDING
- Status -> WITHDRAWN
- Message with `type: OFFER, metadata: { action: 'WITHDRAWN' }` inserted

**Response 200**:
```json
{
  "success": true
}
```

---

### GET /api/v1/offers/listing/:listingId

**Auth required**: Yes
**Description**: Get all offers on a listing. Only the listing seller sees all offers; a buyer only sees their own offers.

**Response 200**:
```json
{
  "offers": [
    {
      "id": "uuid",
      "amount": "45.00",
      "status": "PENDING",
      "senderId": "uuid",
      "senderDisplayName": "string",
      "senderAvatarUrl": "string | null",
      "parentOfferId": "uuid | null",
      "expiresAt": "ISO 8601 | null",
      "createdAt": "ISO 8601",
      "respondedAt": "ISO 8601 | null"
    }
  ]
}
```

---

### GET /api/v1/offers/conversation/:conversationId

**Auth required**: Yes
**Description**: Get the offer chain for a specific conversation (for rendering inline in chat). Only participants can access.

**Response 200**:
```json
{
  "offers": [ /* same shape as above */ ],
  "latestPendingOffer": { /* the most recent PENDING offer, or null */ }
}
```

---

## 3. Socket.io Event Additions

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `new_offer` | Server -> Client | `{ offer, message }` | Emitted to `conversation:{id}` room when an offer/counter is created |
| `offer_response` | Server -> Client | `{ offer, message, listingStatus? }` | Emitted when an offer is accepted/rejected |
| `offer_withdrawn` | Server -> Client | `{ offerId, message }` | Emitted when sender withdraws |
| `offers_expired` | Server -> Client | `{ listingId, expiredOfferIds }` | Emitted when listing is sold and pending offers expire |

All offer events piggyback on the existing `conversation:{id}` room mechanism. No new room subscriptions needed.

---

## 4. Push Notifications

| Trigger | Recipient | Title | Body |
|---------|-----------|-------|------|
| New offer | Seller | "New offer on {listing.title}" | "{buyer.displayName} offered {amount}" |
| Counter-offer | Other party | "Counter-offer on {listing.title}" | "{sender.displayName} countered with {amount}" |
| Offer accepted | Offer sender | "Offer accepted!" | "Your offer of {amount} on {listing.title} was accepted" |
| Offer rejected | Offer sender | "Offer declined" | "Your offer on {listing.title} was declined" |

---

## 5. Mobile Screen/Component Changes

### ListingDetailScreen
- Add "Make an Offer" button alongside "Message Seller"
- Tapping opens a bottom sheet with price input (pre-filled with listing price), validation (must be > 0, cannot exceed 10x listing price as sanity check)
- Shows current offer status if user has a pending offer on this listing

### ChatThreadScreen
- Render `OFFER` type messages as rich cards:
  - Shows amount, sender name, and action buttons (Accept/Reject/Counter) for the recipient
  - Shows status badge (Pending/Accepted/Rejected/Expired/Withdrawn) for historical offers
- Counter-offer action opens inline price input within the chat
- Accept action shows confirmation dialog before proceeding

### New Component: `OfferCard`
- Reusable component for rendering offer messages in chat
- Props: `offer`, `isRecipient`, `onAccept`, `onReject`, `onCounter`
- States: pending (with action buttons), resolved (with status badge)

### New Component: `MakeOfferSheet`
- Bottom sheet with:
  - Listing price display (reference)
  - Price input field with currency formatting
  - "Send Offer" CTA button
  - Validation feedback

### ConversationListScreen
- Show offer status indicator on conversations with pending offers (small badge or subtitle)

### Navigation types update
- No new screens needed; offer flow is handled via bottom sheets and inline chat components

---

## 6. Offer Expiry Strategy

**Option chosen**: 48-hour auto-expiry with a scheduled check.

- When an offer is created, `expiresAt` is set to `now() + 48 hours`
- A cron job (or setInterval in the backend process) runs every 15 minutes:
  ```sql
  UPDATE offers SET status = 'EXPIRED', responded_at = now()
  WHERE status = 'PENDING' AND expires_at < now()
  RETURNING id, conversation_id;
  ```
- For each expired offer, emit `offer_expired` socket event and insert a SYSTEM message
- When a listing is marked SOLD (via any mechanism), all PENDING offers on it are bulk-expired immediately

---

## 7. Handling Concurrent Offers

- Multiple buyers CAN have pending offers simultaneously on the same listing
- A single buyer can only have ONE pending offer per listing at a time (enforced by application logic: creating a new offer when you have a pending one returns 409)
- When seller accepts one offer, all other pending offers on that listing are auto-expired
- Race condition protection: The accept transaction uses `SELECT ... FOR UPDATE` on the offer row to prevent double-acceptance

---

## 8. Implementation Order

| Phase | Task | Agent | Depends on |
|-------|------|-------|------------|
| 1 | Add `OfferStatus`, `MessageType` enums and `offers` table to Prisma schema; add `type`/`metadata` to `messages` | @database-expert | - |
| 2 | Run migration, verify schema | @database-expert | Phase 1 |
| 3 | Implement offer service (create, respond, withdraw, list, expire) | @backend-developer | Phase 2 |
| 4 | Implement offer controller + routes + validation (Zod schemas) | @backend-developer | Phase 3 |
| 5 | Add Socket.io offer events emission in offer service | @backend-developer | Phase 3 |
| 6 | Add push notification triggers for offer actions | @backend-developer | Phase 3 |
| 7 | Update ChatThreadScreen to render OFFER message types | @react-native-developer | Phase 4 |
| 8 | Implement OfferCard component | @react-native-developer | Phase 7 |
| 9 | Implement MakeOfferSheet bottom sheet | @react-native-developer | Phase 4 |
| 10 | Add "Make an Offer" button to ListingDetailScreen | @react-native-developer | Phase 9 |
| 11 | Wire Socket.io offer events to Zustand chat store | @react-native-developer | Phase 5, 7 |
| 12 | Add offer expiry cron/interval | @backend-developer | Phase 3 |
| 13 | Update shared types package | @backend-developer | Phase 1 |

---

## 9. Shared Types Additions (`packages/shared`)

```typescript
export enum OfferStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  COUNTERED = 'COUNTERED',
  EXPIRED = 'EXPIRED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum MessageType {
  TEXT = 'TEXT',
  OFFER = 'OFFER',
  SYSTEM = 'SYSTEM',
}

export interface Offer {
  id: string;
  listingId: string;
  conversationId: string;
  senderId: string;
  amount: string; // decimal as string
  status: OfferStatus;
  parentOfferId: string | null;
  expiresAt: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface OfferMessageMetadata {
  offerId: string;
  action: 'CREATED' | 'COUNTERED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED';
  amount: string;
}
```

---

## 10. Error Codes (new)

| HTTP | Code | Condition |
|------|------|-----------|
| 409 | `OFFER_ALREADY_PENDING` | Buyer already has a pending offer on this listing |
| 409 | `OFFER_NOT_PENDING` | Trying to respond to a non-pending offer |
| 403 | `NOT_OFFER_RECIPIENT` | Only the recipient can accept/reject |
| 403 | `NOT_OFFER_SENDER` | Only the sender can withdraw |
| 422 | `LISTING_NOT_ACTIVE` | Cannot make offer on SOLD/DELETED listing |

---

## 11. Trade-offs and Risks

| Decision | Trade-off |
|----------|-----------|
| Separate `offers` table | More schema complexity, but enables clean queries and state integrity |
| Duplicate info in messages (OFFER type) | Slight denormalization, but chat rendering does not need JOINs to offers table |
| 48h auto-expiry | Prevents stale offers cluttering the system; may annoy slow responders |
| One pending offer per buyer per listing | Simplifies UX but buyer must withdraw before re-offering a different amount |
| Accept auto-marks listing SOLD | Tight coupling between offer acceptance and listing lifecycle; seller cannot accept offer without selling |
