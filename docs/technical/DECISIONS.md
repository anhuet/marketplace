# Architecture Decision Records

> Append new ADRs at the bottom. Once an ADR is Accepted, do not edit its body -- write a new ADR that supersedes it.

---

## ADR-001: Yarn Classic Monorepo with Workspaces

**Date**: 2026-03-29
**Status**: Accepted
**Deciders**: @systems-architect

### Context
The Marketplace project requires a monorepo containing a React Native (Expo) mobile app, a Node.js/Express backend, and a shared types package. We need a package manager that supports workspaces and is compatible with Expo's Metro bundler. The task spec noted we should evaluate Yarn Berry (v3+) with `nodeLinker: node-modules` vs Yarn Classic (v1).

### Options Considered
1. **Yarn Berry (v3+) with `nodeLinker: node-modules`**: Modern Yarn with PnP disabled for Expo compatibility. -- Pros: Stricter dependency resolution, better caching, plugin ecosystem. Cons: Extra configuration needed (`nodeLinker` setting), some Expo/Metro edge cases still reported, larger learning curve for contributors.
2. **Yarn Classic (v1) with workspaces**: Battle-tested workspace support with standard `node_modules` hoisting. -- Pros: Zero Expo compatibility issues, simple setup, widely understood. Cons: No PnP, no plugin system, slower installs than Berry with PnP.
3. **pnpm with workspaces**: Fast, disk-efficient package manager. -- Pros: Fastest installs, strict dependency isolation. Cons: Expo officially recommends Yarn or npm; pnpm symlink structure can cause issues with Metro bundler's module resolution.

### Decision
Use **Yarn Classic (v1)** with workspaces. The primary reason is maximum compatibility with Expo SDK 51 and Metro bundler. The project is early-stage and the team benefits more from zero-friction tooling than from Berry's advanced features. If Expo improves Berry/PnP support in a future SDK, we can revisit.

### Consequences
- **Positive**: No Metro bundler compatibility issues; simple, well-documented workspace setup; all contributors already familiar with Yarn Classic.
- **Negative**: We miss out on Yarn Berry's stricter dependency hoisting and plugin system; installs are slightly slower than Berry with PnP.
- **Neutral**: The workspace protocol (`"*"`) for cross-package references works identically in both Classic and Berry.

---

## ADR-002: Shared Types Package (`@marketplace/shared`)

**Date**: 2026-03-29
**Status**: Accepted
**Deciders**: @systems-architect

### Context
Both the mobile app and backend need to agree on the shape of API payloads and domain entities (User, Listing, Message, etc.). Without a shared source of truth, type definitions drift apart over time, causing runtime bugs that TypeScript was supposed to prevent.

### Options Considered
1. **Shared workspace package (`packages/shared`)**: A plain TypeScript package in the monorepo that both apps depend on. Compiled to `dist/` with declaration files. -- Pros: Single source of truth, compile-time guarantees, standard workspace dependency. Cons: Must be built before consumers can use it (or use `ts-node`/path aliases); adds a build step.
2. **Copy-paste types in each app**: Each app maintains its own type definitions. -- Pros: No build dependency, simpler initial setup. Cons: Types drift over time; no compile-time guarantee of consistency; violates DRY.
3. **Code generation from Prisma schema**: Auto-generate shared types from the database schema. -- Pros: Types always match the DB; zero manual maintenance. Cons: API response shapes often differ from DB rows (computed fields, nested relations, pagination wrappers); still need manual types for those differences.

### Decision
Use a **shared workspace package** (`@marketplace/shared`). It is compiled to JavaScript with declaration files so both Metro (mobile) and Node.js (backend) can consume it. Types are manually authored to represent API contract shapes, not database rows -- this gives us freedom to shape the API independently from the schema.

### Consequences
- **Positive**: Single source of truth for all shared types; TypeScript catches contract mismatches at compile time; clean separation of API types from DB models.
- **Negative**: The shared package must be built before running dependent apps (mitigated by workspace-level build scripts). Adding a new type requires touching the shared package and rebuilding.
- **Neutral**: Prisma-generated types in the backend remain separate from shared API types. The backend is responsible for mapping between them.

---

## ADR-003: ECS Fargate for Backend Compute

**Date**: 2026-03-30
**Status**: Accepted
**Deciders**: @systems-architect

