# Environment reference

Quick lookup for PatterStage and Hermes paths. Set values in `.env.local` (created by `scripts/bootstrap/setup.sh`) or export them before `npm run start`.

## Naming

| Name | Meaning |
|------|---------|
| Git repo clone | `PatterStage` (this repository) |
| Default install directory | `~/control-hub` (bootstrap scripts) |
| npm package | `patterstage` |

## Core paths

| Variable | Default | Purpose |
|----------|---------|---------|
| `HERMES_HOME` | `~/.hermes` | Hermes data root: `config.yaml`, profiles, cron, sessions, skills. Python package at `{HERMES_HOME}/hermes-agent/`. (`AGENT_HOME` is accepted as a deprecated alias in code.) |
| `CH_DATA_DIR` / `CONTROL_HUB_DATA_DIR` | `~/control-hub/data` | PatterStage SQLite, missions JSON, templates, stories, hardware scripts |
| `CH_SCRIPTS_DIR` | `{CH_DATA_DIR}/scripts` | System cron script prefix (must match crontab entries) |
| `CH_HARDWARE_LOG_DIR` | `{CH_DATA_DIR}/logs` | Hardware cron log output |
| `PORT` | `42069` (or first free in 42069–42100 at setup) | Next.js listen port |

## Dual SQLite databases

| Location | When written | Notes |
|----------|--------------|-------|
| `{repo}/data/control-hub.db` | `npm run prebuild` (before `next build`) | Dev/CI convenience; recreated when `schema_version !== 3` |
| `{CH_DATA_DIR}/control-hub.db` | Runtime API + `npm run db:migrate` | **Production source of truth** on the host |

`ch-deploy update` runs `npm run build` (prebuild on repo DB) then `db:migrate` on `CH_DATA_DIR`. Use the same `CH_DATA_DIR` as the running server when troubleshooting.

## Install and setup

| Variable | Purpose |
|----------|---------|
| `CH_INSTALL_NONINTERACTIVE` | `1` — non-interactive bootstrap |
| `CH_SETUP_SKIP_CATALOG_SEED` | `1` — skip catalog seed during setup |
| `INSTALL_HERMES_PROFILE_TEMPLATES` | `yes` — optional bash copy of missing profile files (catalog seed is the main path) |

## Deploy API (sidebar Update / Rebuild)

| Variable | Purpose |
|----------|---------|
| `CH_ENABLE_DEPLOY_API` | `1` — allow `POST /api/update` |
| `CH_UPDATE_GIT_BRANCH` | Branch for `ch-deploy update` (default `dev`) |
| `CH_READ_ONLY` | `1` — block mutating API routes (503) |
| `CH_REQUEST_SIGNING_SECRET` | Optional HMAC for selected routes |

## Runtime / gateway

The runtime adapter (`src/lib/runtime/`) dispatches missions as HTTP **runs** to the Hermes **API Server** and authenticates with a bearer key.

| Variable | Purpose |
|----------|---------|
| `HERMES_GATEWAY_URL` | Hermes API Server base the runtime targets (default `http://127.0.0.1:8642`) — run dispatch, health, chat. |
| `API_SERVER_KEY` | Bearer key the runtime sends (`Authorization: Bearer …`). **Must match** the gateway's `API_SERVER_KEY` in `{HERMES_HOME}/.env`. `setup.sh` generates one and wires both sides. |
| `CONTROL_HUB_LLM_API` | Full chat-completions URL or gateway-derived base (alternative to `HERMES_GATEWAY_URL`). |

## Debug artifact (not read by the app)

After setup or `ch-deploy update`, `scripts/tooling/discover-agents.mjs` writes **`CH_DATA_DIR/hermes-detection.json`** (version 3) with `valid`, `hermesHome`, `defaultRoot`, `canonicalAgentPackage`, `legacyInstallDetected`, and related fields. Use it to verify path resolution on the host; the Next.js app does not load this file at runtime.

## Related docs

- [DEPLOY.md](DEPLOY.md) — `ch-deploy`, Docker, TLS
- [MIGRATION.md](MIGRATION.md) — data directory moves, schema v3
- [HERMES_CONFIG_INTEGRATION.md](HERMES_CONFIG_INTEGRATION.md) — Hermes + PatterStage path checklist
