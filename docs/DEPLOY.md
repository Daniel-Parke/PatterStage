# Deploying PatterStage

How I run this in production and on a home LAN—ports, scripts, Docker, and the deploy buttons in the sidebar. Read [CONTRIBUTING.md](CONTRIBUTING.md) if you are changing deploy behaviour itself.

## Host and port

Next.js reads **`PORT`**. After **`bash scripts/bootstrap/setup.sh`**, `.env.local` contains **`PORT`** (first free in **42069–42100** by default, or your chosen port) and **`CH_ALLOWED_DEV_ORIGINS`** for LAN development.

For **production / household LAN**, prefer **`npm run start:network`** (`next start -H 0.0.0.0`), which avoids Next.js dev-only cross-origin checks on `/_next/webpack-hmr`.

For **`next dev` on another machine** using a URL with a **literal IP** (e.g. `http://192.168.1.10:42069`), the browser `Origin` must be listed in **`CH_ALLOWED_DEV_ORIGINS`** (setup generates common cases). Opening the site via a **`.local` hostname** matches the `*.local` pattern in `next.config.ts` without extra entries.

Override the host port in Docker Compose with **`PORT`** (see `docker-compose.yml`).

## Scripts layout

| Location | Role |
|----------|------|
| `scripts/bootstrap/` | **`install.sh`** (clone or `--in-repo`), **`setup.sh`**, **`stop.sh`**, **`backup-hermes-config.sh`**, **`setup-hindsight.sh`**, Python helper for Hindsight |
| `scripts/application/` | **`ch-deploy.sh`** — single deploy entry for CLI and dashboard (`update`, `restart`, `rebuild`; optional `--branch`) |
| `scripts/lib/` | Shared bash modules (`ch-deploy-impl.sh`, Hermes profile templates, dotenv, port helpers, …) |
| `scripts/tooling/` | **`prebuild-db.mjs`**, **`discover-agents.mjs`**, **`generate-json-schema.ts`** (also run via `npm run prebuild`, `npm run discover-agents`, `npm run generate:schema-json`) |
| `scripts/hardware/` | Preset cron scripts; copied into **`CH_DATA_DIR/scripts`** when missing during **`scripts/bootstrap/setup.sh`**. Behaviour: **[SYSTEM-CRON.md](SYSTEM-CRON.md)**. |
| `data/seed/` | Professional catalog (profiles, template packs); seeded via `npm run db:seed` / `ch-deploy update` — [CATALOG_AND_PROFILES.md](CATALOG_AND_PROFILES.md) |
| `scripts/git-hooks/` | Optional Git hooks (see [CONTRIBUTING.md](CONTRIBUTING.md)) |

Deploy from a shell (same commands the dashboard triggers via **`POST /api/update`**):

```bash
bash scripts/application/ch-deploy.sh update
bash scripts/application/ch-deploy.sh update --branch dev
bash scripts/application/ch-deploy.sh restart
bash scripts/application/ch-deploy.sh rebuild
bash scripts/application/ch-deploy.sh rebuild --branch dev   # optional local checkout only
```

### Deploy actions (dashboard + CLI)

| Action | Git | Build | Restart |
|--------|-----|-------|---------|
| **update** | `fetch` + `reset --hard origin/<branch>` | `npm install` if lockfiles changed, then `npm run build` | yes |
| **rebuild** | optional `git checkout` **only** when `--branch` is passed | `npm install` if `package-lock.json` is newer than `.next/BUILD_ID`, then `npm run build` | yes |
| **restart** | — | — | yes |

**Status file:** `~/.hermes/logs/ch-deploy.status` (`state`, `action`, `phase`, `message`, …). The sidebar polls **`GET /api/update?deploy=1`** until `success` or `failed`. Concurrent deploys return **exit 1** from the script and **409** from the API.

**Logs:** full npm output → `ch-build.log`; restart steps → `ch-restart.log`; git/update steps → `ch-update.log` (also listed under **Logs** in the UI).

### Destructive git and `PORT`

- **`ch-deploy.sh update`** runs **`git reset --hard origin/<branch>`**. That **discards local commits** on the checked-out branch. Use only on machines where the app directory is a throwaway deploy checkout.
- **`rebuild`** does **not** pull or reset; it builds the **current working tree** unless you pass **`--branch`** to switch local checkout first.
- **`ch-deploy.sh restart`** stops whatever is listening on **`PORT`** (from the environment or the last `PORT=` line in `.env.local`, default **42069**) using **`lsof`** (Linux and macOS; `fuser` when available on Linux). A wrong **`PORT`** can kill an unrelated process; set it deliberately. If you migrated from an old install on **3000**, do a **one-time manual** cleanup of stale listeners; the script does not clear arbitrary ports by default.

## Required environment

Full table: **[ENV_REFERENCE.md](ENV_REFERENCE.md)**.

| Variable | Purpose |
|----------|---------|
| `HERMES_HOME` / `AGENT_HOME` | Hermes install root. Defaults to `~/.hermes`. |
| `CH_DATA_DIR` | PatterStage data root (default `~/control-hub/data`). |
| `CH_SCRIPTS_DIR` / `CH_HARDWARE_LOG_DIR` | Hardware cron script prefix and logs (default `CH_DATA_DIR/scripts` and `CH_DATA_DIR/logs`). |
| `CH_READ_ONLY` | Set to `1` for read-only UI/API. |

### Backup scripts (do not confuse)