### Context
The Marketplace backend (Node.js/Express) needs a compute platform on AWS. The team is small, the product is pre-launch, and operational overhead should be minimised. The backend is stateless (session state lives in Auth0 JWTs; chat state is in PostgreSQL) which gives us flexibility in how we run it. We need the compute layer to sit in private subnets behind an ALB and to pull secrets from Secrets Manager at startup.

### Options Considered
1. **ECS Fargate**: Serverless container orchestration — no EC2 instances to manage. -- Pros: Zero server patching, automatic bin-packing, simple horizontal scaling (change desired count), integrates natively with ALB and Secrets Manager, pay-per-second for running tasks. Cons: Cold start on scale-out (~30s for a new task), slightly higher per-vCPU cost than reserved EC2, no SSH access for debugging (must rely on CloudWatch Logs and ECS Exec).
2. **EC2 with Docker + Nginx reverse proxy**: One or more EC2 instances running Docker containers behind an ALB. -- Pros: Lower per-hour cost at sustained utilisation, SSH access for debugging, full OS control. Cons: Requires AMI patching, auto-scaling group configuration, instance health management, manual capacity planning — significant operational burden for a small team.
3. **AWS Lambda + API Gateway**: Serverless functions, one per route or grouped by domain. -- Pros: True pay-per-invocation, zero idle cost, automatic scaling. Cons: Express does not map cleanly to Lambda without an adapter (e.g. serverless-http); Socket.io (real-time chat) is incompatible with Lambda's request/response model; cold starts on every invocation affect P95 latency; 15-minute execution limit.

### Decision
Use **ECS Fargate**. The primary reasons are: (1) the backend uses long-lived WebSocket connections for real-time chat, which rules out Lambda; (2) Fargate eliminates all OS-level operations while still running a standard Docker container, which matches the team's capacity; (3) the cost difference vs. EC2 is negligible at staging scale and acceptable at early production scale.

### Consequences
- **Positive**: No server patching or AMI management; horizontal scaling is a single parameter change; native ALB and Secrets Manager integration; container image is portable to any Docker runtime if we ever leave AWS.
- **Negative**: Higher per-vCPU cost than reserved EC2 at sustained high utilisation (revisit if monthly Fargate bill exceeds ~$200). No SSH access — debugging requires CloudWatch Logs, ECS Exec, or X-Ray. Cold start on scale-out adds ~30s before a new task is healthy.
- **Neutral**: The Docker image and health check contract are the same regardless of whether we run on Fargate or EC2, so switching later is low-effort.

---

## ADR-004: S3 Presigned URLs for Image Upload and Retrieval

**Date**: 2026-03-30
**Status**: Accepted
**Deciders**: @systems-architect

### Context
Listing images need to be stored durably and served to mobile clients. The backend must accept image uploads (up to 8 per listing, max 10 MB each) and serve them for display. We need to choose an access pattern for S3 that balances security, performance, and implementation complexity.

### Options Considered
1. **Presigned URLs (PUT for upload, GET for download)**: The backend generates short-lived signed URLs that the mobile client uses to upload directly to S3 and to fetch images. The S3 bucket blocks all public access. -- Pros: Upload traffic bypasses the backend (saves bandwidth and CPU); bucket is fully private; fine-grained expiry control; works with any HTTP client. Cons: Two-step upload flow (request URL from backend, then PUT to S3); client must handle S3 errors; URL expiry means cached URLs become stale (mitigated by generating fresh URLs or using longer TTLs for GET).
2. **Public-read ACL on objects**: Backend uploads to S3 on behalf of the client, sets public-read ACL, and stores the public URL. -- Pros: Simple GET — any client can fetch the image without authentication; no URL expiry. Cons: Images are permanently public; no way to revoke access after a listing is deleted; bucket cannot use BlockAllPublicAccess; upload still flows through the backend (bandwidth cost).
3. **CloudFront + S3 Origin Access Identity**: Serve images via CloudFront CDN with S3 as a private origin. -- Pros: Low-latency global delivery via edge caches; S3 stays private; signed cookies or URLs for access control. Cons: Adds CloudFront distribution cost and configuration complexity; overkill for a staging/early-production app with a single-region user base; does not eliminate the need for presigned upload URLs.

### Decision
Use **presigned URLs** for both upload and download. The S3 bucket uses `BlockAllPublicAccess`. The backend generates PUT presigned URLs (5-minute TTL) when a listing is created or updated, and GET presigned URLs (1-hour TTL) when listing data is fetched. This keeps the bucket fully private, offloads upload bandwidth from the backend, and avoids CloudFront complexity at this stage.

