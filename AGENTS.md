# PatterStage — Agent Development Guide

Extends `~/.hermes/AGENTS.md` (base instructions). This file adds project-specific context for working on the PatterStage web application.

> **Always read `~/.hermes/AGENTS.md` first.** It contains the universal rules, execution loop, and repository structure that apply to all agents.

> **For architecture, design rules, and current state, load the `patterstage` skill** and the docs index at [docs/README.md](docs/README.md).

## Development Environment

```bash
cd ~/patterstage
npm run dev     # Start dev server (PORT from .env.local; setup.sh defaults 42069–42100)
npm run build   # Production build
npm run start   # Start production server
npm run lint    # eslint (must pass with --max-warnings 0)
npm test        # Jest unit suite
```

## Architecture in one paragraph

PatterStage is the **single source of truth for orchestration and scheduling**; the agent (Hermes) only executes runs over HTTP. The orchestration core (`src/lib/orchestration/`) talks to the agent exclusively through the hexagonal `AgentRuntime` port (`src/lib/runtime/types.ts`), whose Hermes implementation is `HermesRuntime.ts`. A PatterStage-owned background scheduler (`src/lib/orchestration/scheduler/`) is booted from `src/instrumentation.ts` and fires due schedules on a 15s tick, independent of HTTP traffic. State lives in SQLite (`src/lib/db.ts`, migrations under `src/lib/db/migrations/*.sql`) behind hand-written repositories (`src/lib/*-repository.ts`). See [docs/RUNTIME_ARCHITECTURE.md](docs/RUNTIME_ARCHITECTURE.md).

## Project Structure

```
patterstage/
├── src/
│   ├── app/
│   │   ├── api/                    # REST API routes ({ data?, error? } envelope)
│   │   │   ├── agent/profiles/     # Agent profile CRUD + sync
│   │   │   ├── missions/           # Mission CRUD + dispatch + cancel
│   │   │   ├── schedules/          # CH-owned schedules CRUD + run-now
│   │   │   ├── runs/               # Run status, events (SSE), reconcile
│   │   │   ├── orchestration/chat/ # Chat turn dispatch
│   │   │   ├── benchmarks/         # Suites, runs, leaderboard, agent-card
│   │   │   ├── models/             # Model registry + sync + fallbacks
│   │   │   ├── config/             # Config YAML CRUD
│   │   │   ├── cron/hardware/      # Host scripts (system cron) — Scripts page
│   │   │   ├── sessions/, memory/, logs/, stats/, analytics/, gateway/
│   │   │   ├── update/             # Deploy API (update/rebuild/restart)
│   │   │   └── ...                 # Other endpoints
│   │   ├── page.tsx                # Dashboard
│   │   ├── (main)/                 # sessions, memory, logs (route group — no /main prefix)
│   │   ├── laboratory/             # insights, benchmarks, deep research, artifacts
│   │   ├── orchestration/          # missions, scripts, chat, composer
│   │   ├── operations/             # agents, skills, tools, personalities
│   │   ├── config/                 # Config editor + models hub
│   │   ├── recroom/story-weaver/   # Story Weaver
│   │   └── layout.tsx              # Root layout with sidebar
│   ├── components/
│   │   ├── layout/                 # Sidebar, PageHeader, AppPageShell, MobileHeader
│   │   ├── ui/                     # Generic UI; ui/field/ = the Field Kit form primitives
│   │   ├── viz/                    # Hand-rolled SVG charts
│   │   ├── motion/                 # Reduced-motion-safe animation wrappers
│   │   └── missions/, schedule/, models/, memory/, story-weaver/, chat/, …
│   ├── lib/
│   │   ├── db.ts, db/migrations/   # SQLite + baseline schema + migration appliers
│   │   ├── runtime/                # AgentRuntime PORT (types.ts) + HermesRuntime adapter + gateway-manager
│   │   ├── orchestration/          # dispatch, chat-dispatch, run-reconcile, scheduler/ (CH-owned scheduling)
│   │   ├── sync/                   # Background drift sources + SyncScheduler
│   │   ├── *-repository.ts         # runs, schedules, missions, sessions, models, credentials, …
│   │   ├── hermes-home.ts          # HERMES_HOME resolution
│   │   ├── hermes-agent-runtime.ts # Active Hermes paths + gateway URLs
│   │   ├── api-fetch.ts            # Shared client fetch helper
│   │   ├── deploy-spawn.ts         # Detached ps-deploy spawn + liveness probe
│   │   ├── schema/                 # Mission + template Zod schemas (+ JSON schema)
│   │   ├── config-schema.ts        # Config section definitions
│   │   ├── theme.ts, utils.ts, …
│   └── types/
│       └── hermes.ts               # All TypeScript interfaces
├── tests/
│   ├── unit/                       # Jest unit + API tests
│   ├── e2e/                        # Playwright (incl. app-routes nav matrix)
│   ├── integration/                # Docker install/update + runtime harness
│   ├── jest.setup.ts
│   └── __mocks__/better-sqlite3.cjs
├── scripts/                        # bootstrap/, application/ps-deploy.sh, lib/, tooling/, hardware/, maintenance/
├── docs/                           # Technical documentation index → docs/README.md
├── next.config.ts                  # Next.js config
└── package.json
```

