# Control Hub — Agent Development Guide

§

Extends `~/.hermes/AGENT.md` (base instructions). This file adds project-specific context for working on the Control Hub web application.

§

> **Always read `~/.hermes/AGENT.md` first.** It contains the universal rules, execution loop, and repository structure that apply to all agents.

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

│   │   │   ├── agent/files/        # Behaviour file CRUD

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

│   │   ├── agent/

│   │   │   ├── agents/            # Agents page (profile CRUD)

│   │   │   └── tools/              # Tools Manager

│   │   ├── page.tsx                # Dashboard

│   │   ├── kanban/              # Multi-Agent Coordination Kanban
│   │   ├── orchestration/teams/ # Team management
│   │   ├── missions/page.tsx      # Missions page

│   │   ├── cron/page.tsx           # Cron manager

│   │   ├── sessions/page.tsx       # Session browser

│   │   ├── memory/             # Memory CRUD

│   │   ├── config/             # Config editor

│   │   ├── recroom/            # Rec Room — creative activities

│   │   │   └── story-weaver/     # Interactive fiction

│   │   └── layout.tsx              # Root layout with sidebar

│   ├── components/

│   │   ├── recroom/            # Rec Room shared components

│   │   │   ├── PromptBuilder.tsx   # Universal prompt input

│   │   │   ├── OutputViewer.tsx    # Output renderer

│   │   │   ├── ActivityCard.tsx    # Activity preview card

│   │   │   ├── ActivityLayout.tsx  # Page wrapper

│   │   │   └── SaveLoadManager.tsx # Save/load/export

│   │   ├── ui/                     # Primitives (Button, Card, Modal, etc.)

│   │   └── layout/                 # Sidebar, PageHeader

│   ├── lib/

│   │   ├── api.ts                  # Typed fetch wrappers

│   │   ├── agent-registry.ts       # agents-registry.json (active Hermes installs)

│   │   ├── hermes-agent-runtime.ts # Resolved paths for active install

│   │   ├── schema/                 # Mission + template Zod schemas (in-repo)

│   │   ├── config-schema.ts        # Config section definitions

│   │   ├── theme.ts                # Shared theme maps

│   │   ├── utils.ts                # timeAgo, timeUntil, formatBytes

│   │   └── recroom/

│   │       └── prompt-templates.ts # LLM system prompts per activity

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

├── public/                         # Static assets

├── docs/                           # Technical documentation index → docs/README.md

├── next.config.ts                  # Next.js config

├── tailwind.config.ts              # Tailwind config

└── package.json

```

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

§

## Shared Utilities

§

- `src/lib/utils.ts` — `parseSchedule()`, `CronJobData`, `messageSummary()`, `timeAgo()`, `timeUntil()`, `formatBytes()`

- `src/lib/api-logger.ts` — `logApiError()`, `safeJsonParse()`, `safeReadJsonFile()`

- `src/lib/paths.ts` — `PATHS` (Control Hub–owned dirs), `CH_DATA_DIR`, `getChScriptsDir()`, `getChHardwareLogDir()`, `getDiscordHomeChannel()`
- `src/lib/hermes-agent-runtime.ts` — `getActiveHermesPaths()`, `getActiveHermesHome()`, `getAgentLlmEndpoints()`
- `src/lib/models-repository.ts` — `getDefaultModel()`, `getModel()`, `getModelWithKey()`, `setDefaultModel()`, `listModels()` (registry-backed model registry)
- `src/lib/agent-registry.ts` — persisted `agents-registry.json` under `CH_DATA_DIR`

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

# Fallback: curl with $GITHUB_TOKEN (always available)

curl -X POST https://api.github.com/repos/Daniel-Parke/hermes-control-hub/pulls \

  -H "Authorization: Bearer \$GITHUB_TOKEN" \

  -H "Content-Type: application/json" \

  -d '{"title":"type: description","body":"what changed","head":"feature/your-feature","base":"dev"}'

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

- `scripts/application/ch-deploy.sh` — **`restart`** (no git/build), **`rebuild`**, or **`update`** (pull **CH_UPDATE_GIT_BRANCH**, install deps if needed, build, profile gate, restart); reads **`CH_*` / `HERMES_HOME` / `INSTALL_HERMES_*`** from `.env.local`; bundled Hermes profile sync gated by **`CH_UPDATE_SYNC_HERMES_PROFILE_TEMPLATES`** (see `scripts/lib/ch-deploy-impl.sh`)

- `scripts/bootstrap/install.sh` — Bootstrap clone + setup, or **`--in-repo`**; optional **`INSTALL_HERMES_PROFILE_TEMPLATES`** for bundled Hermes templates (see script header)

- `scripts/bootstrap/setup.sh` — Post-clone setup (PORT + `.env.local`, npm install, build)

- `scripts/bootstrap/stop.sh` — Stop listeners on PORT (used standalone; `ch-deploy restart` stops port inline)

- `scripts/lib/ch-hermes-profile-templates.sh` — Shared bundled Hermes profile install/sync (used by bootstrap install + `ch-deploy update`)

- **Scripts layout** (bootstrap vs tooling vs `ch-deploy`): **[docs/DEPLOY.md](docs/DEPLOY.md)**



**Critical:** `-H 0.0.0.0` required for network access. `fuser -k` is more reliable than `kill`. MUST use `background=true` on the terminal tool — never use `nohup ... &` which causes pipe inheritance deadlock. See `npm-service-restart` skill for full details.

§

## Design Philosophy

§

Control Hub is a command centre, not a file manager. The operator opens the dashboard and instantly knows: what agents are running, what missions are active, what's healthy, what needs attention. Then in 1-2 clicks they can dispatch a new mission.

§

**Aesthetic:** Dark base (#030712), neon accents (cyan, purple, pink, green, orange). Information-dense but scannable. Every pixel earns its place.

§

**Sidebar sections:** Main (Dashboard, Missions, Kanban, Teams, Cron, Sessions, Memory, Gateway, Logs, Config) | Agents (Agents) | Operations (Skills, Tools, Personalities) | pinned above **All Settings**: HERMES.md, Environment | Config Sections

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

