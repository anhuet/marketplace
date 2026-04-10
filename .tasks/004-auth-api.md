---
id: "004"
title: "Implement Auth0 integration: invite code pre-check, user auto-creation, auth routes"
status: "completed"
area: "backend"
agent: "@backend-developer"
priority: "high"
created_at: "2026-03-29"
due_date: null
started_at: "2026-03-29"
completed_at: "2026-03-29"
prd_refs: ["FR-001", "FR-002", "FR-003", "FR-006", "FR-007"]
blocks: ["005", "013"]
blocked_by: ["003"]
---

## Description

Auth is delegated to Auth0 (not custom JWT). The backend's responsibilities are: (1) validate Auth0 JWTs on protected routes via the pre-existing `requireAuth` middleware, (2) auto-create a DB user record on first authenticated request via the `attachUser` middleware, (3) handle invite code pre-check before the client redirects to Auth0 signup, and (4) handle invite code redemption after first login.

## Acceptance Criteria

- [x] `POST /api/v1/auth/validate-invite` (public) accepts `{ code }` and validates the invite code is real and unused — returns 400 with `INVALID_INVITE_CODE` if not valid
- [x] `POST /api/v1/auth/redeem-invite` (authenticated) accepts `{ code }` and atomically marks the invite code as used and links it to the authenticated DB user; returns 409 if user already redeemed
- [x] `GET /api/v1/auth/me` (authenticated) returns the authenticated user's DB profile; auto-creates DB record + invite code on first call
- [x] Auth0 JWT middleware (`requireAuth`) correctly rejects missing, malformed, or expired tokens with 401
- [x] `attachUser` middleware auto-creates DB user record from Auth0 token claims on first authenticated request
- [x] Invite code is auto-generated when user DB record is first created (via `findOrCreateUser`)
- [x] No passwords stored — Auth0 handles all credential management

## Technical Notes

- Auth0 domain: `dev-htobs7e6.us.auth0.com` (loaded from `AUTH0_DOMAIN` env var)
- Auth0 audience: `marketplace-app` (loaded from `AUTH0_AUDIENCE` env var)
- `requireAuth` middleware already existed from task #003 — uses `express-jwt` + `jwks-rsa`
- `attachUser` middleware must be applied after `requireAuth` on all routes that need the DB user
- Custom login/logout endpoints are NOT implemented — Auth0 handles that on the client

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
| 2026-03-29 | @backend-developer | Auth0 JWT middleware integrated; validate-invite, redeem-invite, and /me endpoints implemented; attachUser middleware created; userService updated to auto-generate invite code on user creation |