### Consequences
- **Positive**: S3 bucket is fully private — no risk of accidental public exposure; upload traffic goes directly from the mobile client to S3, reducing backend bandwidth and latency; presigned URLs work with any HTTP client without SDK dependencies on the mobile side.
- **Negative**: GET URLs expire, so cached listing data may contain stale image URLs. Mitigation: use a 1-hour TTL for GET URLs and refresh on each API response. If global latency becomes an issue, CloudFront can be layered in front without changing the S3 bucket configuration (additive change).
- **Neutral**: The backend needs `s3:PutObject` and `s3:GetObject` permissions on the bucket, which are granted via the CDK stack's `grantReadWrite` call on the ECS task role.

---

## ADR-005: Price Negotiation as Separate Offers Table with Chat Message Integration

**Date**: 2026-05-04
**Status**: Proposed
**Deciders**: @systems-architect (awaiting human approval)

### Context
The product needs a "Make an Offer" feature where buyers propose prices on listings, and sellers can accept, reject, or counter-offer. The negotiation history should be visible within the existing chat thread. The key design question is whether offers should be stored as structured records in their own table or embedded as JSON within the existing `messages` table.

The existing system has: conversations scoped to `(listing_id, buyer_id)`, messages with `content` text field, and Socket.io real-time delivery per conversation room. Multiple buyers may negotiate on the same listing simultaneously.

### Options Considered
1. **Separate `offers` table + OFFER-type messages in chat**: A dedicated `offers` table with proper columns for amount, status (state machine), sender, expiry, and parent-offer chain. Each offer action also inserts a message with `type = 'OFFER'` and a `metadata` JSON column into the conversation for chronological rendering. -- Pros: Database-level integrity for offer state machine; efficient queries for "all pending offers on listing X" and "expire all pending offers"; clean separation of concerns; audit trail with proper indexes. Cons: Two writes per offer action (offers table + messages table); slight denormalization of amount in both places; more schema complexity.
2. **Offers embedded in messages only (JSON metadata)**: Store all offer data in the `messages.metadata` JSON column. No separate table. Offer state is tracked by looking at the sequence of OFFER messages in a conversation. -- Pros: Simpler schema (no new table); single write path; chat history IS the offer history. Cons: No database-level state machine (must scan messages to determine current offer status); "get all pending offers on listing X" requires scanning all messages across all conversations; no FK relationships; race conditions harder to prevent without a dedicated row to lock; JSON queries are slower than indexed columns.
3. **Offers table only, no chat integration**: Offers as a separate system that does not appear in the chat thread. Users view offers in a dedicated "Offers" tab or section. -- Pros: Complete separation; no coupling between chat and negotiation. Cons: Poor UX -- users must check two places; loses conversational context; negotiation feels disconnected from the relationship-building chat.

