---
id: "013"
title: "Build auth screens: signup (with invite code field), login, logout"
status: "completed"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-03-29"
due_date: null
started_at: "2026-03-30"
completed_at: "2026-03-30"
prd_refs: ["FR-001", "FR-002", "FR-003", "FR-004", "FR-006"]
blocks: []
blocked_by: ["004", "012", "011"]
---

## Description

Build the authentication screens for the mobile app: a Signup screen (with email, password, display name, and invite code fields), a Login screen (email and password), and logout functionality accessible from the Profile screen. Forms must validate inputs client-side before submission, show loading states during API calls, and display clear error messages for API failures (invalid invite code, wrong password, duplicate email). On success, the auth Zustand store is updated and navigation transitions to the authenticated tab navigator.

## Acceptance Criteria

- [x] Signup screen renders invite code field with real-time validity feedback using `GET /api/invites/validate/:code` with 500 ms debounce
- [x] Invite code field shows green valid indicator / red error state based on API response
- [x] Login screen calls Auth0 Universal Login and navigates to main tab navigator on success via RootNavigator `isAuthenticated` gate
- [x] Error messages are displayed inline (below the relevant field) for field-level errors and in a banner for general API errors
- [x] Loading spinner/disabled state on submit button during pending API requests prevents double-submission
- [x] JWT token is persisted to AsyncStorage via the Zustand auth store on successful login/signup
- [x] ProfileSetup screen collects display name and optional avatar after first signup

## Technical Notes

- Auth0 `webAuth.authorize` is used for both Login and Signup — a single Auth0 Universal Login page handles both flows; `prompt: 'login'` is passed on Signup to force fresh login.
- Invite code debounce: 500 ms delay before calling `GET /api/v1/invites/validate/:code` to avoid hammering the API on each keystroke.
- Keyboard avoiding behaviour: `KeyboardAvoidingView` with `behavior: 'padding'` on iOS and `'height'` on Android.
- All interactive elements have `accessibilityRole`, `accessibilityLabel`, and where relevant `accessibilityHint`.
- `testID` attributes on primary interactive elements for E2E test compatibility.
- `api.ts` exports a unified `api` object — screens use `api.validateInviteCode`, `api.validateInvite`, `api.getMe`, `api.redeemInvite`.
- Shared components `PrimaryButton` and `FormInput` created in `src/components/`.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
| 2026-03-30 | @react-native-developer | Auth screens built: Signup (with invite code validation + Auth0 flow), Login (Auth0), ProfileSetup (display name + avatar picker); shared PrimaryButton and FormInput components created |
