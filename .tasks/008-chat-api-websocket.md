---
id: "008"
title: "Implement chat API + Socket.io: conversation creation, message history, real-time WebSocket events"
status: "completed"
area: "backend"
agent: "@backend-developer"
priority: "normal"
created_at: "2026-03-29"
due_date: null
started_at: null
completed_at: "2026-03-30"
prd_refs: ["FR-040", "FR-041", "FR-042", "FR-043", "FR-044"]
blocks: ["017"]
blocked_by: ["003"]
---

## Description

Implement the chat system: REST endpoints for creating conversations and fetching message history, plus a Socket.io server for real-time bidirectional messaging. A conversation is initiated by a buyer against a specific listing. Each authenticated user connects to Socket.io with their JWT and joins a private room per conversation. New messages are persisted to the database and broadcast to the other participant. Unread message counts are tracked via the `read_at` field on messages.

## Acceptance Criteria

- [x] `POST /api/conversations` (authenticated) creates or retrieves an existing conversation for a given `listingId`; returns the conversation object
- [x] `GET /api/conversations` (authenticated) returns all conversations for the current user with the last message and unread count per conversation
- [x] `GET /api/conversations/:id/messages` (authenticated, participant only) returns paginated message history, oldest-first
- [x] `POST /api/conversations/:id/messages` (authenticated, participant only) persists a message and emits a `new_message` Socket.io event to the conversation room
- [x] Socket.io connection requires a valid JWT (validated in the `connection` event handler); unauthenticated connections are rejected
- [x] `read_at` is updated when a participant fetches or views messages, allowing accurate unread counts
- [ ] Unit/integration tests cover: create conversation, duplicate conversation returns existing, send message, unread count calculation, unauthorised access rejection (skipped — no tests in v1)

## Technical Notes

- Socket.io rooms: use `conversation:{id}` as the room name. On JWT authentication, join the user to all their active conversation rooms.
- Socket.io server should share the same HTTP server instance as Express — attach via `new Server(httpServer)`.
- Emit events: `new_message` (to room, excluding sender), `message_read` (to room when read_at updated).
- Consider the fan-out strategy if a user is in many conversations — joining all rooms on connect is acceptable at this scale.
- Message pagination: cursor-based using `createdAt` timestamp is preferable to offset for real-time chat (avoids drift when new messages arrive).
- Push notification trigger for new messages should be called from the message send service (coordinates with task #010).

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
| 2026-03-30 | @backend-developer | Chat REST API and Socket.io real-time messaging implemented; JWT auth on WS connection; conversation rooms; read receipts |
