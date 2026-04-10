---
id: "014"
title: "Build listing browse screen: GPS-filtered list, distance display, search/filter UI"
status: "todo"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-03-29"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-030", "FR-031", "FR-032", "FR-033", "FR-034"]
blocks: []
blocked_by: ["007", "012", "011"]
---

## Description

Build the listing browse screen that is the primary discovery surface of the app. The screen requests the user's GPS location, then calls the discovery API to show nearby active listings sorted by distance. A search bar and filter controls (radius, category) allow users to narrow results. Each listing card shows the primary photo, title, price, and distance. Tapping a card navigates to the Listing Detail screen. The screen supports pull-to-refresh and infinite scroll pagination.

## Acceptance Criteria

- [ ] Screen requests `expo-location` permission on first load; if denied, shows an informative message with a link to device settings
- [ ] Listings are fetched from `GET /api/listings/nearby` using the device's current GPS coordinates and displayed as a scrollable card list
- [ ] Each listing card displays: primary image, title, price (formatted currency), distance (e.g., "1.2 km away"), and category badge
- [ ] Search bar filters results by keyword (calls API with `q` param on submit); radius and category filter controls are accessible via a filter sheet/modal
- [ ] Pull-to-refresh re-fetches listings from the current location
- [ ] Infinite scroll appends the next page of results when the user scrolls near the bottom of the list
- [ ] Empty state shown when no listings are found within the selected radius, with a suggestion to increase the radius

## Technical Notes

- Use `expo-location` (`Location.requestForegroundPermissionsAsync`) — handle both iOS and Android permission flows.
- `FlatList` with `onEndReached` for infinite scroll; use a loading footer component to indicate page fetching.
- Debounce the keyword search input (300 ms) to avoid an API call on every keystroke.
- Cache the last-known location in the Zustand store so the screen does not flash empty while awaiting GPS fix.
- Listing card component should be extracted as a reusable component (used again in the Profile screen for "user's listings").

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
