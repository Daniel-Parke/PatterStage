# Control Hub — Agent Development Guide

§

Extends `~/.hermes/AGENTS.md` (base instructions). This file adds project-specific context for working on the Control Hub web application.

§

> **Always read `~/.hermes/AGENTS.md` first.** It contains the universal rules, execution loop, and repository structure that apply to all agents.

§

> **For architecture, design rules, and current state, load the `control-hub` skill.** It has the full project documentation.

§

## Development Environment

§

```bash

cd ~/control-hub

npm run dev     # Start dev server (PORT from .env.local; scripts/bootstrap/setup.sh defaults 42069–42100)

npm run build   # Production build

npm run start   # Start production server

```

§

## Project Structure

§

```

control-hub/

├── src/

│   ├── app/

│   │   ├── api/                    # REST API routes

│   │   │   ├── agent/files/[key]/    # Behaviour file read/update

│   │   │   ├── agent/profiles/     # Agent profile CRUD

│   │   │   ├── tools/              # Toolset config per platform

│   │   │   ├── missions/           # Mission CRUD + dispatch

│   │   │   ├── config/             # Config YAML CRUD

│   │   │   ├── cron/               # Cron job management

│   │   │   ├── sessions/           # Session browser

│   │   │   ├── memory/             # Holographic memory CRUD

│   │   │   ├── agents/             # Running agent detection

│   │   │   ├── monitor/            # Aggregated system status

│   │   │   ├── templates/          # Custom template CRUD

│   │   │   └── ...                 # Other endpoints

│   │   ├── page.tsx                # Dashboard

│   │   ├── (main)/                 # sessions, memory, logs (route group — no /main URL prefix)

│   │   ├── orchestration/          # cron, missions, chat

│   │   ├── operations/             # agents, skills, tools, personalities

│   │   ├── config/                 # Config editor + models hub

│   │   ├── recroom/story-weaver/   # Story Weaver

│   │   └── layout.tsx              # Root layout with sidebar

│   ├── components/

│   │   ├── layout/                 # Sidebar, PageHeader, AppPageShell

│   │   ├── missions/, cron/, models/, memory/, story-weaver/, ui/

│   ├── lib/

│   │   ├── db.ts, db/migrations/   # SQLite + baseline schema

│   │   ├── hermes-home.ts          # HERMES_HOME resolution

│   │   ├── hermes-agent-runtime.ts # Active Hermes paths + gateway URLs

│   │   ├── *-repository.ts         # missions, cron, models, credentials, …

│   │   ├── sync/                   # Background sync + SyncScheduler

│   │   ├── backends/hermes.ts      # Mission dispatch

│   │   ├── api-fetch.ts            # Shared client fetch helper

│   │   ├── schema/                 # Mission + template Zod schemas

│   │   ├── config-schema.ts        # Config section definitions

│   │   ├── theme.ts, utils.ts, …

│   └── types/

│       └── hermes.ts               # All TypeScript interfaces

├── tests/

│   ├── unit/                       # Jest unit + API tests

│   ├── e2e/                        # Playwright (incl. app-routes nav matrix)

│   ├── integration/                # Docker install/update harness (Python)

│   ├── jest.setup.ts

│   └── __mocks__/better-sqlite3.cjs

├── scripts/                        # bootstrap/, application/ch-deploy.sh, tooling/, lib/, hardware/, …

├── scripts/git-hooks/              # Optional pre-push (see docs/CONTRIBUTING.md)

├── docs/                           # Technical documentation index → docs/README.md

├── next.config.ts                  # Next.js config

├── tailwind.config.ts              # Tailwind config

└── package.json

```

Next.js static files (favicon, `robots.txt`, etc.) go in a `public/` directory at the repo root when you add them—the folder is not committed empty; the production `Dockerfile` runs `mkdir -p public` before build.

§

## Key Conventions

§

- **TypeScript strict** — no `any`, no `@ts-ignore`

- **API routes return `{ data?, error? }`** — all routes use `ApiResponse<T>` from `@/types/hermes`

- **Error logging** — all catch blocks call `logApiError(route, context, error)` from `@/lib/api-logger`

- **Loading + error states** for every async operation

- **Destructive actions need confirmation**

- **Do not bypass the API to edit Hermes or Control Hub state on disk** — use routes so path validation and registry-aware resolution apply

- **`.env` keys displayed as `sk-...abcd` only**

- **Use `js-yaml` for YAML parsing**

- **String concatenation for paths, NOT `path.join`** (Turbopack NFT tracing issue)

- **Build before deploy:** `npm run build` must pass

