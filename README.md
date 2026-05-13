# Control Hub (Hermes)

A command-centre [Next.js](https://nextjs.org/) dashboard for [Hermes Agent](https://github.com/NousResearch/hermes-agent): missions, cron, sessions, memory, config, skills, tools, and REST APIs under `src/app/api/`.

**Documentation:** [Doc index](docs/README.md) · [Control Hub overview](docs/CONTROL_HUB.md) · [Contributing](docs/CONTRIBUTING.md) · [Testing](docs/TESTING.md) · [Support](docs/SUPPORT.md) · [Security](docs/SECURITY.md) · [Code of Conduct](docs/CODE_OF_CONDUCT.md) · [API](docs/API.md) · [Deploy](docs/DEPLOY.md) · [Migration](docs/MIGRATION.md) · [Hermes config checklist](docs/HERMES_CONFIG_INTEGRATION.md) · [Platform vision](docs/PLATFORM_VISION.md) · [Changelog](CHANGELOG.md)

---

## Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Live stats, active missions, system health, mission dispatch |
| **Missions** | Templates and custom templates ([CONTROL_HUB](docs/CONTROL_HUB.md)) |
| **Agent profiles** | QA, DevOps, and SWE-style profiles |
| **Cron manager** | Agent cron (`jobs.json`) plus hardware cron under `CH_*` paths ([API](docs/API.md)) |
| **Agent behaviour** | Profile-centric editor, personalities, behaviour files |
| **Config editor** | YAML sections driven by `src/lib/config-schema.ts` (29 sections) + HERMES.md + `.env` viewer |
| **Session browser** | Conversation transcripts |
| **Memory** | Hindsight (semantic) or Holographic (structured) |
| **Personalities / skills / tools** | Profile-aware management |
| **Gateway / logs** | Connection status and log tail |
| **Story Weaver** | Rec Room interactive fiction |
| **Kanban / teams** | Multi-agent board and team roles under `src/app/orchestration/teams/` |

---

## Quick start

```bash
git clone https://github.com/Daniel-Parke/hermes-control-hub.git
cd hermes-control-hub
bash scripts/bootstrap/setup.sh    # PORT + .env.local, npm install, optional Hermes; see script header
npm run dev              # http://localhost:<PORT> from .env.local (setup picks 42069–42100)
```

Use `npm run dev:network` for LAN HMR (`CH_ALLOWED_DEV_ORIGINS` is set during setup).

---

## Prerequisites

- **Node.js 20+** (matches [CI](.github/workflows/ci.yml))
- **Hermes Agent** (optional for a standalone UI): the app resolves the local install from **`HERMES_HOME`** / **`AGENT_HOME`** (default `~/.hermes`).
- **Optional:** PostgreSQL + pgvector and Python for [Hindsight](docs/DEPLOY.md)—`bash scripts/bootstrap/setup-hindsight.sh` or follow prompts in **`scripts/bootstrap/setup.sh`**.

---

## Data, installs, and cron

- **`CH_DATA_DIR`** (or `CONTROL_HUB_DATA_DIR`, default `~/control-hub/data`): missions, templates, stories, SQLite (`control-hub.db`), and default locations for hardware-cron scripts/logs unless overridden. **Not committed**\u2014see [.gitignore](.gitignore).
- **Hermes agent cron** lives on the **active** Hermes filesystem as `cron/jobs.json` (edited by Control Hub; Hermes runs schedules). See [PLATFORM_VISION](docs/PLATFORM_VISION.md) and [MIGRATION](docs/MIGRATION.md).
- **Hardware cron** is separate: scripts and logs under **`CH_SCRIPTS_DIR`** / **`CH_HARDWARE_LOG_DIR`** (see [API](docs/API.md) `/api/cron/hardware`).
- Audit-style events may append to `~/.hermes/logs/ch-audit.log` when Hermes is present—see [.env.example](.env.example).

---

## Development

```bash
npm run dev              # hot reload
npm run build            # production build
npm run prebuild         # SQLite migrations (run before first E2E on a fresh CH_DATA_DIR)
npm test                 # Jest — tests/unit/
npm run build && npm run test:e2e                    # Playwright — tests/e2e/
npm run build && cross-env PLAYWRIGHT_SMOKE=1 npm run test:e2e   # smoke (CI-style)
```

Mission and template Zod schemas live in **`src/lib/schema/`**; regenerate JSON with `npm run generate:schema-json`. Full CI and **`app-routes`** / sidebar rules: [docs/TESTING.md](docs/TESTING.md).

---

## Scripts (high level)

| Script | Role |
|--------|------|
| `scripts/bootstrap/install.sh` | Clone + `scripts/bootstrap/setup.sh`, or `--in-repo`. Optional Hermes templates: `INSTALL_HERMES_PROFILE_TEMPLATES=yes` or interactive prompt when `HERMES_HOME/config.yaml` exists |
| `scripts/bootstrap/setup.sh` | `.env.local`, PORT, optional Hermes/Hindsight, `npm install`, build |
| `scripts/application/ch-deploy.sh` | **`update`** \| **`restart`** \| **`rebuild`** — single CLI / dashboard deploy entry (`POST /api/update`; pull, conditional npm, build, profile gate, discover-agents, restart). Options: `--branch` |
| `scripts/bootstrap/stop.sh` | Stop `next start` listeners on PORT |
| `scripts/tooling/prebuild-db.mjs` | Invoked via `npm run prebuild` |
| `scripts/tooling/discover-agents.mjs` | `npm run discover-hermes` |
| `scripts/tooling/generate-json-schema.ts` | `npm run generate:schema-json` |
| `scripts/bootstrap/backup-hermes-config.sh` | Backup `CH_DATA_DIR` (or legacy paths) |
| `scripts/bootstrap/setup-hindsight.sh` | Hindsight-only install |
| `scripts/git-hooks/pre-push` | Optional: `git config core.hooksPath scripts/git-hooks` |

Preset hardware cron shells: **`scripts/hardware/`**. Hermes markdown templates: **`scripts/bundled-profiles/`**. Shared bash modules: **`scripts/lib/`**. Full layout: [docs/DEPLOY.md](docs/DEPLOY.md).

---

## Configuration

Control Hub reads and writes Hermes **`config.yaml`** (and related files) through the API for the local Hermes install. See [HERMES_CONFIG_INTEGRATION.md](docs/HERMES_CONFIG_INTEGRATION.md).

---

## Deployment and API

- **Deploy / TLS / Docker:** [docs/DEPLOY.md](docs/DEPLOY.md)
- **REST shapes:** [docs/API.md](docs/API.md) (`{ data?, error? }` envelope)

---

## Bundled Hermes profile templates

Markdown templates live under [`scripts/bundled-profiles/`](scripts/bundled-profiles/) (QA, DevOps, SWE, plus reserved names for future packs). They install under **`HERMES_HOME/profiles/<name>/`** (default **`~/.hermes`**).

- **Install** (`scripts/bootstrap/install.sh` after `scripts/bootstrap/setup.sh`): optional. Requires **`HERMES_HOME/config.yaml`**. Copies **only missing** `SOUL.md` / `AGENTS.md` / `auth.json`. Non-interactive installs need **`INSTALL_HERMES_PROFILE_TEMPLATES=yes`**.
- **Update** (`bash scripts/application/ch-deploy.sh update`): refreshes those bundled files from the repo when enabled. Interactive runs prompt before overwriting; dashboard deploy (`POST /api/update`) runs non-interactively and syncs by default unless **`CH_UPDATE_SYNC_HERMES_PROFILE_TEMPLATES=no`**. Custom profiles you created are untouched.

Shared logic: [`scripts/lib/ch-hermes-profile-templates.sh`](scripts/lib/ch-hermes-profile-templates.sh). Keys **`HERMES_HOME`** / **`CH_*`** / **`INSTALL_HERMES_*`** in `.env.local` are read by **`ch-deploy`** and **`scripts/bootstrap/install.sh`** where documented.

---

## Repository layout (short)

| Area | Purpose |
|------|---------|
| `src/app/` | App Router pages and `api/` REST routes |
| `src/lib/` | `paths.ts`, `hermes-agent-runtime.ts`, `hermes-home.ts`, `config-schema.ts`, `schema/`, providers, utilities |
| `src/components/` | UI including `layout/sidebar-config.ts` |
| `tests/unit/` | Jest |
| `tests/e2e/` | Playwright (keep `app-routes.ts` aligned with the sidebar) |
| `docs/` | Technical and community documentation |
| `scripts/` | `bootstrap/`, `application/ch-deploy.sh`, `tooling/`, `lib/`, `hardware/`, `bundled-profiles/`, `git-hooks/` |

For a fuller tree and agent rules, see [AGENTS.md](AGENTS.md).

---

## License

[MIT](LICENSE)