Next.js static files (favicon, `robots.txt`, etc.) go in a `public/` directory at the repo root when you add them — the folder is not committed empty; the production `Dockerfile` runs `mkdir -p public` before build.

## Key Conventions

- **TypeScript strict** — no `any`, no `@ts-ignore`
- **API routes return `{ data?, error? }`** — all routes use `ApiResponse<T>` from `@/types/hermes`
- **Error logging** — all catch blocks call `logApiError(route, context, error)` from `@/lib/api-logger`
- **Loading + error states** for every async operation
- **Destructive actions need confirmation**
- **Do not bypass the API to edit Hermes or PatterStage state on disk** — use routes so path validation and registry-aware resolution apply
- **`.env` keys displayed as `sk-...abcd` only**
- **Use `js-yaml` for YAML parsing**
- **String concatenation for paths, NOT `path.join`** (Turbopack NFT tracing issue)
- **Build before deploy:** `npm run build` must pass
- **Security** — whitelist body fields in PUT handlers (no mass assignment), validate paths with `path.resolve()` + `startsWith()`
- **Agent integration goes through the `AgentRuntime` port** — never reach into Hermes internals (job files, status.json, bash) from orchestration code; add capabilities to `src/lib/runtime/types.ts` and implement them in `HermesRuntime.ts`. This is what keeps PatterStage framework-agnostic.
- **Large action-router routes split into per-action modules** — a thin `route.ts` dispatches on `action` to handlers under `src/lib/{mission,story}-handlers/*` (+ a `shared.ts` for pure helpers).
- **Read-only data hooks wrap `useApiResource`** (`src/hooks/useApiResource.ts`) — a generic TanStack-Query + `{ data }`-envelope helper; each domain hook (`useStats` / `useSessions` / `useLogs` / `useConfig` / `useAnalytics`) is a thin wrapper that keeps its own public field name. Hooks with mutations (`useSchedules`) or multi-query bundles (`useDashboard`) stay bespoke — don't force them onto the generic.
- **Big page = page-core hook + render shell** — when a page/component grows past ~600 lines, lift its stateful core into a `use<Page>` hook and leave the `.tsx` as a render shell (e.g. `useMissionsPage` / `useModelsPage` / `useChatPage`). Move logic **verbatim** — preserve every dependency array and effect guard byte-for-byte. Pure derivations go to a sibling `lib/*` module so they're unit-testable. Self-contained presentational subcomponents move to `components/<area>/`.
- **Prefer composable helpers over route wrappers / base classes** — API routes use the standalone `requireAuth` / `parseAndValidateJsonBody` / `serverErrorFromCatch` helpers, NOT a `withApiRoute` HOF (the routes are too heterogeneous — action-routers, custom status codes, streaming). Likewise there is **no** base-repository class or unified `createSyncModule` — extract targeted helpers (`fs-helpers.ts`, `db/build-update.ts`) instead. Add abstractions only when they remove genuine duplication without hiding the underlying SQL/HTTP.
- **Form inputs use the Field Kit** (`src/components/ui/field/`) — `Field`, `Input`, `Textarea`, `Select`, `Toggle`, `ChipGroup`, `SegmentedControl`. Don't reach for raw `<input>`/`<select>`.

