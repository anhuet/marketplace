---
id: "012"
title: "Build Expo mobile app scaffold: navigation structure (React Navigation), Zustand store, API client, Socket.io client"
status: "completed"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-03-29"
due_date: null
started_at: "2026-03-30"
completed_at: "2026-03-30"
prd_refs: ["FR-001", "FR-040"]
blocks: ["013", "014", "015", "016", "017", "018", "019"]
blocked_by: ["002", "011"]
---

## Description

Scaffold the `apps/mobile` Expo application with full navigation structure, global state management, a typed API client pointing at the backend, and a Socket.io client for real-time chat. This is the foundational shell that all feature screens plug into. Navigation follows the pattern established in the UX designs (#011): an Auth stack for unauthenticated users and a bottom tab navigator for authenticated users, with nested stack navigators per tab.

## Acceptance Criteria

- [x] Expo app boots on iOS simulator and Android emulator with `yarn start` / `expo start`
- [x] React Navigation v6 structure in place: Auth stack (Login, Signup, ProfileSetup) and authenticated Tab navigator (Home/Browse, Search, Sell, Profile) with nested stacks
- [x] Zustand store configured with slices for: `auth` (user, token, isAuthenticated) and `chat` (conversations, messages, unreadCount)
- [x] Typed API client (`src/lib/api.ts`) wraps axios with base URL from env, attaches JWT Bearer token from auth store, and exports typed request functions
- [x] Socket.io client initialised after login, connects with JWT auth, and disconnects on logout
- [x] Navigation type-safe with TypeScript: all route params are typed via React Navigation's typed navigator pattern
- [x] `packages/shared` types are imported and used in the mobile app (verifies monorepo wiring from task #002)

## Technical Notes

- Use Expo Router or React Navigation v6 — check `docs/technical/DECISIONS.md` for any prior decision. If none, default to React Navigation v6 for flexibility.
- Zustand: use `persist` middleware with `AsyncStorage` for auth token persistence across app restarts.
- API client: use `axios` with an interceptor for token injection and a 401 interceptor to trigger logout/refresh.
- Socket.io client: `socket.io-client` package; pass auth token in `{ auth: { token } }` on `io()` initialisation.
- `.env` for Expo: use `EXPO_PUBLIC_API_URL` (Expo SDK 49+ public env var convention) — never hardcode the backend URL.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
| 2026-03-30 | @react-native-developer | Mobile scaffold complete: React Navigation v6 structure, Zustand stores (auth + chat), typed axios API client, Socket.io client, design tokens, placeholder screens for all routes |
