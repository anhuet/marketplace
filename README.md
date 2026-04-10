# Marketplace

> A mobile marketplace app for iOS and Android to buy and sell second-hand items with GPS-based discovery and real-time chat.

---

## Overview

Marketplace is a peer-to-peer mobile app where anyone can list items they want to sell and find items for sale nearby. Sellers upload photos and set prices; buyers browse listings filtered by GPS distance. The app makes second-hand commerce simple and immediate.

Marketplace serves two user types: Sellers who want to find buyers for their used items, and Buyers looking for good deals on second-hand goods in their area. Each user maintains a profile with ratings and reviews from completed transactions.

Existing classifieds platforms lack real-time communication and location-aware discovery. Marketplace solves both with built-in chat and GPS search. When a buyer is interested in an item, they message the seller instantly — no waiting for email replies.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Mobile | React Native (Expo), TypeScript | iOS & Android |
| Backend | Node.js, Express, TypeScript | REST API + WebSocket |
| Database | PostgreSQL 15 (AWS RDS) | |
| ORM | Prisma | |
| Auth | JWT | Custom implementation |
| Realtime | Socket.io | Chat & notifications |
| Push Notifications | Expo Notifications | FCM/APNs via Expo |
| Hosting | AWS (EC2/ECS + RDS) | |
| CI/CD | GitHub Actions | |

---

## Getting Started

### Prerequisites

- Node.js 20+ (see `.nvmrc`)
- yarn
- Expo CLI (`npm install -g expo-cli`)
- AWS account (for RDS connection)

### Installation

```bash
git clone https://github.com/[org]/marketplace.git
cd marketplace
yarn install
cp .env.example .env
# Edit .env and fill in required values
```

### Running Locally

```bash
# Start backend (in one terminal)
yarn workspace backend dev

# In another terminal, start mobile app
yarn workspace mobile start
```

The Expo dev server will display a QR code. Scan it with the Expo Go app (iOS/Android) or press `i`/`a` to open in simulator.

---

## Project Structure

```
marketplace/
├── apps/
│   ├── mobile/          # Expo React Native app
│   └── backend/         # Node.js + Express API
├── packages/
│   └── shared/          # Shared TypeScript types
├── docs/
│   ├── user/            # User-facing documentation
│   └── technical/       # Architecture, API, database docs
├── .claude/agents/      # Claude Code specialist agents
├── PRD.md               # Product requirements (source of truth)
├── TODO.md              # Project backlog
└── CLAUDE.md            # Claude AI instructions
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (AWS RDS) |
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens |
| `JWT_EXPIRES_IN` | No | Token expiry duration (default: 30d) |
| `PORT` | No | Backend server port (default: 3000) |
| `EXPO_ACCESS_TOKEN` | Yes | Expo push notification service token |
| `AWS_RDS_HOST` | Yes | AWS RDS PostgreSQL host |
| `AWS_RDS_PORT` | No | RDS port (default: 5432) |
| `AWS_RDS_DB` | Yes | Database name |
| `AWS_RDS_USER` | Yes | Database username |
| `AWS_RDS_PASSWORD` | Yes | Database password |

See `.env.example` for all available variables.

---

## Deployment

The application deploys automatically via GitHub Actions on merge to `main`.

- **Production**: Deployed to AWS (EC2/ECS for backend, RDS for database)
- **Staging**: [Staging URL — to be configured]

Manual backend build:
```bash
yarn workspace backend build
```

Mobile apps are built via EAS (Expo Application Services) or local build tools.

---

## License

Proprietary — all rights reserved.
