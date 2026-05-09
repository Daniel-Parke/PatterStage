# Control Hub (Hermes)





A command centre dashboard for [Hermes Agent](https://github.com/NousResearch/hermes-agent). Monitor your agent fleet, dispatch missions, manage configurations, and control everything from one place.





**Docs:** [OSS scope](docs/OSS_SCOPE.md) · [Edition components](docs/EDITION_COMPONENTS.md) · [Platform vision](docs/PLATFORM_VISION.md) · [Deploy / TLS / Docker](docs/DEPLOY.md) · [Changelog](CHANGELOG.md) · [Migration (data dir)](docs/MIGRATION.md) · [hermes-config checklist](docs/HERMES_CONFIG_INTEGRATION.md)





![Dashboard](screenshots/Hermes_Dashboard.png)





---





## Features





| Feature | Description |


|---------|-------------|


| **Dashboard** | Live stats, active missions, system health, collapsible mission dispatch |


| **Missions** | Built-in templates and custom templates within the OSS scope ([docs/OSS_SCOPE.md](docs/OSS_SCOPE.md)) |


| **Agent Profiles** | QA, DevOps, and SWE specialist profiles |


| **Cron Manager** | Schedule, edit, and monitor recurring tasks (1m to 7d intervals) |


| **Agent Behaviour** | Profile-centric editor with personality selection, file editing per profile |


| **Config Editor** | Full config.yaml editing with 27 sections + HERMES.md + .env viewer |


| **Session Browser** | View conversation transcripts across all gateways |


| **Memory** | Hindsight (semantic search) or Holographic (structured facts) memory management |


| **Personalities** | Per-profile personality configuration (technical, analytical, creative, etc.) |


| **Skills Manager** | Profile-aware skills with inline toggle switches and content viewer |


| **Tools Manager** | Profile-aware toolsets with per-tool toggles per platform |


| **Gateway** | Monitor platform connections (Discord, Telegram, etc.) |


| **Logs** | Browse recent log entries for quick triage |


| **Story Weaver** | Collaborative AI fiction — create worlds, write chapters, build stories |

| **Kanban Board** | Multi-agent coordination board with drag-and-drop cards, WIP limits, per-card goal loops, and mission linkage |

| **Team Management** | Define agent teams with leader/specialist/reviewer roles, assign cards to team members, track board membership |





---





## Quick Start





```bash


# Clone and install


git clone https://github.com/Daniel-Parke/hermes-control-hub.git ~/control-hub


cd ~/control-hub


bash scripts/install.sh


```





The installer will:


1. Check prerequisites (Node.js 18+, Hermes agent)


2. Install dependencies and build


3. Create 3 specialist agent profiles (QA Engineer, DevOps Engineer, SWE Engineer)


4. Optionally set up Hindsight memory (PostgreSQL + semantic search)





The dashboard will be available at `http://localhost:3000` (or `http://localhost:$PORT` if you set the `PORT` environment variable; Next.js reads `PORT` for `npm run dev` / `npm run start`).





### OSS build output vs runtime routes





`next build` may list routes from the compiled graph; **what you can open** in this repository is defined by the shipped source tree plus **`middleware`** and **`CH_EDITION` / `NEXT_PUBLIC_CH_EDITION`** (see `.env.example`). See [docs/OSS_SCOPE.md](docs/OSS_SCOPE.md).





### Port already in use (`EADDRINUSE`)





If `npm run start` fails because port 3000 is taken, stop the old server first (often a previous `next start`). On Linux: `fuser -k 3000/tcp` or use another port, e.g. `PORT=3001 npm run start`.





### Resilience: Control Hub vs Hermes





- **Scheduled missions and cron jobs** live in Hermes’ `~/.hermes/cron/jobs.json`. Once written, the **Hermes** process (for example the gateway) **runs** them on its scheduler tick. The Control Hub web app is only an editor for that file plus local dashboard JSON under **`$HOME/control-hub/data/`** (override with **`CH_DATA_DIR`** or **`CONTROL_HUB_DATA_DIR`** so Hermes `mark_job_run` can update mission files in the same place). See [docs/MIGRATION.md](docs/MIGRATION.md) if you used the older default under `~/.hermes/control-hub/data/`.


- If **Control Hub (Next.js) stops**, jobs **keep firing** as long as **Hermes** is still running.


- If **Hermes stops**, nothing runs until you start Hermes again—there is no separate scheduler inside Control Hub.





### Platforms





- **Linux / macOS / WSL2 / Android (Termux):** supported.


- **Windows (native):** unsupported; use WSL2.





### Security-related environment variables





| Variable | Purpose |


|----------|---------|


| `CH_API_KEY` | When set, mutating API routes require header `X-CH-API-Key` or `Authorization: Bearer <key>`. |


| `CH_READ_ONLY` | Set to `1` or `true` to reject writes (503). |


| `CH_ENABLE_DEPLOY_API` | Set to `false` to block `POST /api/update` even in development. In **production**, deploy is off unless you set this to `true`. |


| `CH_UPDATE_GIT_BRANCH` | Branch for git pull/reset (default `dev`) |


| `CH_ALLOWED_DEV_ORIGINS` | Comma-separated origins allowed with Next dev (see `next.config.ts`). |





Audit-style events append JSON lines to `~/.hermes/logs/ch-audit.log`. See [.env.example](.env.example).





### Testing





```bash


npm test          # Jest (OSS suite)


npm run build && PLAYWRIGHT_OSS_ONLY=1 npm run test:e2e   # Playwright OSS smoke


```





---





## Prerequisites





- **Node.js** 18+


- **Hermes Agent** with data under `~/.hermes/` (or set **`HERMES_HOME`** to match Hermes; Control Hub defaults to `path.join(os.homedir(), '.hermes')` in Node, same idea as Hermes). Run `hermes update` first.





### Optional: Hindsight Memory





For long-term memory with semantic search, install Hindsight during setup:





```bash


# During install — answer "y" when prompted


bash scripts/install.sh





# Or install on existing setup


bash scripts/setup-hindsight.sh


```





Hindsight requires:


- PostgreSQL with pgvector extension


- ~2GB disk for Python packages (PyTorch, transformers)


- Sudo access for PostgreSQL installation





---





## Memory Providers





Control Hub supports multiple memory backends:





| Provider | Type | Features | Setup |


|----------|------|----------|-------|


| **Hindsight** | Knowledge graph | Semantic search, reflection, entities, directives | `bash scripts/setup-hindsight.sh` |


| **Holographic** | SQLite | Structured facts, trust scoring, categories | `hermes plugins install hermes-memory-store` |


| **None** | — | No persistent memory | Default if nothing configured |





The dashboard automatically detects your configured provider and adapts the Memory page accordingly. If no provider is configured, it shows an informative notice.





---





## Agent Profiles





3 specialist profiles are created during install:





| Profile | Focus | Skills |


|---------|-------|--------|


 | QA Engineer | Testing, bug reproduction | 75 enabled |
 | DevOps Engineer | Infrastructure, CI/CD | 72 enabled |
 | SWE Engineer | Software development | 74 enabled |


Each profile has its own SOUL.md, AGENTS.md, USER.md, MEMORY.md, and skill/tool configuration. All profiles share the main agent's API keys.
Each profile has its own SOUL.md, AGENTS.md, USER.md, MEMORY.md, and skill/tool configuration. All profiles share the main agent's API keys.





---





## Scripts





| Script | Purpose |


|--------|---------|


| `install.sh` | One-command installer (fresh or reinstall) |


| `setup.sh` | Post-clone setup (npm install, build, test) |


| `setup-hindsight.sh` | Standalone Hindsight memory installer |


| `restart.sh` | Safe server restart (kill port 3000, start, health check) |


| `safe-restart.sh` | Minimal restart (kill + start, no health check) |


| `update.sh` | Pull from main, npm install (if needed), build, update profiles, restart |


| `backup-hermes-config.sh` | Backup/restore Hermes config |


| `hindsight-server.py` | Hindsight memory backend server |





---





## Development





```bash


cd ~/control-hub





# Development (hot reload)


npm run dev





# Production build


npm run build





# Start production server


npm run start:network    # LAN accessible


npm run start            # localhost only





# Run tests


npm test


```





---





## Configuration





Control Hub reads from `~/.hermes/config.yaml` — it never writes to this file directly.





Key config sections:


- `memory.provider` — Memory backend (hindsight, holographic, none)


- `plugins.hindsight` — Hindsight server configuration


- `platform_toolsets` — Which tools are available per platform


- `skills.disabled` — Skills to exclude from the prompt





---





## Deployment





```bash


# 1. Build (must pass before deploy)


cd ~/control-hub && npm run build





# 2. Kill existing server


fuser -k 3000/tcp 2>/dev/null; sleep 2





# 3. Start server (use background=true in terminal tool — NEVER use nohup ... &)


node node_modules/next/dist/bin/next start -p 3000 -H 0.0.0.0


```





Or use the Update API for zero-downtime-style deploys:





```bash


# Check for updates


curl http://localhost:3000/api/update





# Trigger update (pull + build + restart)


curl -X POST http://localhost:3000/api/update \


  -H "Content-Type: application/json" \


  -d '{"action": "update"}'





# Restart only


curl -X POST http://localhost:3000/api/update \


  -H "Content-Type: application/json" \


  -d '{"action": "restart"}'


```





The update endpoint uses a lock file (`/tmp/ch-deploy.lock`) to prevent concurrent deploys. Build failures abort without restarting the server.





---





## API





All API routes follow the `{ data?, error? }` envelope pattern:





```typescript


// Success


{ data: { profiles: [...] } }





// Error


{ error: "Profile not found" }


```





Error logging: all catch blocks call `logApiError(route, context, error)`.





---





## Requirements





- Node.js 20+


- Hermes Agent installed at `~/.hermes/`


- (Optional) PostgreSQL + pgvector for Hindsight memory


- (Optional) Python 3.11 + venv for Hindsight





---





## Documentation





Documentation for **Control Hub OSS** lives in the `docs/` directory:





| Document | Description |


|----------|-------------|


| [OSS scope](docs/OSS_SCOPE.md) | What this repository includes and excludes |


| [Edition components](docs/EDITION_COMPONENTS.md) | OSS component inventory for this repository |


| [API Reference](docs/API.md) | REST endpoints with request/response formats |


| [Contributing](docs/CONTRIBUTING.md) | Development workflow, code standards, PR checklist |


| [Platform Vision](docs/PLATFORM_VISION.md) | Architecture, goals, and design philosophy |





---





## Architecture





```


control-hub/


├── src/


│   ├── app/                    # Next.js pages + API routes


│   │   ├── api/                # REST endpoints ({ data?, error? } envelope)


│   │   ├── agent/              # Behaviour, Tools pages


│   │   ├── skills/             # Skills manager


│   │   ├── memory/             # Memory browser (provider-aware)


│   │   ├── config/             # Config editor (27+ sections)


│   │   ├── kanban/            # Kanban board (columns, cards, WIP limits)
│   │   ├── orchestration/     # Teams
│   │   │   └── teams/page.tsx # Team CRUD, member management
│   ├── missions/             # Mission dispatch + tracking


│   │   ├── cron/               # Cron job manager


│   │   ├── sessions/           # Session browser


│   │   └── recroom/            # Creative activities


│   ├── components/             # React components


│   │   ├── memory/             # HindsightBrowser, HolographicBrowser


│   │   ├── layout/             # Sidebar, PageHeader


│   │   └── ui/                 # Button, Card, Modal, Badge, etc.


│   ├── lib/                    # Shared utilities


│   │   ├── memory-providers/   # Memory provider abstraction layer


│   │   ├── config-schema.ts    # Config section definitions


│   │   ├── hermes.ts           # Path constants, config helpers


│   │   ├── jobs-repository.ts # Atomic jobs.json read/write (Hermes-compatible)


│   │   ├── path-security.ts    # Profile/skill path allowlisting


│   │   └── utils.ts            # timeAgo, formatBytes, parseSchedule


│   └── types/                  # TypeScript interfaces


├── scripts/                    # Shell scripts


│   ├── install.sh              # One-command installer (with optional Hindsight)


│   ├── setup.sh                # Post-clone setup (npm install, build)


│   ├── setup-hindsight.sh      # Standalone Hindsight installer


│   ├── restart.sh              # Safe server restart (no nohup)


│   ├── safe-restart.sh         # Minimal restart script


│   ├── update.sh               # Git pull + build + restart


│   └── backup-hermes-config.sh # Config backup


└── data/                       # Mission + template JSON files


```





---





## License





MIT


