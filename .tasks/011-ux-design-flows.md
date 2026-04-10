---
id: "011"
title: "Design UX flows: auth screens, listing browse/detail, chat, profile, post listing"
status: "completed"
area: "design"
agent: "@ui-ux-designer"
priority: "normal"
created_at: "2026-03-29"
due_date: null
started_at: "2026-03-30"
completed_at: "2026-03-30"
prd_refs: ["FR-001", "FR-002", "FR-010", "FR-011", "FR-020", "FR-030", "FR-040", "FR-050", "FR-060"]
blocks: ["012", "013", "014", "015", "016", "017", "018"]
blocked_by: []
---

## Description

Produce UX flow diagrams and screen wireframes for all major user journeys in the Marketplace app. Deliverables include: navigation map, wireframes for every screen, component specifications (dimensions, spacing, typography tokens), and annotated interaction notes for complex flows (e.g., GPS permission request, photo picker, real-time chat). These designs are the input contract for all mobile screen implementation tasks (#013–#018).

## Acceptance Criteria

- [x] Navigation map covers all app sections: Auth stack (Signup, Login), Main tab bar (Browse, Post, Chat, Profile), and modal flows (Listing Detail, Chat Thread)
- [x] Wireframes produced for every screen: Signup, Login, OTP/2FA, Profile Setup, Browse, Filter Bottom Sheet, Listing Detail, Chat Thread, Search, Post Listing (3-step), Camera, My Profile, Conversation List, Settings, Edit Profile
- [x] Each wireframe includes component annotations: input fields, buttons, image placeholders, distance badges, rating stars
- [x] Interaction notes document: GPS permission prompt flow, photo selection (camera + gallery), real-time message optimistic UI, invite code entry validation feedback, pull-to-refresh
- [x] Design tokens defined: primary/secondary colours, font sizes (heading, body, caption), spacing scale, border radius, shadows, animation
- [x] Designs are stored in `docs/content/UX_DESIGN_SPEC.md` with a summary in this task file's History

## Technical Notes

- Target: iOS and Android, so avoid platform-specific patterns that do not translate (e.g., Android back button vs. iOS swipe-back).
- React Navigation v6 pattern: bottom tab navigator with nested stack navigators per tab — wireframes should reflect this structure.
- The listing browse screen should account for both a list view and an optional map view (consider the map view as a stretch goal if time is constrained).
- Accessibility: ensure sufficient colour contrast (WCAG AA) and that interactive targets are at least 44x44 pt.

## History

| Date | Agent / Human | Event |
|------|--------------|-------|
| 2026-03-29 | human | Task created |
| 2026-03-30 | @ui-ux-designer | Full UX spec written to docs/content/UX_DESIGN_SPEC.md — 15 screens, design tokens, component library (11 components), 5 interaction patterns, accessibility notes. Navigation architecture with ASCII diagram. Input contract ready for tasks #013–#018. |
