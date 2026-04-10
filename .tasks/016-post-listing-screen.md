---
id: "016"
title: "Build post listing screen: form with photos, description, price, category, GPS capture"
status: "todo"
area: "mobile"
agent: "@react-native-developer"
priority: "normal"
created_at: "2026-03-29"
due_date: null
started_at: null
completed_at: null
prd_refs: ["FR-020", "FR-021", "FR-022", "FR-023"]
blocks: []
blocked_by: ["006", "012", "011"]
---

## Description

Build the Post Listing screen that allows authenticated users to create new listings or edit existing ones. The form collects: up to 8 photos (camera or gallery), title, description, price, and category. GPS coordinates are captured automatically from the device location when the form opens (with a manual override option). On submission, images are uploaded to the backend and the listing is created. The same screen is used for editing (pre-populated with existing values) navigated to from the Listing Detail screen.

## Acceptance Criteria

- [ ] Photo picker allows selecting up to 8 images from the device gallery or capturing via camera (`expo-image-picker`); at least 1 photo is required
- [ ] Selected photos are displayed as a horizontally scrollable thumbnail row with individual remove buttons
- [ ] Form fields: title (required, max 100 chars), description (required, max 1000 chars), price (required, numeric, non-negative), category (required, picker/dropdown from a fixed list)
- [ ] GPS coordinates are auto-captured on screen open using `expo-location`; a "Use current location" refresh button is shown with the captured coordinates
- [ ] On submit, images are uploaded as multipart form-data to `POST /api/listings` and a success toast/alert navigates the user back to their profile or the new listing detail
- [ ] Edit mode: when `listingId` is passed as a route param, the form pre-fills with existing data and calls `PUT /api/listings/:id` on save
- [ ] Validation errors are shown inline; network errors show a retry-able error banner

## Technical Notes

- Use `expo-image-picker` for both gallery and camera access; request permissions before launching.
- Image upload: upload images sequentially or in parallel to `POST /api/listings` as `multipart/form-data` — handle upload progress indication if possible.
- Category list should come from a shared constant in `packages/shared` so it is consistent between mobile and backend validation.
- GPS capture: same permission flow as the browse screen — reuse the location permission utility from task #014.
- Form state: `react-hook-form` for consistency with the auth screens; GPS coordinates stored as a separate state field outside the form (not a user-editable text input by default).

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