## Shared Utilities

- `src/lib/utils.ts` — `parseSchedule()`, `messageSummary()`, `timeAgo()`, `timeUntil()`, `formatBytes()`
- `src/lib/api-logger.ts` — `logApiError()`, `safeJsonParse()`, `safeReadJsonFile()`
- `src/lib/paths.ts` — `PATHS` (PatterStage–owned dirs), `PS_DATA_DIR`, `getPsScriptsDir()`, `getPsHardwareLogDir()`
- `src/lib/hermes-agent-runtime.ts` — `getActiveHermesPaths()`, `getActiveHermesHome()`, `getAgentLlmEndpoints()`
- `src/lib/hermes-home.ts` — `getHermesHome()` (env-first; default `~/.hermes`)
- `src/lib/models-repository.ts` — `getDefaultModel()`, `getModel()`, `getModelWithKey()`, `setDefaultModel()`, `listModels()` (SQLite registry)
- `src/lib/db.ts` — SQLite connection, `runMigrations()`, `getGatewayPlatforms()`
- `src/lib/runtime/index.ts` — the bound `runtime` singleton (`AgentRuntime`)

## Git Workflow

**Work on feature branches. Never commit directly to `dev` or `main`.**

The agent is authenticated with GitHub via `$GITHUB_TOKEN` (set in `~/.hermes/.env`). The `gh` CLI is configured with the same PAT. **Always use `gh` as the primary method.**

```bash
# Before starting work
cd ~/patterstage
git checkout dev
git pull origin dev

# After making changes — lint, build, and test first
npm run lint && npm run build && npm test
git add -A
git commit -m "type: description"
git push origin feature/your-feature

# Create PR for review — PREFERRED: gh CLI
gh pr create --title "type: description" --body "What changed and why." --base dev --head feature/your-feature
```

**Rules:**

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Always `npm run build` and `npm test` before pushing
- Never merge your own PRs
- If merge conflict: stop and report to the user
- **Never use the browser for GitHub operations** — blocks with CAPTCHAs. Use `gh` CLI, `git`, or `curl` + `$GITHUB_TOKEN`.

## Deployment

The deploy entrypoint is `scripts/application/ps-deploy.sh` (also driven by the `POST /api/update` UI button):

- **`restart`** — no git/build; stops the port and restarts next-server
- **`rebuild`** — build current tree + restart (optional `--branch` = local checkout only, no pull)
- **`update`** — pull `PS_UPDATE_GIT_BRANCH`, install deps if needed, build, `seed-catalog.ts --merge`, restart

Status is written to `~/.hermes/logs/ps-deploy.status`; logs to `ps-update.log` / `ps-build.log` / `ps-restart.log`. The deploy is spawned detached (systemd `--user` transient unit, or `nohup` fallback) and verified by the liveness probe in `src/lib/deploy-spawn.ts` — which watches the systemd **unit** (not the launcher PID) and the status file. `PS_*` / `HERMES_HOME` come from `.env.local`.

When manually restarting from inside the Hermes agent terminal, use the terminal tool with `background=true` — **never** `nohup ... &`, which causes the Hermes terminal's pipe-inheritance deadlock. `-H 0.0.0.0` is required for LAN access. See the `npm-service-restart` skill.

**Other scripts:**

