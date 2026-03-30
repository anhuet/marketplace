---
id: "010"
title: "Implement push notifications: Expo push token registration, send notification on new message/inquiry"
status: "completed"
area: "backend"
agent: "@backend-developer"
priority: "normal"
created_at: "2026-03-29"
due_date: null
started_at: "2026-03-30"
completed_at: "2026-03-30"
prd_refs: ["FR-060", "FR-061", "FR-062", "FR-063"]
blocks: ["019"]
blocked_by: ["003"]
---

## Description

Implement the backend side of push notifications using the Expo Push Notification API. Users register their Expo push token after logging in; the backend stores it in the `push_tokens` table keyed to the user. When a new chat message or listing inquiry is sent, the backend sends a push notification to the recipient's registered devices. Users can opt out (FR-063) by deleting their push token or setting a preference flag.

## Acceptance Criteria

- [x] `POST /api/push-tokens` (authenticated) registers or updates an Expo push token for the requesting user, storing platform (ios/android) and token
- [x] `DELETE /api/push-tokens/:token` (authenticated) removes a push token (opt-out), satisfying FR-063
- [x] Push notification is sent to the recipient when a new chat message is created (triggered from the message send service)
- [x] Push notification is sent to the listing owner when a new conversation is initiated on their listing (new inquiry)
- [x] Notifications are not sent to the sender themselves, and not sent if the user has no registered token
- [x] Expo push API errors (invalid token, rate limit) are handled gracefully — logged but not surfaced as API errors to the sender
- [ ] Unit tests cover: token registration, token deletion, notification dispatch mock, no-op for users with no token (deferred to v2 per CLAUDE.md)

## Technical Notes

- Use the `expo-server-sdk` npm package (`expo-server-sdk`) for sending push notifications — it handles batching and ticket validation.
- Notification dispatch should be fire-and-forget (async, non-blocking) so it does not add latency to the message send response.
- Store the Expo push receipt ticket IDs for debugging — a background job to check receipts is a nice-to-have, not required for MVP.
- Multiple devices per user: iterate all active push tokens for the recipient and send to each.
- FR-063 opt-out: deleting the token is sufficient; a user preference boolean on the users table is an enhancement for a future iteration.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
| 2026-03-30 | @backend-developer | Push notification service with Expo SDK; token registration/deletion API; fire-and-forget dispatch on new message and new inquiry |
