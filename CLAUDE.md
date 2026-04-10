# Marketplace — Claude Instructions

> Stack: React Native (Expo) · Node.js/Express · PostgreSQL (AWS RDS) · AWS
> Last updated: 2026-03-29

## Project Context

Marketplace is a mobile app for iOS and Android that enables users to buy and sell second-hand items. Sellers can list items with photos and descriptions; buyers can discover nearby listings using GPS-based search. Built-in chat lets buyers and sellers communicate directly within the app.

**Tech stack summary**: React Native (Expo) · Node.js/Express · AWS RDS PostgreSQL · Prisma · AWS

---

## Agents Available

**Mandatory delegation — this is not optional.** Every task that falls within a specialist's domain MUST be routed to that agent. Do not implement code, design schemas, write docs, or configure pipelines yourself — delegate. Only handle directly: project-level questions, routing decisions, and tasks explicitly outside all specialist domains.

| Agent | Role | Invoke when... |
|-------|------|----------------|
| `project-manager` | Backlog & coordination | "What's next?", sprint planning, breaking down features, reprioritizing |
| `systems-architect` | Architecture & ADRs | New feature design, tech decisions, system integration |
| `frontend-developer` | UI implementation | Components, pages, client-side state, styling |
| `react-native-developer` | Mobile UI implementation | React Native screens, navigation, native modules, platform styling, mobile performance |
| `backend-developer` | API & business logic | Endpoints, auth, background jobs, integrations |
| `ui-ux-designer` | UX & design system | User flows, wireframes, component specs, accessibility |
| `database-expert` | Schema & queries | Migrations, schema design, query optimization |
| `qa-engineer` | Testing (Playwright) | E2E tests, test strategy, coverage gaps |
| `documentation-writer` | Living docs | User guide updates, post-feature documentation |
| `cicd-engineer` | CI/CD & GitHub Actions | Pipelines, deployments, branch protection, release automation |
| `docker-expert` | Containerization | Dockerfiles, docker-compose, image optimization, container networking |
| `copywriter-seo` | Copy & SEO | Landing page copy, marketing content, meta tags, keyword strategy, structured data specs, brand voice |

---

## Critical Rules

These apply to all agents at all times. No exceptions without explicit human instruction.

1. **PRD.md requires explicit human approval to modify.** Do not edit it unless the human has clearly instructed you to do so in the current conversation. Read it to understand requirements.
2. **TODO.md is the living backlog.** Agents may add items, mark items complete, and move items to "Completed". Preserve section order and existing item priority — do not reorder items within a section unless explicitly asked to reprioritize.
3. **All commits use Conventional Commits format** (see Git Conventions below).
4. **Update the relevant `docs/` file** after every significant change before marking a task complete.
5. **Run tests before marking any implementation task complete.**
6. **Never hardcode secrets, credentials, or environment-specific values** in source code.
7. **Consult `docs/technical/DECISIONS.md`** before proposing changes that may conflict with prior architectural decisions.
8. **Always delegate to the right specialist.** If a task touches frontend, mobile (React Native), backend, database, UX/design, QA, documentation, CI/CD, Docker, or copy/SEO — invoke the appropriate agent immediately. Do not implement it yourself. The delegation table above is binding, not advisory.
9. **Commit your own changes; never push.** After completing your work, create a local commit (Conventional Commits format). Do not `git push`. The orchestrator is responsible for pushing the branch and opening the PR.

---

## Project Structure

```
apps/
  mobile/               # Expo React Native app (iOS & Android)
  backend/              # Node.js + Express API
packages/
  shared/               # Shared TypeScript types
docs/
  user/USER_GUIDE.md    # User-facing documentation
  technical/            # Architecture, API, DB, decisions
  content/              # Content strategy, brand voice, keyword targets (owned by @copywriter-seo)
.claude/agents/         # Specialist agent definitions
.claude/templates/      # Blank doc templates (synced from upstream — do not edit)
.tasks/                 # Detailed task files — one per TODO item (owned by @project-manager)
```

---

## Git Conventions

### Commit Format
```
<type>(<scope>): <short description>

[optional body]
[optional footer: Closes #issue]
```

**Types**: `feat` · `fix` · `docs` · `style` · `refactor` · `test` · `chore` · `perf` · `ci`

Examples:
```
feat(auth): add OAuth2 login with Google
fix(api): handle null response from payment provider
docs(user-guide): update onboarding section after flow change
```

### Branch Naming
```
feature/<ticket-id>-short-description
fix/<ticket-id>-short-description
chore/<description>
docs/<description>
refactor/<description>
```

### PR Requirements

> **Workflow note:** Specialist agents commit locally; the orchestrator pushes and opens the PR.

- PR title follows Conventional Commits format
- Fill out `.github/PULL_REQUEST_TEMPLATE.md` completely — do not delete sections
- Link to the related issue/ticket (`Closes #XXX`)
- At least one reviewer required before merge
- All CI checks must pass

---

## Code Style

- **Language**: TypeScript (strict mode)
- **Formatter**: Prettier — config in `.prettierrc`
- **Linter**: ESLint — config in `.eslintrc`
- **Import style**: Absolute imports from `src/` (in both mobile and backend apps)
- **No `console.log`** in production code — use the project logger utility
- **No commented-out code** committed — delete it or track it in TODO.md

---

## Testing Conventions

> No tests in v1 — planned for v2.

- **Unit tests**: [TBD]
- **E2E tests**: [TBD]
- **Coverage target**: [TBD]

---

## Environment & Commands

- **Node**: Latest LTS (see `.nvmrc`)
- **Package manager**: yarn
- `yarn workspace mobile start` — start Expo dev server
- `yarn workspace backend dev` — start backend dev server
- `yarn workspace mobile build:ios` — build iOS app
- `yarn workspace mobile build:android` — build Android app
- `yarn lint` — lint check
- `yarn typecheck` — TypeScript check

---

## Key Documentation

@docs/technical/ARCHITECTURE.md
@docs/technical/DECISIONS.md
@docs/technical/API.md
@docs/technical/DATABASE.md
@docs/user/USER_GUIDE.md
