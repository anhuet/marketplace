---
id: "003"
title: "Set up Express backend boilerplate: server, Prisma client, middleware (auth, validation, error handler), folder structure"
status: "completed"
area: "backend"
agent: "@backend-developer"
priority: "high"
created_at: "2026-03-29"
due_date: null
started_at: "2026-03-29"
completed_at: "2026-03-29"
prd_refs: ["FR-001", "FR-006", "FR-007"]
blocks: ["004", "005", "006", "007", "008", "009", "010"]
blocked_by: ["001", "002"]
---

## Description

Scaffold the `apps/backend` Express + TypeScript application with a production-ready folder structure, Prisma client integration, and core middleware. This includes an authenticated request middleware (JWT verification), a Zod-based request validation helper, a centralised error handler, and environment variable loading via dotenv. The server must start successfully in development mode (`yarn dev`) and connect to a local PostgreSQL database using the Prisma schema from task #001.

## Acceptance Criteria

- [x] Express server starts on configured port with `yarn dev` using ts-node or tsx
- [x] Prisma client is generated and a test query (e.g., `prisma.user.count()`) runs without error on app startup
- [x] JWT auth middleware (`requireAuth`) validates Bearer tokens and attaches the decoded user to `req.user`
- [x] Centralised error handler catches unhandled errors and returns a consistent JSON error shape `{ error: string, code: string }`
- [x] Zod validation middleware helper is in place and used by at least one stub route
- [x] Folder structure follows: `src/routes/`, `src/controllers/`, `src/services/`, `src/middleware/`, `src/lib/`
- [x] All environment variables are read from `.env` (not hardcoded); `.env.example` is committed with all required keys

## Technical Notes

- Use `tsx` (or `ts-node-esm`) for development watch mode; compile with `tsc` for production.
- Prisma client should be a singleton in `src/lib/prisma.ts` to avoid connection pool exhaustion.
- JWT secret loaded from `process.env.JWT_SECRET` — never hardcoded.
- Error handler should distinguish operational errors (known, safe to return to client) from unexpected errors (log and return generic 500).
- Consult `docs/technical/DECISIONS.md` for any prior decisions on API response envelope shape.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
| 2026-03-29 | @backend-developer | Backend boilerplate complete with Auth0 JWT middleware, Zod validation, error handler, Prisma singleton |