| Script | What it backs up | When to use |
|--------|------------------|-------------|
| [`scripts/bootstrap/backup-hermes-config.sh`](../scripts/bootstrap/backup-hermes-config.sh) | Entire `CH_DATA_DIR` tree (SQLite, missions, templates, stories) | Manual operator backup before risky changes |
| [`scripts/hardware/ch-backup.sh`](../scripts/hardware/ch-backup.sh) | Hindsight memory JSON via `hindsight_bridge.py` under `$HERMES_HOME` | System cron preset; wired in UI under Orchestration → Scripts |

`ch-backup.sh` is copied into `CH_DATA_DIR/scripts` during setup when missing. `backup-hermes-config.sh` is not scheduled by PatterStage.

Run PatterStage where you trust the network, or place it behind your own reverse proxy and access controls. **`CH_REQUEST_SIGNING_SECRET`** can optionally protect specific flows (see `src/lib/api-auth.ts`).

## Docker

**Primary workflow:** `npm run build`, `npm run start:network` (or `ch-deploy.sh`), and sidebar deploy on a host with Node 20+. You do not need Docker for day-to-day use.

**Docker is optional** for operators who want a container (`docker-compose.yml` below) and **required in CI** only: every PR builds [`Dockerfile`](../Dockerfile) and runs [`tests/scripts/docker-deploy-api-smoke.sh`](../tests/scripts/docker-deploy-api-smoke.sh) so the production image and `POST /api/update` restart path stay valid.

```bash
docker compose build
docker compose up -d
```

The image defaults to **`PORT=42069`** (override with `-e PORT=...` or Compose `environment`). Map the same value on the host, e.g. `PORT=42069 docker compose up -d`.

The production image includes the full **`scripts/`** tree (and `bash`, `git`, `curl`, `ss` via `iproute2`, `fuser` via `psmisc`, `socat`) so **`POST /api/update`** can spawn **`scripts/application/ch-deploy.sh`**. **`restart`** brings Next back on **`0.0.0.0:$PORT`** by default (same as `npm run start:network`). For a **public relay port** without picking a LAN IP, set **`CH_SOCAT_RELAY=yes`** and optional **`CH_SOCAT_RELAY_PORT`** (default **42069**): socat listens on **`0.0.0.0:$CH_SOCAT_RELAY_PORT`** → **`127.0.0.1:$PORT`**. Override **`CH_SOCAT_BIND`** only if you need the relay on a specific interface IP (see `.env.example`).

**`update` / `rebuild` / GET branch list** need a **git working tree** at `process.cwd()` (`/app`). The default **`.dockerignore` excludes `.git`**, so a plain image build is not a checkout; mount a clone if you need those flows in a container.

**CI / local smoke:** after `docker build`, run **`npm run test:docker-deploy-smoke`** (or `bash tests/scripts/docker-deploy-api-smoke.sh`) — waits for the app, **`GET /api/update?branch=dev`**, **`POST` restart**, then checks the server still answers **`/`**.

Mount `CH_DATA_DIR` (and optionally `CH_SCRIPTS_DIR` / `CH_HARDWARE_LOG_DIR` if you keep hardware cron scripts outside the data tree) so the active Hermes install and PatterStage state match the host.

## Database migrate + professional catalog seed

After **`npm run build`**, **`setup.sh`**, and **`ch-deploy update` / `rebuild`**:

1. **`npm run db:migrate`** — SQLite migrations on `CH_DATA_DIR/control-hub.db`
2. **`npm run db:seed`** — upsert categories, catalog templates, and `agent_profiles`, then push profiles to **`HERMES_HOME/profiles/<slug>/`**

PatterStage SQLite is the **source of truth** for professional profiles; Hermes disk is the **runtime target** for missions/cron. Restore defaults at **Config → Seed** (`/config/seed`).

Shipped seeds: **`data/seed/profiles/`**, **`data/seed/template-packs/control-hub-professional-v1.json`**. Optional install-only bash copy from **`data/seed/profiles/`**: [`scripts/lib/ch-hermes-profile-templates.sh`](../scripts/lib/ch-hermes-profile-templates.sh) (`INSTALL_HERMES_PROFILE_TEMPLATES=yes` on non-interactive `install.sh`).

`ch-deploy` loads **`HERMES_HOME`** and **`CH_DATA_DIR`** from **`.env.local`** when present.

## TLS

Use a reverse proxy with automatic certificates (Let's Encrypt). Do not commit TLS material into the repo.

## Hindsight Memory — Safe Reconnection After Deploy

Deploy updates (`ch-deploy update`, `seed-catalog.ts --replace`, or Config → Seed
push) can strip Hindsight memory configuration from `~/.hermes/config.yaml` if the
SQLite `agent_root` row is out of sync with disk — for example, if Hindsight was
wired after the initial import.

### Prevention (automatic)

- **`setup.sh`** now checks for existing Hindsight config and runs
  `setup-hindsight.sh --wire-only` before `import-hermes-state.ts`, ensuring the
  SQLite capture includes the Hindsight wiring.
- **`setup-hindsight.sh`** now syncs the updated config.yaml to the PatterStage
  SQLite `agent_root` row after every config modification.

### Recovery (after a deploy stripped the config)

If the Memory page shows 0 facts or "Not Installed" after a deploy:

```bash
cd /path/to/control-hub
bash scripts/hardware/reconnect-hindsight.sh
```

This re-wires `memory:` and `plugins:hindsight:` in config.yaml and syncs the
result to SQLite so subsequent pushes preserve it.

### Manual verification

```bash
# Check that Hindsight is wired
grep "provider: hindsight" ~/.hermes/config.yaml

# Check Hindsight server health
curl http://localhost:9177/health

# Check memory count via API
curl http://localhost:9177/v1/default/banks/hermes/memories/list?limit=1
```
