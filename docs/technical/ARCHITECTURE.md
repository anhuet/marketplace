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

## Frontend Architecture

### Mobile App (React Native / Expo)

**Navigation**: React Navigation v6 — root stack navigator conditionally renders the Auth Stack (unauthenticated) or the Main Bottom Tab Navigator (authenticated). Each tab hosts its own nested stack navigator.

**UX design specification**: See [`docs/content/UX_DESIGN_SPEC.md`](../content/UX_DESIGN_SPEC.md) for the complete screen-by-screen UX specification, design token reference, component library, and interaction pattern documentation. This is the input contract for all mobile screen implementation tasks (#013–#018).

**State management**: Zustand (global auth store, user profile cache). React Query (or equivalent) for server-state caching of listings and conversations.

**Real-time**: Socket.io client connects to the backend WebSocket server for live chat message delivery.

---

## Design System

### Color Tokens

| Token | Light value | Dark value | Usage |
|-------|-------------|------------|-------|
| `--color-primary` | `#A2C2E1` | `#5A8EB8` | Brand accents, highlights |
| `--color-primary-dark` | `#2D4B6B` | `#7BAED6` | CTA buttons, active states |
| `--color-secondary` | `#76777A` | `#A0A0A3` | Secondary text, inactive icons |
| `--color-tertiary` | `#6E7691` | `#9698B0` | Subtle labels, metadata |
| `--color-bg` | `#F8F9FA` | `#111418` | Screen backgrounds |
| `--color-surface` | `#FFFFFF` | `#1E2329` | Cards, inputs, bottom sheets |
| `--color-error` | `#E53E3E` | `#FC8181` | Errors, destructive actions |
| `--color-success` | `#38A169` | `#68D391` | Success states |
| `--color-text-primary` | `#1A202C` | `#F7FAFC` | Body text, headings |
| `--color-text-secondary` | `#718096` | `#A0AEC0` | Labels, placeholders |

### Key Component Tokens

- **Button border-radius**: 28pt (pill)
- **Card border-radius**: 12pt
- **Input border-radius**: 12pt
- **Bottom sheet top radius**: 20pt
- **Spacing base unit**: 4pt (scale: 4, 8, 12, 16, 20, 24, 32, 48, 64)

Full token reference, component specs, and interaction patterns: [`docs/content/UX_DESIGN_SPEC.md`](../content/UX_DESIGN_SPEC.md).

---

## Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Availability | 99.9% | Single RDS instance initially; multi-AZ for production |
| API Latency | P95 < 500ms | Geospatial queries may need indexing attention |
| Data Retention | Indefinite | No regulatory requirement identified yet |
| RTO / RPO | 1h / 5min | Automated RDS backups with point-in-time recovery |

---

## Mobile Architecture

> Owner: @react-native-developer — Last updated: 2026-03-30

### Directory Structure

```
apps/mobile/
  App.tsx                          # Entry point — GestureHandlerRootView + SafeAreaProvider + RootNavigator
  src/
    lib/
      api.ts                       # Axios instance + typed API functions (authApi, listingsApi, conversationsApi, …)
      socket.ts                    # Socket.io client — connect/disconnect/join helpers
    navigation/
      types.ts                     # All typed param lists (AuthStack, BrowseStack, SearchStack, SellStack, ProfileStack, MainTabs, RootStack)
      AuthNavigator.tsx            # NativeStackNavigator for Auth stack (Login, Signup, ProfileSetup)
      MainNavigator.tsx            # BottomTabNavigator + nested NativeStackNavigators per tab
      RootNavigator.tsx            # NavigationContainer — switches Auth ↔ Main on auth state change; manages socket lifecycle
    screens/
      auth/                        # LoginScreen, SignupScreen, ProfileSetupScreen
      browse/                      # BrowseScreen, ListingDetailScreen
      chat/                        # ChatThreadScreen, ConversationListScreen
      profile/                     # ProfileScreen, EditProfileScreen, SettingsScreen, UserProfileScreen
      search/                      # SearchScreen
      sell/                        # PostListingScreen
    store/
      authStore.ts                 # Zustand store — user, token, isAuthenticated; persisted via AsyncStorage
      chatStore.ts                 # Zustand store — conversations, messages, unreadCount
    theme/
      tokens.ts                    # Design tokens: colors, spacing, radius, typography
```

### Navigation Architecture

The app uses a two-root pattern via a `RootStackParamList`:

- **Unauthenticated**: Auth Stack — Login → Signup → ProfileSetup (invite code redemption)
- **Authenticated**: Main Bottom Tabs — Home (Browse), Search, Sell (modal), Profile

All navigator screens are fully typed via `RootStackParamList`, `AuthStackParamList`, `BrowseStackParamList`, `SearchStackParamList`, `SellStackParamList`, and `ProfileStackParamList`. Screen components receive typed props via `NativeStackScreenProps<T>` and `CompositeScreenProps<T, U>`.

ChatThreadScreen is reachable from both the Browse stack (via ListingDetail → "Message Seller") and the Profile stack (via ConversationList). Each stack hosts its own instance of the component.

### State Management

| Concern | Tool | Notes |
|---------|------|-------|
| Auth session (user, token) | Zustand + AsyncStorage persist | Rehydrates on app launch; `isAuthenticated` derived on rehydration |
| Chat data (conversations, messages) | Zustand in-memory | Populated by API responses and socket events |
| Server data (listings, nearby feed) | React Query (tasks #014–#018) | Not yet scaffolded |
| Form state | React Hook Form + Zod | Wired in auth and listing screens (tasks #013, #016) |

### API Client

`src/lib/api.ts` exports an Axios instance (`apiClient`) pre-configured with:
- Base URL from `EXPO_PUBLIC_API_URL` environment variable
- `Authorization: Bearer <token>` header injected via request interceptor (reads from Zustand store)
- 401 response interceptor that calls `clearAuth()` to force re-login

Named API groups (`authApi`, `invitesApi`, `listingsApi`, `conversationsApi`, `reviewsApi`, `pushApi`) are exported alongside the raw client for typed call sites in screens.

### Real-Time (Socket.io)

`src/lib/socket.ts` manages a singleton Socket.io connection:
- `connectSocket(token)` — creates or returns the existing connected socket, passes `{ auth: { token } }` for server-side JWT verification
- `disconnectSocket()` — tears down the socket; called on logout
- `joinConversationRoom(conversationId)` — emits `join_conversation` to subscribe to a chat room
- The `RootNavigator` owns the socket lifecycle via `useEffect` watching `isAuthenticated` and `token`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Backend base URL including `/api/v1` path (e.g. `http://localhost:3000/api/v1`). Exposed to the JS bundle by Expo's public env var convention. |

### Key Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `expo` | ~51.0.0 | Expo SDK — managed workflow |
| `react-navigation/native-stack` | ^6.9.0 | Primary navigation (native transitions) |
| `react-navigation/bottom-tabs` | ^6.5.0 | Tab bar navigator |
| `zustand` | ^4.5.0 | Global client state |
| `axios` | ^1.6.0 | HTTP client |
| `socket.io-client` | ^4.7.0 | Real-time WebSocket |
| `react-native-auth0` | ^3.1.0 | Auth0 login/logout SDK |
| `react-hook-form` + `zod` | ^7 / ^3 | Form management + validation |
| `expo-location` | ~17.0.0 | GPS coordinates for listing creation and browse feed |
| `expo-notifications` | ~0.28.0 | Expo push token registration and foreground notification handling |
| `expo-image-picker` | ~15.0.0 | Camera roll / camera access for listing photos |
| `react-native-gesture-handler` | ~2.16.0 | Required peer for React Navigation; wraps app root |
| `react-native-safe-area-context` | 4.10.1 | Safe area insets for notch/home-indicator handling |

---

## AWS Infrastructure

> Owner: @systems-architect -- Last updated: 2026-03-30

### Region and Environment

- **Region**: eu-west-1 (Ireland)
- **Environments**: `staging` (current), `production` (planned)
- **IaC tool**: AWS CDK (TypeScript) -- code in `infra/`

### C4: Deployment Diagram

```
Internet
   │
   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  AWS eu-west-1                                                       │
│                                                                      │
│  ┌─── Public Subnets (2 AZs) ───────────────────────────────────┐   │
│  │                                                               │   │
│  │   ┌───────────────────────┐                                   │   │
│  │   │  Application Load     │  ← HTTPS (443) / HTTP (80)       │   │
│  │   │  Balancer (ALB)       │                                   │   │
│  │   └───────────┬───────────┘                                   │   │
│  └───────────────┼───────────────────────────────────────────────┘   │
│                  │ :3000                                             │
│  ┌─── Private Subnets (with NAT) ───────────────────────────────┐   │
│  │               ▼                                               │   │
│  │   ┌───────────────────────┐                                   │   │
│  │   │  ECS Fargate Service  │  ← Node.js/Express container     │   │
│  │   │  (marketplace-backend)│                                   │   │
│  │   └───────────┬───────────┘                                   │   │
│  └───────────────┼───────────────────────────────────────────────┘   │
│                  │ :5432                                             │
│  ┌─── Isolated Subnets (no internet) ───────────────────────────┐   │
│  │               ▼                                               │   │
│  │   ┌───────────────────────┐                                   │   │
│  │   │  RDS PostgreSQL 15    │  ← db.t3.micro (staging)         │   │
│  │   │  (single AZ)         │    encrypted at rest              │   │
│  │   └───────────────────────┘                                   │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌── Other Services ─────────────────────────────────────────────┐   │
│  │   S3 Bucket (listing images)    ← presigned URL access only   │   │
│  │   Secrets Manager               ← DB creds + Auth0 secrets   │   │
│  │   CloudWatch Logs               ← container logs (30d)       │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### VPC Topology

The VPC (`10.0.0.0/16`) spans 2 Availability Zones with three subnet tiers:

| Tier | Subnet type | CIDR mask | Purpose | Internet access |
|------|-------------|-----------|---------|-----------------|
| Public | `PUBLIC` | /24 | ALB | Direct (IGW) |
| Private | `PRIVATE_WITH_EGRESS` | /24 | ECS Fargate tasks | Outbound only (NAT Gateway) |
| Isolated | `PRIVATE_ISOLATED` | /24 | RDS PostgreSQL | None |

**NAT Gateways**: 1 (staging cost optimisation). Production should use 2 (one per AZ) for availability.

### Security Groups

| Security Group | Inbound rules | Outbound |
|----------------|--------------|----------|
| ALB SG | TCP 443 from `0.0.0.0/0`, TCP 80 from `0.0.0.0/0` | All |
| ECS SG | TCP 3000 from ALB SG only | All (needs NAT for ECR, S3, Secrets Manager) |
| RDS SG | TCP 5432 from ECS SG only | None |

### RDS PostgreSQL

- **Engine**: PostgreSQL 15
- **Instance class**: `db.t3.micro` (staging), upgrade path to `db.t3.small`+ for production
- **Storage**: 20 GB, auto-scaling to 50 GB, encrypted (AES-256)
- **Multi-AZ**: Off (staging); enable for production
- **Backups**: Automated, 7-day retention, point-in-time recovery
- **Deletion protection**: Off (staging), on (production)
- **PostGIS**: Can be enabled via `CREATE EXTENSION postgis;` on the RDS instance when needed

### ECS Fargate

- **Cluster**: `marketplace-{environment}`
- **Task definition**: 0.25 vCPU / 512 MB (staging)
- **Desired count**: 1 (staging), scale horizontally for production
- **Container image**: Built from `apps/backend/Dockerfile` (multi-stage build)
- **Health check**: `GET /api/v1/health` via ALB target group
- **Container insights**: Enabled
- **Log group**: `/marketplace/{environment}/backend` (30-day retention)

### S3 Image Bucket

- **Bucket name**: `marketplace-images-{environment}-{accountId}`
- **Access**: Block all public access; backend generates presigned URLs for upload (PUT) and download (GET)
- **CORS**: All origins allowed (mobile app uses presigned URLs directly)
- **Encryption**: S3-managed (SSE-S3)
- **Lifecycle**: Abort incomplete multipart uploads after 1 day

### Secrets Management

All secrets are stored in AWS Secrets Manager -- never in source control or environment files committed to git.

| Secret | Path | Contents |
|--------|------|----------|
| Database credentials | `marketplace/{env}/db-credentials` | host, port, username, password, dbname (auto-generated by CDK) |
| Application secrets | `marketplace/{env}/app-secrets` | AUTH0_DOMAIN, AUTH0_AUDIENCE (manually populated before first deploy) |

Secrets are injected into ECS tasks as environment variables via the `secrets` property on the container definition.

### Prisma Migrations

Prisma migrations are applied as a separate step before or during deployment:

1. **CI/CD approach** (recommended): Run `npx prisma migrate deploy` in a short-lived ECS task or CodeBuild step that has network access to the RDS instance (same VPC, same ECS security group).
2. **Init container approach**: Add a sidecar or init script in the Dockerfile that runs migrations before starting the server. Suitable for simple deployments but couples migration and app lifecycle.

The RDS security group permits connections from the ECS security group, so any task running in the private subnets with the ECS SG attached can reach the database.

### CDK Stack Structure

| Stack | Resources | Depends on |
|-------|-----------|------------|
| `Marketplace-{env}-Network` | VPC, subnets, NAT Gateway, security groups | -- |
| `Marketplace-{env}-App` | RDS, ECS cluster + Fargate service, ALB, S3 bucket, Secrets Manager | Network stack |

### Deployment

```bash
# From the infra/ directory:
cd infra && npm install
npx cdk bootstrap   # First time only — provisions CDK toolkit stack
npx cdk synth        # Validate and synthesize CloudFormation templates
npx cdk deploy --all # Deploy both stacks
```

### Cost Estimate (Staging)

| Resource | Estimated monthly cost (eu-west-1) |
|----------|-----------------------------------|
| NAT Gateway | ~$32 + data transfer |
| RDS db.t3.micro | ~$15 |
| ECS Fargate (0.25 vCPU / 512 MB, 1 task) | ~$9 |
| ALB | ~$16 + LCU charges |
| S3 | < $1 (low volume) |
| Secrets Manager | < $1 |
| **Total** | **~$75/month** |
