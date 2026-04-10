---
id: "015"
title: "Build listing detail screen: photos, description, price, seller info, \"Message Seller\" button"
status: "todo"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-03-29"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-020", "FR-024", "FR-040", "FR-041"]
blocks: []
blocked_by: ["006", "012", "011"]
---

## Description

Build the listing detail screen shown when a user taps a listing card. The screen presents a horizontally scrollable photo carousel, listing title, price, description, category, distance from the viewer, and a seller info section (avatar, display name, average rating). A prominent "Message Seller" button creates or retrieves a conversation for this listing and navigates the user to the Chat Thread screen. If the viewer is the listing owner, the "Message Seller" button is replaced with "Edit Listing" and "Mark as Sold" actions.

## Acceptance Criteria

- [ ] Photo carousel renders all listing images with swipe navigation and a page indicator (dots or counter)
- [ ] All listing fields are displayed: title, price (formatted), description, category, distance, posted date
- [ ] Seller info section shows avatar, display name, and average rating (star display + numeric value)
- [ ] "Message Seller" button calls `POST /api/conversations` and navigates to the Chat Thread screen on success
- [ ] When viewed by the listing owner, "Edit Listing" navigates to the Post Listing form pre-filled, and "Mark as Sold" calls the status PATCH endpoint with a confirmation prompt
- [ ] Loading skeleton is shown while the listing is being fetched; 404 state is handled gracefully
- [ ] Back navigation returns the user to the Browse screen without refetching the full list

## Technical Notes

- Photo carousel: `react-native-reanimated` + `react-native-gesture-handler` for smooth swipe, or use `FlatList` horizontal with `pagingEnabled: true` as a simpler option.
- Preload listing data from the browse screen's cached list to avoid a loading flash (pass minimal data as route params, then fetch full details in the background).
- "Mark as Sold" must show a confirmation `Alert` before calling the API — this is a destructive/irreversible action.
- Seller rating stars: use a reusable `StarRating` component (also used in the Profile screen reviews section).

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
