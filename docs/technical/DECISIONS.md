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
