---
id: "019"
title: "Integrate push notifications in mobile: register Expo push token, handle notification taps"
status: "completed"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-03-29"
due_date: null
started_at: "2026-03-30"
completed_at: "2026-03-30"
prd_refs: ["FR-060", "FR-061", "FR-062", "FR-063"]
blocks: []
blocked_by: ["010", "012"]
---

## Description

Integrate Expo Notifications on the mobile side: request notification permissions after login, obtain the Expo push token, register it with the backend (`POST /api/push-tokens`), and handle notification taps by deep-linking the user to the relevant screen (chat thread for a message notification, listing detail for an inquiry notification). Background notification handling should wake the app and navigate correctly. The push token should be refreshed if it changes.

## Acceptance Criteria

- [x] Notification permission is requested after successful login using `Notifications.requestPermissionsAsync()`; permission denied state is handled gracefully without blocking the app
- [x] Expo push token is obtained via `Notifications.getExpoPushTokenAsync()` and registered with the backend immediately after permissions are granted
- [x] Tapping a "new message" notification navigates the user directly to the correct Chat Thread screen
- [x] Tapping a "new inquiry" notification (for sellers) navigates to the relevant Conversation List or Chat Thread
- [x] Push token is refreshed and re-registered if `Notifications.addPushTokenListener` fires a token change event
- [x] On logout, the push token is deleted from the backend (`DELETE /api/push-tokens/:token`) and cleared from local state

## Technical Notes

- Use `expo-notifications` (`Notifications` API) — ensure the `expo-notifications` package is installed and the `app.json` / `app.config.ts` includes the required `permissions` and `android.googleServicesFile` / `ios.googleServicesFile` configuration for FCM/APNs.
- Deep linking on notification tap: use `Notifications.addNotificationResponseReceivedListener`; the notification payload should include `{ type: 'new_message' | 'new_inquiry', conversationId, listingId }` to drive navigation.
- **Physical device required**: Push tokens can only be obtained on a physical device running a development build or standalone build. Expo Go on a simulator returns an incompatible token format and FCM/APNs will reject it in production. QA must test on a real device.
- Notification channels (Android): default channel `"default"` is created with `Notifications.setNotificationChannelAsync` at hook mount time, satisfying Android 8+ (API 26+) requirements.

## Implementation

### Files created / modified

| File | Change |
|------|--------|
| `apps/mobile/src/hooks/usePushNotifications.ts` | New — custom hook encapsulating all push notification logic |
| `apps/mobile/src/navigation/RootNavigator.tsx` | Added `navigationRef` via `useRef`; renders `AuthenticatedRoot` wrapper that calls `usePushNotifications` when authenticated |
| `apps/mobile/src/store/authStore.ts` | Added `pushToken: string | null` field, `setPushToken` action; `clearAuth` now resets `pushToken` |
| `apps/mobile/src/screens/profile/ProfileScreen.tsx` | Logout calls `unregisterPushToken()` from hook; push toggle reads `pushToken` from store; removed redundant local `pushTokenRef` and `Notifications.getExpoPushTokenAsync` call |

### Architecture decisions

- `usePushNotifications` is only mounted inside `AuthenticatedRoot` — the hook never runs for unauthenticated sessions.
- The `navigationRef` is created in `RootNavigator` and passed down to `usePushNotifications` so the hook can navigate imperatively without being inside the navigator tree.
- Token is stored in Zustand (`pushToken` field) — not persisted to AsyncStorage intentionally, since the token is re-fetched on every authenticated session start. This avoids stale tokens surviving across reinstalls.
- `unregisterPushToken` is exported as a standalone async function (not a hook) so the `ProfileScreen` logout handler can `await` it before calling `clearAuth()`.
- Notification tap for killed-state (cold start) is handled via `Notifications.getLastNotificationResponseAsync()` with a polling interval waiting for `navigationRef.current.isReady()`.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
| 2026-03-30 | @react-native-developer | Implementation complete |
