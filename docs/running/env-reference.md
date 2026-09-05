---
title: Environment reference
summary: Every environment variable PatterStage reads, plus the Hermes paths and keys it needs, with defaults and what consumes them
section: running
nav: 20
audience: operator
type: reference
tags: [product, config]
compiled_from: normalised
---
# Environment reference

Quick lookup for PatterStage and Hermes paths. Set values in `.env.local` (created by `scripts/bootstrap/setup.sh`) or export them before `npm run start`.

> **Env naming:** canonical variables use the **`PS_`** prefix. The legacy **`CH_`** names (and `CONTROL_HUB_*`) are still read as fallbacks, so an existing `.env.local` keeps working. See [MIGRATION.md → Path & environment rename](MIGRATION.md#path--environment-rename-control-hub--patterstage).

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
| `PS_DB_BACKUP_DIR` | `{PS_DATA_DIR}/backups/db` | Where database snapshots are written and listed from (Settings > System, and the snapshot taken before a restore or a purge) |
| `PORT` | `42069` (or first free in 42069–42100 at setup) | Next.js listen port |

## Dual SQLite databases

| Location | When written | Notes |
|----------|--------------|-------|
| `{repo}/data/patterstage.db` | `npm run prebuild` (before `next build`) | Dev/CI convenience. Deleted and rebuilt from the baseline **only** when `schema_version < 3`; migrations then carry it up to head (`MIGRATION_HEAD_SCHEMA_VERSION` in `src/lib/db-schema.ts`). A repo DB already at or above the baseline survives a build untouched. |
| `{PS_DATA_DIR}/patterstage.db` | Runtime API + `npm run db:migrate` | **Production source of truth** on the host |

`ps-deploy update` runs `npm run build` (prebuild on repo DB) then `db:migrate` on `PS_DATA_DIR`. Use the same `PS_DATA_DIR` as the running server when troubleshooting.

## Install and setup

| Variable | Purpose |
|----------|---------|
| `PS_INSTALL_NONINTERACTIVE` | `1`: non-interactive bootstrap |
| `PS_SETUP_SKIP_CATALOG_SEED` | `1`: skip catalog seed during setup |
| `INSTALL_HERMES_PROFILE_TEMPLATES` | `yes`: optional bash copy of missing profile files (catalog seed is the main path) |

## Access control

Enforced in `src/proxy.ts` for every request. See [SECURITY.md](../SECURITY.md) for the full model.

| Variable | Purpose |
|----------|---------|
| `PS_AUTH_TOKEN` | Supply the operator token directly (containers). Wins over the token file. |
| `PS_AUTH_TOKEN_FILE` | Override the token path (default `PS_DATA_DIR/auth-token`, minted on first boot). |
| `PS_AUTH_MODE` | `none`: disable authentication entirely. Only correct behind your own access control; host-executing writes are refused in this mode. |
| `PS_READ_ONLY` | `1`: reject unsafe HTTP **methods** (503). Reads keep working. |

## Deploy API (sidebar Update / Rebuild)

| Variable | Purpose |
|----------|---------|
| `PS_ENABLE_DEPLOY_API` | Gates `POST /api/update`: Update, Rebuild and Restart on Settings › System (they left the sidebar in the final-release regroup; the rail keeps a version line and an "Update available" badge). Setup writes `true` on a fresh install and never overwrites a value already there, so the buttons work out of the box and stay off if you turned them off. Set `0`/`false`/`no` to close the route; the page says so before the click. Unset (an install that predates setup writing it), the gate is open whenever `NODE_ENV !== "production"` and closed in production. |
| `PS_UPDATE_GIT_BRANCH` | Branch for `ps-deploy update` (default `dev`) |
| `PS_REQUEST_SIGNING_SECRET` | Optional HMAC on `POST /api/update`, the only route that checks it. When set, the request must carry `x-ps-ts` and `x-ps-signature` inside a 5 minute window. |

## Runtime / gateway

The runtime adapter (`src/lib/runtime/`) dispatches missions as HTTP **runs** to the Hermes **API Server** and authenticates with a bearer key.

| Variable | Purpose |
|----------|---------|
| `HERMES_GATEWAY_URL` | Hermes API Server base the runtime targets (default `http://127.0.0.1:8642`). Used for run dispatch, health, chat. |
| `API_SERVER_KEY` | Bearer key the runtime sends (`Authorization: Bearer …`). **Must match** the gateway's `API_SERVER_KEY` in `{HERMES_HOME}/.env`. `setup.sh` generates one and wires both sides. |
| `PS_LLM_API` / `CONTROL_HUB_LLM_API` | Full chat-completions URL or gateway-derived base (alternative to `HERMES_GATEWAY_URL`). |

## Laboratory + Composer (feature flags + search)

| Variable | Purpose |
|----------|---------|
| `PS_COMPOSER` | **Default ON.** Set to `0` (or `false`/`no`/`off`) to disable the [Composer](../guides/composer.md) graph orchestrator: its sidebar link is hidden, the page 404s, and the engine + API go dormant. Any other value (unset / `1` / `true`) keeps it enabled. |
| `PS_SEARCH_PROVIDER` | Search backend for [Deep Research](../guides/research.md): `duckduckgo` (default, free/no-key), `searxng`, or `none`. |
| `PS_SEARXNG_URL` | Base URL of a self-hosted SearXNG instance (fully local search). When set without `PS_SEARCH_PROVIDER`, SearXNG is auto-preferred. |

> `PS_BENCH_JUDGE_MODEL` used to be listed here. The benchmark subsystem was deleted (see `org/decisions/`), nothing reads the variable, and setting it does nothing.

## Runtime limits and sync

Read straight from the process environment; `setup.sh` writes no `.env.local` entry for these, so export them or add them by hand.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PS_RUN_MAX_MINUTES` / `CH_RUN_MAX_MINUTES` | `120` (never below `10`) | Safety cap for a mission that declared no timeout of its own. Past this plus a 5 minute grace, reconcile treats the run as stuck. A mission's own `timeoutMinutes` wins over it. |
| `PS_GATEWAY_MAX_INFLIGHT` | `8` (never below `1`) | Concurrent request/response calls this process allows per gateway endpoint. Streams hold no slot. |
| `PS_GATEWAY_MAX_QUEUE` | `32` | Callers allowed to wait for a slot, per endpoint. `0` refuses at once. Beyond it a call answers **503** naming the gate and the endpoint. |
| `PS_GATEWAY_QUEUE_TIMEOUT_MS` | `10000` | How long a queued caller waits before it is refused with the same 503. |
| `MAX_SESSION_FILE_BYTES` | `67108864` (64 MiB) | `GET /api/sessions/[id]` answers **413** rather than loading a transcript bigger than this. |
| `MAX_SESSION_MESSAGES` | `2000` | How many messages one transcript answer carries. Over it, the newest N are sent and the page says so. |
| `SESSIONS_API_RATE_LIMIT_MAX` | `120` | Reads of `/api/sessions*` allowed per client per rolling 60 second window. Over it the route answers **429**. |
| `PS_PULL_RECONCILE_DISK` / `CH_PULL_RECONCILE_DISK` | unset | `1`: `POST /api/agent/profiles/sync/pull` reconciles against disk on every call, as if the request body had set `reconcileDisk`. |

## Debug artifact (not read by the app)

After setup or `ps-deploy update`, `scripts/tooling/discover-agents.mjs` writes **`PS_DATA_DIR/hermes-detection.json`** (version 3) with `valid`, `hermesHome`, `defaultRoot`, `canonicalAgentPackage`, `legacyInstallDetected`, and related fields. Use it to verify path resolution on the host; the Next.js app does not load this file at runtime.

## Related docs

- [DEPLOY.md](DEPLOY.md): `ps-deploy`, Docker, TLS
- [MIGRATION.md](MIGRATION.md): the path and environment rename, data directory moves, how migrations work
- [HERMES_CONFIG_INTEGRATION.md](env-reference.md): Hermes + PatterStage path checklist

---

## How PatterStage reads the agent's own configuration

Merged from `HERMES_CONFIG_INTEGRATION.md` in T-0109, so one page answers one question.

## Hermes config integration

If you also use a separate **`hermes-config`** repo (dotfiles, extra scripts), keep paths consistent with PatterStage and Hermes when both exist on a machine.

## How PatterStage resolves paths

Path and environment variables (`HERMES_HOME`, `PS_DATA_DIR`, `PORT`, install flags) are documented in **[ENV_REFERENCE.md](env-reference.md)**. Code: `getHermesHome()` in [`src/modules/hermes/lib/home.ts`](../../src/modules/hermes/lib/home.ts), `getActiveHermesPaths()` in [`src/modules/hermes/lib/agent-runtime.ts`](../../src/modules/hermes/lib/agent-runtime.ts), profile helpers in [`src/modules/hermes/lib/profile-paths.ts`](../../src/modules/hermes/lib/profile-paths.ts).

**Canonical layout:**

| Path | Purpose |
|------|---------|
| `HERMES_HOME` (default `~/.hermes`) | `config.yaml`, `.env`, cron, sessions, skills, profiles |
| `{HERMES_HOME}/hermes-agent/` | Hermes Python package + `venv/bin/python3` (Hindsight/backup scripts) |

After bootstrap/setup, [`scripts/tooling/discover-agents.mjs`](../../scripts/tooling/discover-agents.mjs) writes **`PS_DATA_DIR/hermes-detection.json`** for operator debugging only (the app does not read it at runtime).

## What to verify in hermes-config scripts

1. **PatterStage data** lives at `PS_DATA_DIR`, not under `HERMES_HOME` unless you intentionally colocate. With the variable unset, PatterStage probes `~/PatterStage/data`, `~/patterstage/data` and `~/control-hub/data` in that order and prefers whichever already holds a database, creating `~/patterstage/data` only if none of the three exists. If your hermes-config scripts hardcode one of those paths, set `PS_DATA_DIR` explicitly on both sides so the two never disagree about which is live.

2. **Backup/sync jobs** should include `PS_DATA_DIR` alongside `HERMES_HOME`.

3. **Scheduling:** recurring missions are **PatterStage-owned** (the `schedules` table + built-in scheduler); PatterStage no longer writes the legacy Hermes `{HERMES_HOME}/cron/jobs.json` agent-cron bridge. That file is only *read* when present, to give cron-sourced agent sessions human-friendly titles. The reader is `loadCronJobsMap()` in [`src/modules/hermes/lib/cron-jobs.ts`](../../src/modules/hermes/lib/cron-jobs.ts), reached through the module port as `loadAgentCronJobs`. It returns an empty map on a missing or unparseable file and never throws, so an install with no `jobs.json` simply falls back to the raw job id.

4. **Config and behaviour files** Hermes reads must exist under the resolved `HERMES_HOME` for that profile.

## PatterStage scripts in this repo

| Script | Notes |
|--------|-------|
| `scripts/bootstrap/setup.sh` | Creates `PS_DATA_DIR`; prints Hermes path banner; runs `discover-agents.mjs`. |
| `scripts/bootstrap/backup-hermes-config.sh` | Backs up `PS_DATA_DIR` and `HERMES_HOME` state. |
| `scripts/hardware/ps-backup.sh` | Hindsight snapshot; uses `$HERMES_HOME/hermes-agent/venv/bin/python3`. |

When you add or clone `hermes-config`, align any data paths with [ENV_REFERENCE.md](env-reference.md).
