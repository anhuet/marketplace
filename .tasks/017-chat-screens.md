---
id: "017"
title: "Build chat screens: conversation list, individual chat with real-time messages"
status: "todo"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-03-29"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-040", "FR-041", "FR-042", "FR-043", "FR-044"]
blocks: []
blocked_by: ["008", "012", "011"]
---

## Description

Build two chat screens: the Conversation List screen (the Chat tab in the bottom navigator showing all conversations with the latest message and unread badge), and the Chat Thread screen (the individual conversation with real-time incoming messages via Socket.io). Messages sent by the current user appear on the right; messages from the other participant appear on the left. New messages arrive in real time without requiring a manual refresh.

## Acceptance Criteria

- [ ] Conversation List screen fetches from `GET /api/conversations` and displays each conversation with: other participant's name, listing thumbnail, last message preview, timestamp, and unread count badge
- [ ] Tapping a conversation navigates to the Chat Thread screen for that conversation
- [ ] Chat Thread screen fetches message history from `GET /api/conversations/:id/messages` and renders messages in a `FlatList` (inverted, newest at bottom)
- [ ] Real-time `new_message` Socket.io event appends new messages to the thread without a page reload
- [ ] Sending a message calls `POST /api/conversations/:id/messages` and adds an optimistic message to the UI immediately (replaced with server-confirmed message on response)
- [ ] Unread badge in the tab bar and conversation list updates reactively when new messages arrive via Socket.io
- [ ] Chat Thread header shows the other participant's name and a link to the associated listing

## Technical Notes

- Inverted `FlatList` (`inverted: true`) for the chat thread is the standard React Native pattern — messages render newest at the bottom without manual scroll management.
- Optimistic updates: add the message to Zustand store immediately with a `pending: true` flag; replace with the API response on success or show an error state on failure.
- Socket.io event handling: set up listeners in the Chat Thread screen's `useEffect`; clean up listeners on unmount to prevent memory leaks.
- Unread count: update the Zustand `chat` store when a `new_message` event arrives for a conversation the user is not currently viewing.
- Keyboard handling: `KeyboardAvoidingView` is critical for the message input to remain visible when the keyboard is open.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