- **Security** — whitelist body fields in PUT handlers (no mass assignment), validate paths with `path.resolve()` + `startsWith()`

- **Large action-router routes split into per-action modules** — a thin `route.ts` dispatches on `action` to handlers under `src/lib/{mission,story}-handlers/*` (+ a `shared.ts` for pure helpers). See `mission-handlers/` and `story-handlers/`.

- **Read-only data hooks wrap `useApiResource`** (`src/hooks/useApiResource.ts`) — a generic TanStack-Query + `{ data }`-envelope helper; each domain hook (`useStats` / `useSessions` / `useLogs` / `useConfig` / `useAnalytics`) is a thin wrapper that keeps its own public field name. Hooks with mutations (`useSchedules`) or multi-query bundles (`useDashboard`) stay bespoke — don't force them onto the generic.

- **Big page = page-core hook + render shell** — when a page/component grows past ~600 lines, lift its stateful core into a `use<Page>` hook and leave the `.tsx` as a render shell (e.g. `useMissionsPage` / `useModelsPage` / `useChatPage`, and `HindsightBrowser`'s three per-tab hooks). Move logic **verbatim** — preserve every dependency array and effect guard byte-for-byte. Pure derivations (board filters, cron resolution, skill grouping) go to a sibling `lib/*` module so they're unit-testable (`mission-filters.ts`, `schedule/picker-resolver.ts`, `skills-page-helpers.ts`). Self-contained presentational subcomponents move to `components/<area>/` (the Sidebar / skills-card precedent).

- **Prefer composable helpers over route wrappers / base classes** — API routes use the standalone `requireAuth` / `parseAndValidateJsonBody` / `serverErrorFromCatch` helpers, NOT a `withApiRoute` HOF (the 67 routes are too heterogeneous — action-routers, custom status codes, streaming — so a wrapper would invert control flow and create a two-pattern split). Likewise there is **no** base-repository class or unified `createSyncModule` — the repos/sync modules are only ~20% genericizable, so we extract targeted helpers (`fs-helpers.ts`, `db/build-update.ts`) instead. Add abstractions only when they remove genuine duplication without hiding the underlying SQL/HTTP.

§

## Shared Utilities

§

- `src/lib/utils.ts` — `parseSchedule()`, `CronJobData`, `messageSummary()`, `timeAgo()`, `timeUntil()`, `formatBytes()`

- `src/lib/api-logger.ts` — `logApiError()`, `safeJsonParse()`, `safeReadJsonFile()`

- `src/lib/paths.ts` — `PATHS` (Control Hub–owned dirs), `CH_DATA_DIR`, `getChScriptsDir()`, `getChHardwareLogDir()`, `getDiscordHomeChannel()`
- `src/lib/hermes-agent-runtime.ts` — `getActiveHermesPaths()`, `getActiveHermesHome()`, `getAgentLlmEndpoints()`
- `src/lib/hermes-home.ts` — `getHermesHome()` (env-first; default `~/.hermes`)
- `src/lib/hermes-package-path.ts` — `{HERMES_HOME}/hermes-agent` only (single install layout)
- `src/lib/models-repository.ts` — `getDefaultModel()`, `getModel()`, `getModelWithKey()`, `setDefaultModel()`, `listModels()` (SQLite registry)
- `src/lib/db.ts` — SQLite connection, migrations, `getGatewayPlatforms()`

§

## Git Workflow

§

**Work on feature branches. Never commit directly to `dev` or `main`.**

§

The agent is authenticated with GitHub via `$GITHUB_TOKEN` (set in `~/.hermes/.env`).
The `gh` CLI is also configured with the same PAT. **Always use `gh` as the primary method.**

§

```bash

# Before starting work

cd ~/control-hub

git checkout dev

git pull origin dev

§

# After making changes — lint, build, and test first

npm run lint && npm run build && npm test

git add -A

git commit -m "type: description"

git push origin feature/your-feature

§

# Create PR for review — PREFERRED: use gh CLI

gh pr create \

  --title "type: description" \

  --body "What changed and why." \

  --base dev \

  --head feature/your-feature

§

# Fallback: GitHub REST API with $GITHUB_TOKEN (only if `gh` is unavailable — e.g. minimal container)

# See docs/CONTRIBUTING.md for the full snippet. Prefer `gh pr create` above.

```

§

**Rules:**

- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`

- Always `npm run build` and `npm test` before pushing

- Never merge your own PRs

- If merge conflict: stop and report to user

- **Never use the browser for GitHub operations** — blocks with CAPTCHAs. Use `gh` CLI, `git`, or `curl` + `$GITHUB_TOKEN`.

§

## Deployment

§

```bash

# Step 1: Build (foreground, safe — exits when done)

cd ~/control-hub && npm run build

§

# Step 2: Kill existing server

fuser -k "${PORT:-3000}/tcp" 2>/dev/null; sleep 2

§

# Step 3: Start server (MUST use background=true, NOT &)

# Use the terminal tool with background=true to start the server.

# NEVER use nohup ... & — the hermes terminal tool's pipe inheritance

# will cause the agent to freeze. See npm-service-restart skill.

```

§

In code, deploy via:

```

terminal(command="cd ~/control-hub && node node_modules/next/dist/bin/next start -p ${PORT:-3000} -H 0.0.0.0", background=true)

sleep 3

curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${PORT:-3000}

```



**Scripts:**

- `scripts/application/ch-deploy.sh` — **`restart`** (no git/build), **`rebuild`** (build current tree + restart; optional `--branch` for local checkout only — no pull), or **`update`** (pull **CH_UPDATE_GIT_BRANCH**, install deps if needed, build, **`seed-catalog.ts --merge`**, restart); status in **`~/.hermes/logs/ch-deploy.status`**; reads **`CH_*` / `HERMES_HOME`** from `.env.local`

- `scripts/bootstrap/install.sh` — Bootstrap clone + setup, or **`--in-repo`**; optional **`INSTALL_HERMES_PROFILE_TEMPLATES`** for bundled Hermes templates (see script header)

- `scripts/bootstrap/setup.sh` — Post-clone setup (PORT + `.env.local`, npm install, build)

- `scripts/bootstrap/stop.sh` — Stop listeners on PORT (used standalone; `ch-deploy restart` stops port inline)

- `scripts/lib/ch-hermes-profile-templates.sh` — Optional install-only copy from **`data/seed/profiles/`** (bootstrap `install.sh`; update uses **`seed-catalog.ts`**)

- **Scripts layout** (bootstrap vs tooling vs `ch-deploy`): **[docs/DEPLOY.md](docs/DEPLOY.md)**



**Critical:** `-H 0.0.0.0` required for network access. `fuser -k` is more reliable than `kill`. MUST use `background=true` on the terminal tool — never use `nohup ... &` which causes pipe inheritance deadlock. See `npm-service-restart` skill for full details.

§

## Design Philosophy

§

Control Hub is a command centre, not a file manager. The operator opens the dashboard and instantly knows: what agents are running, what missions are active, what's healthy, what needs attention. Then in 1-2 clicks they can dispatch a new mission.

§

**Aesthetic:** Dark base (#030712), neon accents (cyan, purple, pink, green, orange). Information-dense but scannable. Every pixel earns its place.

§

**Sidebar sections:** Main (Dashboard, Sessions, Memory, Logs) | Orchestration (Cron, Missions, Chat) | Operations (Agents, Skills, Tools, Personalities) | Rec Room (Story Weaver) | Config (Models, Seed, HERMES.md, Environment + YAML sections). Gateway health appears on the dashboard and in Orchestration → Chat (no separate Gateway page).

**Profiles:** SQLite `agent_profiles` is source of truth; push/pull/drift on Operations → Agents mirrors Config → Models sync. See [docs/CATALOG_AND_PROFILES.md](docs/CATALOG_AND_PROFILES.md). Per-profile Hermes toolsets: [docs/TOOLS_AND_MISSIONS.md](docs/TOOLS_AND_MISSIONS.md).

§

## Shell & UI consistency

§

- **Page chrome:** Prefer `PageHeader` from `@/components/layout/PageHeader` for sticky top bars (title, optional back link, `actions` slot). Use `shellHeaderBarClasses` from `@/lib/theme` only when extending the shell outside `PageHeader`.

§

- **Page frame:** Prefer `AppPageShell` from `@/components/layout/AppPageShell` instead of repeating `min-h-screen bg-dark-950 grid-bg`. Use `variant="scanlines"` where the Rec Room / immersive aesthetic applies.

§

- **Tokens:** Use theme colours (`neon-*`, `dark-*`, `semantic-*`, `rgb(var(--ch-rgb-neon-*)_/_opacity)` in arbitrary shadows) — **do not** introduce raw hex or ad-hoc `purple-500` / `rgba(...)` in TSX unless documenting an exception in `docs/design-tokens.md`.

§

- **Mobile:** `MobileHeader` intentionally uses `--ch-mobile-header-min-height` (3rem), shorter than desktop `--ch-shell-header-min-height` (5rem).

