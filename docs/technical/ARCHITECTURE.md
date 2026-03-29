# Architecture

> Last updated: 2026-03-29

## Overview

Marketplace is a mobile-first peer-to-peer marketplace application. Users discover, buy, and sell items based on GPS proximity. The system is invite-only to foster a trusted community.

**Stack**: React Native (Expo) mobile app, Node.js/Express backend, PostgreSQL (AWS RDS), Auth0 for authentication.

---

## C4: System Context

```
┌──────────────────────────────────────────────────────────┐
│                      Marketplace                         │
│                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐   │
│  │  Mobile   │───▶│   Backend    │───▶│  PostgreSQL   │   │
│  │  (Expo)   │    │  (Express)   │    │  (AWS RDS)    │   │
│  └──────────┘    └──────────────┘    └───────────────┘   │
│       │                │                                 │
│       │                │                                 │
│       ▼                ▼                                 │
│  ┌──────────┐    ┌──────────────┐                        │
│  │  Expo     │    │   Auth0      │                        │
│  │  Push     │    │   (IdP)      │                        │
│  └──────────┘    └──────────────┘                        │
└──────────────────────────────────────────────────────────┘
```

**External systems**:
- **Auth0** -- identity provider for user authentication (OAuth2 / JWT)
- **Expo Push Notifications** -- delivers push notifications to mobile devices
- **AWS S3** -- image storage for listing photos (planned)

---

## C4: Container Diagram

| Container | Technology | Purpose |
|-----------|-----------|---------|
| `apps/mobile` | React Native (Expo SDK 51) | iOS/Android client. Navigation, state management, camera/GPS access. |
| `apps/backend` | Node.js, Express, Prisma | REST API + WebSocket (Socket.io). Business logic, auth middleware, data access. |
| `packages/shared` | TypeScript (plain) | Shared type definitions consumed by both mobile and backend. |
| PostgreSQL | AWS RDS (PostgreSQL 15+) | Primary data store. PostGIS extension for geospatial queries. |

---

## Monorepo Structure

The project uses a **Yarn workspaces** monorepo (Yarn Classic v1) with the following layout:

```
marketplace/
  apps/
    mobile/          # Expo React Native app
    backend/         # Express API server
  packages/
    shared/          # Shared TypeScript types
  package.json       # Root: workspace definitions, shared dev tooling
  tsconfig.base.json # Shared TypeScript config (strict mode)
  .eslintrc.js       # Shared ESLint config
  .prettierrc        # Shared Prettier config
```

**Why Yarn Classic over Yarn Berry**: Expo SDK has known compatibility issues with Yarn Berry's PnP resolution. Using Yarn Classic with `node_modules` hoisting avoids these issues entirely. This is a deliberate trade-off: we lose Berry's stricter dependency isolation in exchange for zero Metro bundler compatibility issues.

**Cross-package references**: `apps/mobile` and `apps/backend` both depend on `@marketplace/shared` via workspace protocol (`"*"`). The shared package compiles to `dist/` with declaration files so consumers get full type information.

---

## Tooling

| Tool | Version | Purpose |
|------|---------|---------|
| TypeScript | ^5.4 | Language, strict mode enabled across all packages |
| ESLint | ^8.57 | Linting with `@typescript-eslint`, `prettier` integration |
| Prettier | ^3.2 | Code formatting (single quotes, trailing commas, 100 char width) |
| Prisma | ^5.0 | ORM and migration tool for PostgreSQL |

---

## Key Design Decisions

See [DECISIONS.md](./DECISIONS.md) for the full ADR log.

---

## Security Architecture

- **Authentication**: Auth0 handles identity. Backend validates JWTs on every request via `express-jwt` + `jwks-rsa`.
- **Authorization**: Route-level middleware checks resource ownership (e.g., only the seller can edit their listing).
- **Secrets**: Never committed to source. Managed via environment variables (`.env` files, excluded from git).
- **Data classification**: User PII (email, GPS coordinates) is considered sensitive. Listing data is public.

---

## Observability (Planned)

- Health check endpoint: `GET /health`
- Structured logging (to be configured in backend boilerplate task)
- Error tracking (TBD -- Sentry or similar)

---

## Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Availability | 99.9% | Single RDS instance initially; multi-AZ for production |
| API Latency | P95 < 500ms | Geospatial queries may need indexing attention |
| Data Retention | Indefinite | No regulatory requirement identified yet |
| RTO / RPO | 1h / 5min | Automated RDS backups with point-in-time recovery |