### Decision
**Option 1: Separate `offers` table with OFFER-type chat messages.** The primary reasons are: (1) offers have a state machine (PENDING/ACCEPTED/REJECTED/COUNTERED/EXPIRED/WITHDRAWN) that requires database-level integrity and indexed queries; (2) the seller needs efficient access to "all pending offers on my listing" which is impossible to query efficiently from JSON in messages; (3) race conditions on offer acceptance (two buyers' offers accepted simultaneously) are prevented by row-level locking on the offers table; (4) the dual-write (offers table + message) cost is negligible compared to the querying and integrity benefits.

### Consequences
- **Positive**: Clean state machine with indexed status column; efficient seller dashboard queries; row-level locking prevents double-acceptance; offer history survives even if messages are cleared; chat thread shows full negotiation chronologically without extra queries.
- **Negative**: Two writes per offer action (mitigated by wrapping in a transaction); `messages` table gains `type` and `metadata` columns which slightly increase row size for all messages; more Prisma schema complexity.
- **Neutral**: Existing chat rendering code must be updated to handle the new `OFFER` message type, but this is a one-time change that does not affect TEXT message rendering.

---

## ADR-006: Similar Items via Rule-Based SQL Query (No Search Service)

**Date**: 2026-05-04
**Status**: Proposed
**Deciders**: @systems-architect (awaiting human approval)

### Context
The listing detail screen needs a "Similar Items" section showing 4-6 related listings. Similarity is defined as: same category, nearby location (within configurable radius), and similar price (+/-30% by default). The system already has a Haversine-based discovery endpoint and indexes on `(latitude, longitude)`, `status`, and `category_id`.

### Options Considered
1. **Rule-based SQL query reusing existing Haversine pattern**: A single endpoint that queries PostgreSQL with category filter, price range filter, and bounding-box + Haversine distance calculation. Results cached in-memory with 5-minute TTL. Fallback strategy progressively relaxes filters if too few results. -- Pros: Zero new infrastructure; reuses proven query pattern; existing indexes sufficient; in-memory cache avoids repeated DB hits; predictable latency (<80ms cold, <5ms cached). Cons: No semantic similarity (items must be in same category); no personalization; cache is per-process (not shared across ECS tasks).
2. **Elasticsearch/OpenSearch for similarity**: Index listings in a search service; use `more_like_this` query or vector similarity. -- Pros: Semantic similarity across categories; could incorporate user behavior signals; powerful relevance tuning. Cons: Adds a new infrastructure dependency ($50-100/month minimum for managed OpenSearch); requires sync pipeline from PostgreSQL; operational complexity for a feature showing 6 items; overkill for current scale.
3. **Collaborative filtering ("users who viewed X also viewed Y")**: Track listing view events; compute co-occurrence matrix; recommend based on viewing patterns. -- Pros: Discovers non-obvious similarities; improves with usage data. Cons: Requires event tracking infrastructure not yet built; cold-start problem (no data for new listings); needs batch processing pipeline; months of development for uncertain payoff at current user count.

### Decision
**Option 1: Rule-based SQL query.** The primary reasons are: (1) the feature's success criteria are modest (show 4-6 relevant alternatives); (2) the existing Haversine query pattern and indexes handle this with zero infrastructure addition; (3) category + proximity + price range covers 90% of what users mean by "similar" in a local marketplace context; (4) complexity can be added later (Elasticsearch, collaborative filtering) as a non-breaking enhancement once the product has enough users to justify the investment.

### Consequences
- **Positive**: Zero infrastructure cost; ships in days not weeks; predictable query performance; no new operational burden; fallback strategy ensures the section is populated in most cases.
- **Negative**: Cannot find cross-category similarities (an iPhone case is not "similar" to an iPhone); no personalization; in-memory cache does not share across multiple ECS tasks (acceptable at current single-task scale).
- **Neutral**: The endpoint contract (`GET /api/v1/listings/:id/similar`) is stable regardless of the underlying implementation. Swapping to Elasticsearch later requires only a service-layer change, not an API change.

---

## ADR-007: Auth0 user_metadata as Source of Truth for Profile Fields

**Date**: 2026-05-26
**Status**: Rejected — superseded by [ADR-008](#adr-008-rds-as-source-of-truth-for-profile-fields-supersedes-adr-007)
**Deciders**: @systems-architect

> **Update 2026-05-26**: This decision was reversed the same day after implementation review. The Auth0 Management API integration was removed; RDS is now the source of truth. See ADR-008 for the rationale. Body retained below for historical context.

### Context
After launch, users complained that displayName defaulted to their email prefix (a PII leak risk). The fix required a decision about where the canonical profile data lives: in our database, in Auth0 user_metadata, or both with one as master.

### Options Considered
1. **Auth0 user_metadata as master, our DB caches the value** (chosen) — Pros: Single source of truth across all auth-aware systems; future SSO/social providers can pre-populate user_metadata; profile data survives a DB wipe (or migration to a different DB); Auth0 is the identity system, so profile should live there. Cons: Extra Auth0 API call on every profile write; Management API rate limits apply (2 req/s per tenant on free tier, higher on paid plans); our DB must be reconciled if Auth0 metadata is edited directly via the Auth0 dashboard; outages in Auth0 Management API prevent profile edits (though reads are unaffected since we cache).
2. **Our DB as master, mirror to Auth0 best-effort** — Pros: Simpler write path; no external dependency for save success. Cons: Auth0 drifts silently if mirror fails; profile data is not portable if we change identity providers; can't use Auth0 metadata in rules/actions reliably.
3. **DB only, ignore Auth0 metadata** — Pros: Simplest, no external calls. Cons: Locks us out of Auth0 features (rules, actions, social providers that read user_metadata); profile data isn't portable across identity provider changes.

### Decision
**Option 1: Auth0 user_metadata is the master for `name` and `picture`.** Our database stores them as a cache for fast queries (listing cards, chat, reviews) without hitting Auth0 on every read. Case-insensitive uniqueness is enforced in our DB via a partial unique index on `display_name_lower`, checked before the Auth0 write. If the Auth0 write fails, our DB is not modified (Auth0 stays master). Avatar uploads land in S3 first, then the URL is written to Auth0, then cached in our DB.

The `needsDisplayNameSetup` flag is a local state machine in our DB — it tracks whether the user must complete ProfileSetup before using the app. When set, it overrides any cached displayName for UI routing purposes.

### Consequences
- **Positive**: Profile is portable across identity events; future SSO providers can pre-populate user_metadata; clearer security boundary (PII lives in the identity provider, not in our app DB as master); Auth0 user_metadata is available in Auth0 rules and actions for future workflows.
- **Negative**: Write path now requires Auth0 Management API availability — outages prevent profile edits (read path is unaffected since we cache). Free-tier rate limit (2 req/s) must be monitored if traffic grows; will need paid Auth0 plan if this becomes a bottleneck. Developers updating profile fields must use the controller helpers, not write directly to Prisma — this is a code-review discipline, not enforced by the schema.
- **Neutral**: The `display_name_lower` partial unique index and `needsDisplayNameSetup` flag are DB-only concerns for local state management; Auth0 doesn't know about them.

---

## ADR-008: RDS as Source of Truth for Profile Fields (supersedes ADR-007)

**Date**: 2026-05-26
**Status**: Accepted
**Deciders**: @systems-architect

### Context
ADR-007 set Auth0 user_metadata as the source of truth for `displayName` and `avatarUrl`, with our RDS database as a cache. After implementation, a review surfaced that the costs (extra ~400ms latency per profile write from the Auth0 Management API round-trip, free-tier rate limit of 2 req/s per tenant, ~200 extra lines of code for token caching, error mapping, and best-effort S3 cleanup on Auth0 failures) were not justified by the benefits for the current product stage. We do not currently use Auth0 Rules/Actions that read `user_metadata`, we do not have multiple apps sharing the Auth0 tenant, we do not have social login providers that pre-populate metadata, and we have no compliance requirement to separate identity data from app data.

### Options Considered
1. **Keep Auth0 user_metadata as master** (ADR-007 status quo) — Pros: portable across identity-provider changes; future SSO providers could pre-populate. Cons: 200–500ms write latency on every profile change; rate-limit risk; extra code complexity; Auth0 Management API outage blocks profile edits — none of these benefits are realized today.
2. **RDS as master, no Auth0 sync** (chosen) — Pros: simple write path (~20ms); no external dependency for profile writes; less code to maintain; aligns with the rest of our data model where RDS is authoritative. Cons: profile data is not portable across identity providers without a migration step; cannot use Auth0 Rules/Actions to read these fields without adding a sync job later.
3. **RDS as master with best-effort Auth0 mirror** — Pros: get the portability benefit. Cons: mirror failures cause silent drift between RDS and Auth0; debugging Auth0-dashboard vs RDS mismatches is painful — not worth it without a concrete consumer of Auth0-side reads.

### Decision
**Option 2: RDS is the source of truth for `display_name` and `avatar_url`.** Auth0 returns to its original role: identity provider only (login, JWT validation). Case-insensitive uniqueness is enforced via the partial unique index on `users.display_name_lower`. Avatar uploads land in S3 and the URL is stored directly on `users.avatar_url`. The `auth0ManagementService` and the three `AUTH0_MGMT_*` environment variables have been removed. The mobile app no longer handles a 502 `AUTH0_UPDATE_FAILED` error. We retain the option to add Auth0 metadata sync later as an additive change if a concrete need arises — e.g. enabling Auth0 Actions, adding social login with pre-populated profile, or splitting the app across multiple Auth0 clients.

### Consequences
- **Positive**: Simpler code path, lower latency on profile writes, no Auth0 rate-limit concerns, no dependency on Auth0 Management API uptime for profile edits.
- **Negative**: Profile data is not portable across identity providers without a migration. If we ever adopt social login providers that pre-populate name/picture, we will need to write a one-way sync from Auth0 → our DB at first-login time.
- **Neutral**: The `display_name_lower` partial unique index, the `needs_display_name_setup` flag, and the new `GET /users/check-displayname` + `POST /users/me/avatar` endpoints (originally introduced in ADR-007) are all retained — they remain valuable independent of the Auth0-master question.
