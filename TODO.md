# TODO / Backlog

> **Governor**: @project-manager — invoke for sprint planning, prioritization, and feature breakdown
> **Agents**: May add items to "Backlog" and move completed items to "Completed". Preserve section order. Never reorder items within a section — priority position is set by humans or @project-manager when explicitly asked.

---

## In Progress

_(nothing in progress)_

---

## Up Next (prioritized)

_(nothing up next)_

---

## Backlog

- [ ] #013 — Build auth screens: signup (with invite code field), login, logout [area: mobile] → [.tasks/013-auth-screens.md](.tasks/013-auth-screens.md)
- [ ] #014 — Build listing browse screen: GPS-filtered list, distance display, search/filter UI [area: mobile] → [.tasks/014-listing-browse-screen.md](.tasks/014-listing-browse-screen.md)
- [ ] #015 — Build listing detail screen: photos, description, price, seller info, "Message Seller" button [area: mobile] → [.tasks/015-listing-detail-screen.md](.tasks/015-listing-detail-screen.md)
- [ ] #016 — Build post listing screen: form with photos, description, price, category, GPS capture [area: mobile] → [.tasks/016-post-listing-screen.md](.tasks/016-post-listing-screen.md)
- [ ] #017 — Build chat screens: conversation list, individual chat with real-time messages [area: mobile] → [.tasks/017-chat-screens.md](.tasks/017-chat-screens.md)
- [ ] #018 — Build user profile screen: avatar, listings, ratings, reviews, settings [area: mobile] → [.tasks/018-user-profile-screen.md](.tasks/018-user-profile-screen.md)
- [ ] #019 — Integrate push notifications in mobile: register Expo push token, handle notification taps [area: mobile] → [.tasks/019-push-notifications-mobile.md](.tasks/019-push-notifications-mobile.md)
- [ ] #020 — Set up AWS RDS PostgreSQL and deploy backend to AWS EC2/ECS [area: infra] → [.tasks/020-aws-infrastructure.md](.tasks/020-aws-infrastructure.md)

---

## Completed

- [x] #000 — Initial project setup and template configuration → [.tasks/000-initial-project-setup.md](.tasks/000-initial-project-setup.md)
- [x] #001 — Design database schema: users, invite_codes, listings, images, conversations, messages, reviews [area: database] → [.tasks/001-database-schema.md](.tasks/001-database-schema.md)
- [x] #002 — Set up monorepo workspace: yarn workspaces, TypeScript configs, shared types package, Prettier + ESLint [area: setup] → [.tasks/002-monorepo-setup.md](.tasks/002-monorepo-setup.md)
- [x] #003 — Set up Express backend boilerplate: server, Prisma client, middleware (auth, validation, error handler), folder structure [area: backend] → [.tasks/003-backend-boilerplate.md](.tasks/003-backend-boilerplate.md)
- [x] #004 — Implement Auth0 integration: invite code pre-check, user auto-creation, auth routes [area: backend] → [.tasks/004-auth-api.md](.tasks/004-auth-api.md)
- [x] #005 — Implement invite code API: generate code, validate code on registration [area: backend] → [.tasks/005-invite-code-api.md](.tasks/005-invite-code-api.md)
- [x] #006 — Implement listings API: CRUD endpoints, image upload, GPS coordinates storage [area: backend] → [.tasks/006-listings-api.md](.tasks/006-listings-api.md)
- [x] #007 — Implement GPS-based discovery API: listings by distance (Haversine), filters (radius, category, keyword) [area: backend] → [.tasks/007-discovery-api.md](.tasks/007-discovery-api.md)
- [x] #008 — Implement chat API + Socket.io: conversation creation, message history, real-time WebSocket events [area: backend] → [.tasks/008-chat-api-websocket.md](.tasks/008-chat-api-websocket.md)
- [x] #009 — Implement ratings & reviews API: create review post-sale, fetch user ratings [area: backend] → [.tasks/009-ratings-reviews-api.md](.tasks/009-ratings-reviews-api.md)
- [x] #010 — Implement push notifications: Expo push token registration, send notification on new message/inquiry [area: backend] → [.tasks/010-push-notifications-backend.md](.tasks/010-push-notifications-backend.md)
- [x] #011 — Design UX flows: auth screens, listing browse/detail, chat, profile, post listing [area: design] → [.tasks/011-ux-design-flows.md](.tasks/011-ux-design-flows.md)
- [x] #012 — Build Expo mobile app scaffold: navigation structure (React Navigation), Zustand store, API client, Socket.io client [area: mobile] → [.tasks/012-mobile-app-scaffold.md](.tasks/012-mobile-app-scaffold.md)

---

## Item Format Guide

When adding new items, use this format:

```
- [ ] #NNN — Brief description of the task [area: frontend|backend|database|qa|docs|infra|design|mobile|setup] → [.tasks/NNN-short-title.md](.tasks/NNN-short-title.md)
```

Every TODO item must have a corresponding `.tasks/NNN-*.md` file. @project-manager creates both together.

**Area tags** help agents know which specialist to use:
- `mobile` → @react-native-developer
- `backend` → @backend-developer
- `database` → @database-expert
- `design` → @ui-ux-designer
- `qa` → @qa-engineer
- `docs` → @documentation-writer
- `infra` → @systems-architect
- `setup` → general

**Priority**: Items higher in "Up Next" are higher priority. Agents move completed items to "Completed" and may add new items to "Backlog". Only humans reorder items within a section to change priority, unless explicitly asked to reprioritize.
