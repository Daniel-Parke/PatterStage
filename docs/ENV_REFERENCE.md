# Environment reference

Quick lookup for PatterStage and Hermes paths. Set values in `.env.local` (created by `scripts/bootstrap/setup.sh`) or export them before `npm run start`.

> **Env naming:** canonical variables use the **`PS_`** prefix. The legacy **`CH_`** names (and `CONTROL_HUB_*`) are still read as fallbacks, so an existing `.env.local` keeps working — see [MIGRATION.md → Path & environment rename](MIGRATION.md#path--environment-rename-control-hub--patterstage).

## Naming

| Name | Meaning |
|------|---------|
| Git repo clone | `PatterStage` (this repository) |
| Default install directory | `~/patterstage` (bootstrap scripts) |
| npm package | `patterstage` |

## Core paths

| Variable | Default | Purpose |
|----------|---------|---------|
| `HERMES_HOME` | `~/.hermes` | Hermes data root: `config.yaml`, profiles, cron, sessions, skills. Python package at `{HERMES_HOME}/hermes-agent/`. (`AGENT_HOME` is accepted as a deprecated alias in code.) |
| `PS_DATA_DIR` / `CONTROL_HUB_DATA_DIR` | `~/patterstage/data` | PatterStage SQLite, missions JSON, templates, stories, hardware scripts |
| `PS_SCRIPTS_DIR` | `{PS_DATA_DIR}/scripts` | System cron script prefix (must match crontab entries) |
| `PS_HARDWARE_LOG_DIR` | `{PS_DATA_DIR}/logs` | Hardware cron log output |
| `PORT` | `42069` (or first free in 42069–42100 at setup) | Next.js listen port |

## Dual SQLite databases

| Location | When written | Notes |
|----------|--------------|-------|
| `{repo}/data/patterstage.db` | `npm run prebuild` (before `next build`) | Dev/CI convenience; recreated when `schema_version !== 3` |
| `{PS_DATA_DIR}/patterstage.db` | Runtime API + `npm run db:migrate` | **Production source of truth** on the host |

`ps-deploy update` runs `npm run build` (prebuild on repo DB) then `db:migrate` on `PS_DATA_DIR`. Use the same `PS_DATA_DIR` as the running server when troubleshooting.

## Install and setup

| Variable | Purpose |
|----------|---------|
| `PS_INSTALL_NONINTERACTIVE` | `1` — non-interactive bootstrap |
| `PS_SETUP_SKIP_CATALOG_SEED` | `1` — skip catalog seed during setup |
| `INSTALL_HERMES_PROFILE_TEMPLATES` | `yes` — optional bash copy of missing profile files (catalog seed is the main path) |

## Deploy API (sidebar Update / Rebuild)

| Variable | Purpose |
|----------|---------|
| `PS_ENABLE_DEPLOY_API` | `1` — allow `POST /api/update` |
| `PS_UPDATE_GIT_BRANCH` | Branch for `ps-deploy update` (default `dev`) |
| `PS_READ_ONLY` | `1` — block mutating API routes (503) |
| `PS_REQUEST_SIGNING_SECRET` | Optional HMAC for selected routes |

## Runtime / gateway

The runtime adapter (`src/lib/runtime/`) dispatches missions as HTTP **runs** to the Hermes **API Server** and authenticates with a bearer key.

| Variable | Purpose |
|----------|---------|
| `HERMES_GATEWAY_URL` | Hermes API Server base the runtime targets (default `http://127.0.0.1:8642`) — run dispatch, health, chat. |
| `API_SERVER_KEY` | Bearer key the runtime sends (`Authorization: Bearer …`). **Must match** the gateway's `API_SERVER_KEY` in `{HERMES_HOME}/.env`. `setup.sh` generates one and wires both sides. |
| `PS_LLM_API` / `CONTROL_HUB_LLM_API` | Full chat-completions URL or gateway-derived base (alternative to `HERMES_GATEWAY_URL`). |

## Debug artifact (not read by the app)

After setup or `ps-deploy update`, `scripts/tooling/discover-agents.mjs` writes **`PS_DATA_DIR/hermes-detection.json`** (version 3) with `valid`, `hermesHome`, `defaultRoot`, `canonicalAgentPackage`, `legacyInstallDetected`, and related fields. Use it to verify path resolution on the host; the Next.js app does not load this file at runtime.

## Related docs

- [DEPLOY.md](DEPLOY.md) — `ps-deploy`, Docker, TLS
- [MIGRATION.md](MIGRATION.md) — data directory moves, schema v3
- [HERMES_CONFIG_INTEGRATION.md](HERMES_CONFIG_INTEGRATION.md) — Hermes + PatterStage path checklist
