---
id: "002"
title: "Set up monorepo workspace: yarn workspaces, TypeScript configs, shared types package, Prettier + ESLint"
status: "completed"
area: "setup"
agent: "@systems-architect"
priority: "high"
created_at: "2026-03-29"
due_date: null
started_at: "2026-03-29"
completed_at: "2026-03-29"
prd_refs: []
blocks: ["003", "012"]
blocked_by: []
---

## Description

Initialise the yarn monorepo with workspaces for `apps/mobile`, `apps/backend`, and `packages/shared`. Configure root-level TypeScript, Prettier, and ESLint so all packages share consistent tooling. The `packages/shared` package should export a base set of TypeScript types (User, Listing, Message, etc.) that both the mobile app and backend can import. This task is foundational — no implementation work can start without it.

## Acceptance Criteria

- [x] Root `package.json` defines yarn workspaces pointing to `apps/*` and `packages/*`
- [x] `packages/shared` package is importable by both `apps/mobile` and `apps/backend` (verified with a test import)
- [x] `packages/shared/src/types/index.ts` exports baseline types for User, Listing, Message, Conversation, and Review matching the agreed schema
- [x] Root `.prettierrc` and `.eslintrc` (or `eslint.config.js`) are in place and `yarn lint` runs clean across all packages
- [x] Each package has its own `tsconfig.json` extending a root `tsconfig.base.json` with `strict: true`
- [x] `yarn build` (or `yarn workspaces run build`) completes without TypeScript errors

## Technical Notes

- Yarn version: use Yarn 3+ (Berry) with `nodeLinker: node-modules` for Expo compatibility, or Yarn 1 classic — confirm which version Expo SDK supports before choosing. Document the decision.
- `packages/shared` should be a plain TypeScript package (no framework) compiled to `dist/` with declaration files.
- Mobile app uses Expo — do not add `"type": "module"` to the root `package.json` as it can break Metro bundler resolution.
- ESLint config should include `@typescript-eslint` and rules consistent with CLAUDE.md code style (strict, no `console.log`, no commented-out code).

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
| 2026-03-29 | @systems-architect | Monorepo scaffolded with yarn workspaces, TypeScript, Prettier, ESLint, shared types package |
