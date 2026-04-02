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