- `scripts/bootstrap/install.sh` — Bootstrap clone + setup, or `--in-repo`; optional `INSTALL_HERMES_PROFILE_TEMPLATES` (see header)
- `scripts/bootstrap/setup.sh` — Post-clone setup (PORT + `.env.local`, npm install, build, migrate, seed)
- `scripts/bootstrap/setup-hindsight.sh` — Optional Hindsight memory provider (PostgreSQL + pgvector + systemd unit)
- Scripts layout (bootstrap vs lib vs tooling vs `ps-deploy`): [docs/DEPLOY.md](docs/DEPLOY.md)

## Design Philosophy

PatterStage is a command centre, not a file manager. The operator opens the dashboard and instantly knows: what agents are running, what missions are active, what's healthy, what needs attention. Then in 1-2 clicks they can dispatch a new mission.

**Aesthetic (PatterTech venture):** dark, blue-tinted base (`dark-950` ≈ #040b12), **Cherenkov-blue** primary (#0071c2 anchor / #00bfff interactive / #33ddff glow) with **semantic neon accents** — cyan = primary, purple = orchestration, green = success, pink = errors, orange = heat, yellow = crown. Friendly, alive, and fun, but information-dense and scannable. Accents carry meaning; they are not decoration. Single source of truth: `src/lib/theme.ts` + `src/app/globals.css`, documented in [docs/design-tokens.md](docs/design-tokens.md).

**Sidebar sections:** Main (Dashboard, Insights, Sessions, Memory, Logs) · Orchestration (Missions, Scripts, Chat) · Operations (Agents, Skills, Tools, Personalities) · Rec Room (Story Weaver) · Config (Models, HERMES.md, Environment + YAML sections incl. a `Cron` config-section). Gateway health appears on the dashboard and in Orchestration → Chat (no separate Gateway page). The agent-cron **Cron page** was removed — recurring agent work lives in Missions, host scripts in Scripts.

**Profiles:** SQLite `agent_profiles` is the source of truth; push/pull/drift on Operations → Agents mirrors Config → Models sync. See [docs/CATALOG_AND_PROFILES.md](docs/CATALOG_AND_PROFILES.md). Per-profile Hermes toolsets: [docs/TOOLS_AND_MISSIONS.md](docs/TOOLS_AND_MISSIONS.md).

## Shell & UI Consistency

- **Page chrome:** Prefer `PageHeader` from `@/components/layout/PageHeader` for sticky top bars (title, optional back link, `actions` slot). Use `shellHeaderBarClasses` from `@/lib/theme` only when extending the shell outside `PageHeader`.
- **Page frame:** Prefer `AppPageShell` from `@/components/layout/AppPageShell` instead of repeating `min-h-screen bg-dark-950 grid-bg`. Use `variant="scanlines"` where the Rec Room / immersive aesthetic applies.
- **Tokens:** Use theme colours (`neon-*`, `dark-*`, `semantic-*`, `rgb(var(--ch-rgb-neon-*) / opacity)` in arbitrary shadows) — **do not** introduce raw hex or ad-hoc `purple-500` / `rgba(...)` in TSX unless documenting an exception in `docs/design-tokens.md`.
- **Mobile:** `MobileHeader` intentionally uses `--ch-mobile-header-min-height` (3rem), shorter than desktop `--ch-shell-header-min-height` (5rem).
- **Data viz:** Hand-rolled SVG only (no Recharts/visx) — primitives in `@/components/viz` (`Sparkline`, `AreaTrend`, `Donut`, `ProgressRing`, `ActivityHeatmap`, `RadialActivityClock`, `StackedAreaTrend`, `DistributionHistogram`, `BulletGauge`, `TopList`) take a `NeonColor`. Animate entrance via `.viz-draw` (stroke-dashoffset, gated on `prefers-reduced-motion`), not per-datum physics. Pure scale/path math goes in `viz/geometry.ts` so it's unit-testable.
- **Motion:** Use the reduced-motion-safe wrappers in `@/components/motion` (`FadeIn`, `Reveal`, `Stagger`/`StaggerItem`, `Collapse`, `useReducedMotionSafe`). Reserve Motion for **interaction-level** UI (page/section reveal, card stagger, expand/collapse); keep it **off** dense, frequently-repolling surfaces (the live dashboard panels).
