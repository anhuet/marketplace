---
id: "018"
title: "Build user profile screen: avatar, listings, ratings, reviews, settings"
status: "todo"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-03-29"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-010", "FR-011", "FR-012", "FR-050", "FR-051", "FR-052", "FR-063"]
blocks: []
blocked_by: ["009", "012", "011"]
---

## Description

Build the User Profile screen that serves both as the logged-in user's own profile (with edit and settings controls) and as a read-only public profile when viewed from a listing or review. The screen displays the user's avatar, display name, average rating, their active listings grid, and their received reviews. For the logged-in user, an edit profile option and a Settings section are visible, including the push notification opt-out toggle (FR-063) and a logout button.

## Acceptance Criteria

- [ ] Profile header shows avatar (tappable to change, if own profile), display name, and average star rating with review count
- [ ] "My Listings" section shows a grid of the user's ACTIVE and SOLD listings using the reusable listing card component from task #014
- [ ] Reviews section shows received reviews in a scrollable list: reviewer name, star rating, comment, date
- [ ] Edit Profile mode (own profile only) allows updating display name and avatar image (`expo-image-picker`), calling `PUT /api/users/me`
- [ ] Settings section (own profile only) includes: push notification opt-out toggle (calls `DELETE /api/push-tokens/:token` on disable), and a Logout button
- [ ] Public profile view (other users) hides edit controls and settings; shows the same avatar, name, rating, and reviews
- [ ] All API calls show loading states and handle errors with user-friendly messages

## Technical Notes

- The profile screen can be accessed in two modes: `own` (logged-in user, from the Profile tab) and `public` (another user, from a listing or review). Use a route param `userId` — if it matches the logged-in user, render own-profile controls.
- Avatar upload: same `expo-image-picker` flow as the post listing screen — reuse the permission utility.
- `PUT /api/users/me` endpoint may not exist yet — coordinate with the backend developer to add it if not covered by task #004.
- Push notification opt-out: retrieve the stored Expo push token from the Zustand store or AsyncStorage to pass to the DELETE endpoint.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
