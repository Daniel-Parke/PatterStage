---
summary: The public front door for PatterStage: what it is, what it does, and how to install it
type: venture
tags: [product]
compiled_from: normalised
---

# PatterStage

**The Stage is _Yours._**

PatterStage is a **web control plane and orchestrator** for the [Hermes Agent](https://hermes-agent.nousresearch.com/docs/getting-started/installation). Hermes runs your agents on the machine; PatterStage gives you a dashboard to **dispatch missions, schedule recurring work, run host scripts, browse sessions and memory, manage models and profiles, and edit Hermes config** — without living in the terminal.

It owns its own state (SQLite under `PS_DATA_DIR`) and talks to the agent over Hermes' **HTTP API Server** through a single runtime adapter. There are no bash wrappers or `jobs.json` cron bridges: a mission is an HTTP **run**, and "when does this run" is a PatterStage-owned **schedule**.

![PatterStage dashboard](docs/images/dashboard.png)

*The dashboard you land on after install: live agent state, active missions and host vitals in one view.*

> A [PatterTech](https://www.pattertech.com) venture.

**Docs:** [Doc index](docs/README.md) · [Platform vision](docs/PLATFORM_VISION.md) · [Runtime architecture](docs/RUNTIME_ARCHITECTURE.md) · [Missions](docs/MISSIONS.md) · [User walkthrough](docs/USER_WALKTHROUGH_GUIDE.md) · [Cross-platform](docs/CROSS_PLATFORM.md) · [Deploy](docs/DEPLOY.md) · [Migration](docs/MIGRATION.md)

> **Renamed:** this repo was `hermes-control-hub` and is now `PatterStage`. Existing clones and forks keep working via GitHub's automatic redirect — optionally run `git remote set-url origin https://github.com/Daniel-Parke/PatterStage.git` to repoint. Full details: [docs/MIGRATION.md](docs/MIGRATION.md#repository-renamed-hermes-control-hub--patterstage).

---

## What it does

| Area | What you get |
|------|--------------|
| **Dashboard** | Live operational analytics — throughput, success rate, token usage, a 13-week run-activity heatmap, mission mix, vitals, and at-a-glance health. Lightweight progression flair (level / streak / milestones) derived from real activity — never gates anything. |
| **Missions** | Compose, dispatch, track, and **cancel** agent missions as HTTP runs. One-off or **recurring** (a mission's "Schedule" mode creates a PatterStage schedule that the built-in scheduler fires). |
| **Scripts** | Schedule **host scripts** in the user `crontab` (Linux/macOS; Windows via WSL2) — backups, cleanups, health checks — separate from agent missions. The bundled scripts are cross-platform Node (`.mjs`). |
| **Chat** | Gateway-backed chat, separate from mission dispatch. |
| **Sessions & Memory** | Browse transcripts; view the configured memory provider (Hindsight or none). |
| **Agents / Skills / Tools / Personalities** | Profile-aware configuration + a per-agent **performance** view (runs · success% · tokens · avg duration). |
| **Models** | SQLite-backed model/credential registry with write-through to Hermes `config.yaml` / `.env`. |
| **Story Weaver** | Rec Room interactive-fiction tool. |

How the pieces fit together: [docs/RUNTIME_ARCHITECTURE.md](docs/RUNTIME_ARCHITECTURE.md).

---

## What you need

| Requirement | Notes |
|-------------|--------|
| **Linux** (or macOS for dev) | PatterStage is **Linux-first** — the supported/tested target (and the [PatterOS](https://github.com/Daniel-Parke/PatterOS) home); macOS works for development. On **Windows, use WSL2 (Ubuntu)**. See [Cross-platform](docs/CROSS_PLATFORM.md). |
| **Node.js 20+** | Matches [CI](.github/workflows/ci.yml). On macOS install Xcode Command Line Tools if `npm install` fails building native modules. |
| **Hermes Agent** | [Install Hermes](https://hermes-agent.nousresearch.com/docs/getting-started/installation) for full missions, runs, and gateway features. PatterStage can start without it, but agent paths stay limited until `~/.hermes` is configured. The runtime needs Hermes' **API Server** enabled (the installer/setup does this for you). |
| **git** | For clone-based install and the in-app updater. |

---

## Quick start (operators)

1. **Install Hermes Agent** on the same machine (link above) and run `hermes setup` if prompted.

2. **Get PatterStage** (installs to `~/patterstage` by default, or use an existing clone):
   ```bash
   git clone https://github.com/Daniel-Parke/PatterStage.git
   cd PatterStage
   bash scripts/bootstrap/install.sh --in-repo
   ```
   Fresh machine without a clone yet: `bash scripts/bootstrap/install.sh` (clones to `~/patterstage`, then runs setup).

   **Windows** — run under **WSL2 (Ubuntu)**: `wsl --install -d Ubuntu` (one-time, elevated PowerShell), then open Ubuntu and follow the Linux steps above. See [Cross-platform](docs/CROSS_PLATFORM.md).

3. **Start the server:**
   ```bash
   npm run start                  # binds every interface (Next's default)
   npm run start:network          # identical; passes -H 0.0.0.0 explicitly
   ```
   `PORT` is written to `.env.local` during setup (usually **42069–42100**).

4. **Open the dashboard with the link the server prints.** PatterStage has no login: it mints one random access token on first boot and checks every request against it, so the bare `http://127.0.0.1:<PORT>/` answers **401** on purpose. The first `[auth]` line of the server output is your way in:

   ```
   [auth] Open PatterStage at http://127.0.0.1:<PORT>/?ps_token=<your token>
   [auth] Token file: <PS_DATA_DIR>/auth-token
   ```

   Open that URL once. PatterStage exchanges the token for an httpOnly session cookie and strips it back out of the address bar, so you paste it once per browser. If you lose the line, the token is the single line in `<PS_DATA_DIR>/auth-token`, and restarting the server prints the URL again. Details and the container options: [docs/SECURITY.md](docs/SECURITY.md).

5. **Catalog seeds during setup** — six professional agent profiles + mission templates land in PatterStage SQLite automatically, and are pushed to `~/.hermes/profiles/` when `HERMES_HOME` is ready. You don't need Config → Seed on a first install.

### Non-interactive install (VPS / CI / unattended)

The bootstrap and deploy scripts prompt by default and **skip every prompt** when run non-interactively. Set any of these and they run unattended:

| Flag / env | Effect |
|------------|--------|
| `PS_INSTALL_NONINTERACTIVE=1` or `CI=1` | Skip all install/setup prompts (use the env vars below for the choices). |
| `INSTALL_HERMES=yes\|no` | Install upstream Hermes then exit (re-run after), or continue without it. |
| `INSTALL_HINDSIGHT=yes\|no` | Set up the Hindsight memory provider, or skip. |
| `INSTALL_HERMES_PROFILE_TEMPLATES=yes\|no` | Copy bundled profile files (catalog seed is the main path). |
| `PS_SETUP_SKIP_CATALOG_SEED=1` | Skip the professional catalog seed. |
| `--yes` / `PS_ASSUME_YES=1` | Skip confirmation prompts on maintenance scripts (migrate, etc.). |

---

## Using the dashboard

**Page-by-page tour with screenshots:** [docs/USER_WALKTHROUGH_GUIDE.md](docs/USER_WALKTHROUGH_GUIDE.md).

| Sidebar area | What to do there |
|--------------|------------------|
| **Dashboard** | One-glance situational awareness: analytics, active missions, health, sync. Earns **achievements** as you work. |
| **Main → Insights** | Interaction analytics + achievements: activity over time, per-category breakdown, streaks, and the full achievement grid ([details](docs/ANALYTICS.md)). |
| **Orchestration → Missions** | Compose, dispatch, **schedule**, and **cancel** missions ([details](docs/MISSIONS.md)). The **Scheduled missions** section lists recurring missions with pause/resume/run-now. |
| **Orchestration → Scripts** | Host shell scripts on a timer (system crontab) — backups, cleanups, health checks. |
| **Orchestration → Chat** | Gateway-backed chat (separate from mission dispatch). |
| **Main → Sessions / Memory / Logs** | Transcripts, memory store, Hermes log tail. |
| **Operations → Agents / Skills / Tools / Personalities** | Profile-aware configuration + per-agent performance analytics. |
| **Config → Models / HERMES.md / YAML** | Model registry, environment, Hermes `config.yaml` sections. |
| **Sidebar (bottom)** | **Check** compares to remote; **Update** pulls, backs up + migrates, rebuilds, and restarts; **Rebuild** builds the current tree and restarts. |

> The legacy **Cron** page + Hermes `jobs.json` agent-cron bridge have been **removed** — scheduled agent work lives in **Missions** (recurring missions on the PatterStage scheduler), and host scripts in **Scripts**. Existing cron jobs are migrated to schedules automatically on update (see below).

---

## Where your data lives

| Location | Holds |
|----------|--------|
| **`~/.hermes`** (`HERMES_HOME`) | Hermes data: `config.yaml`, `profiles/`, sessions, the agent package (`~/.hermes/hermes-agent/`). |
| **`~/patterstage/data`** (`PS_DATA_DIR`, default) | PatterStage SQLite (`patterstage.db`), missions, templates, stories, logs — not committed to git. |

Set `PS_DATA_DIR` / `HERMES_HOME` in `.env.local` for non-default paths. Full reference: [docs/ENV_REFERENCE.md](docs/ENV_REFERENCE.md).

---

## Updating & migrating

Use the sidebar **Check → Update → Rebuild** buttons, or on the server:

```bash
bash scripts/application/ps-deploy.sh update    # pull → backup + migrate DB → build → restart
bash scripts/application/ps-deploy.sh rebuild    # build current tree (no git pull) → migrate → restart
bash scripts/application/ps-deploy.sh restart    # restart the server only
bash scripts/maintenance/ps-migrate.sh           # database migration only (interactive; --yes to skip prompts)
```

**Your data is migrated, not wiped.** Every update/migration **backs up `patterstage.db` first** (`patterstage.db.pre-migrate-<timestamp>.bak` under `PS_DATA_DIR`), then applies the full schema migration (the same applier chain the app runs at boot) and converts legacy recurring cron jobs into PatterStage schedules. The schema change is additive — existing missions, models, sessions, and credentials are preserved. If a database is ever too old/incompatible to upgrade in place, it is rebuilt from baseline with preserved tables re-imported, and anything that couldn't be carried over **remains in the backup with a logged warning** — nothing is silently lost. Details: [docs/MIGRATION.md](docs/MIGRATION.md).

See [docs/DEPLOY.md](docs/DEPLOY.md) for Docker, TLS, ports, and the LAN relay.

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| **"PatterStage needs your access token" / 401** | Working as designed. Print your token with `cat <PS_DATA_DIR>/auth-token` and open `http://127.0.0.1:<PORT>/?ps_token=<token>` once, or restart the server and use the URL on its first `[auth]` line. Deleting the token file and restarting mints a new one and signs every browser out. |
| **Port already in use** | Read `PORT` in `.env.local`; run `bash scripts/bootstrap/stop.sh`, or change `PORT` and re-run setup. |
| **Hermes not found / missions fail** | Install Hermes; set `HERMES_HOME` in `.env.local`; confirm `hermes` is on `PATH` and the API Server is enabled. |
| **Schedules / scripts not firing** | The scheduler boots with the server (`src/instrumentation.ts`); confirm the server is running and check Main → Logs. |
| **Catalog seed warning during setup** | Run `npx tsx scripts/tooling/seed-catalog.ts --merge` or use Config → Seed. |
| **Cancel didn't stop the agent** | See [Missions → Cancellation](docs/MISSIONS.md); cancellation stops the backend run over HTTP. |
| **Optional LAN relay (`PS_SOCAT_RELAY`)** | On macOS: `brew install socat`. See [docs/DEPLOY.md](docs/DEPLOY.md). |

---

## For developers

```bash
npm run dev               # hot reload (PORT + dev origins from .env.local)
npm run build && npm test # production build + Jest
npm run test:e2e          # Playwright (needs a running build)
npm run test:e2e-hermes   # full-stack against a real Hermes container — the merge gate for runtime/DB changes
```

App pages live under `src/app/`; API routes under `src/app/api/`. Orchestration core (missions, scheduler, run reconcile) is `src/lib/orchestration/`; the one seam to the agent is `src/lib/runtime/` (`AgentRuntime` → `HermesRuntime`).

- **Contributing & branches:** [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
- **Testing & CI:** [docs/TESTING.md](docs/TESTING.md)
- **REST API:** [docs/API.md](docs/API.md)
- **Analytics & achievements:** [docs/ANALYTICS.md](docs/ANALYTICS.md)
- **Agent entry point:** [AGENTS.md](AGENTS.md) · **repo tree & conventions:** [docs/REPO_GUIDE.md](docs/REPO_GUIDE.md)
- **Decisions:** [org/decisions/](org/decisions/)

---

## Scripts (high level)

| Script | Role |
|--------|------|
| `scripts/bootstrap/install.sh` | Clone + setup, or `--in-repo`; optional Hermes/Hindsight install. |
| `scripts/bootstrap/setup.sh` | `.env.local`, PORT, deps, build, **backup + migrate**, catalog seed. |
| `scripts/application/ps-deploy.sh` | `update` \| `rebuild` \| `restart` (UI-spawned; status-JSON + logs). |
| `scripts/maintenance/ps-migrate.sh` | Backup + full DB migration (schema + legacy data); interactive, `--yes` to skip. |
| `scripts/bootstrap/stop.sh` | Stop listeners on `PORT`. |
| `scripts/lib/ps-log.sh` | Shared logging + prompt helpers (`ps_info/ok/warn/err` + `ps_confirm`). |

Professional seeds: `data/seed/`. Full layout + flags: [docs/DEPLOY.md](docs/DEPLOY.md).

---

## Repository layout (short)

| Area | Purpose |
|------|---------|
| `src/app/` | Pages + `api/` routes |
| `src/lib/orchestration/` · `src/lib/runtime/` | Mission/scheduler core · agent runtime adapter |
| `src/lib/` | DB, repositories, Hermes paths, sync, stats |
| `tests/unit/` · `tests/e2e/` · `tests/integration/` | Jest · Playwright · install/runtime harnesses |
| `docs/` | Documentation |
| `scripts/` | Bootstrap, deploy, tooling, maintenance |

---

## License & trademarks

Source code and technical documentation in this repository are licensed under the [Apache License 2.0](LICENSE). See also [NOTICE](NOTICE).

The names **Patter**, **PatterStage**, **PatterTech**, and related marks, plus the official visual identity in [`branding/`](branding/), are **not** part of that license. See [TRADEMARK.md](TRADEMARK.md). If you distribute a modified version, see [REBRANDING.md](REBRANDING.md).
