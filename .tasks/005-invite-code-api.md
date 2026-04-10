---
id: "005"
title: "Implement invite code API: generate code, validate code on registration"
status: "todo"
area: "backend"
agent: "@backend-developer"
priority: "high"
created_at: "2026-03-29"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-004", "FR-005", "FR-007"]
blocks: []
blocked_by: ["003"]
---

## Description

Implement the invite code management endpoints. Authenticated users can generate invite codes to share with others (each code is single-use). A public validation endpoint allows the registration flow to check a code's validity before submission. The generation logic must produce cryptographically random, URL-safe codes with a configurable expiry. Coordinate with task #004 to share the `InviteCodeService` rather than duplicating validation logic.

## Acceptance Criteria

- [ ] `POST /api/invites/generate` (authenticated) creates a new invite code for the requesting user and returns `{ code, expiresAt }`
- [ ] `GET /api/invites/validate/:code` (public) returns `{ valid: true }` or `{ valid: false, reason: string }` without revealing sensitive data
- [ ] Generated codes are cryptographically random (min 8 characters, URL-safe alphanumeric)
- [ ] A single user cannot generate more than a configurable maximum number of active unused codes (default: 5)
- [ ] Codes expire after a configurable TTL (default: 7 days); expired codes return `valid: false`
- [ ] Unit tests cover: generate code, exceed limit, validate valid code, validate used code, validate expired code

## Technical Notes

- Use `crypto.randomBytes` + base62 encoding (or `nanoid`) for code generation — do not use `Math.random()`.
- `InviteCodeService` should be a class/module in `src/services/inviteCode.service.ts` importable by both the auth controller (task #004) and the invites controller (this task).
- The per-user code generation limit is a business rule — store the limit in a config constant, not hardcoded inline.
- Consider whether admin users should be able to generate unlimited codes — flag this to the human if the PRD is ambiguous on FR-004/FR-005.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
