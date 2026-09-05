---
summary: The one supported deployment model, the native host install, plus ports, scripts and the deploy buttons
type: guide
tags: [product, ops]
compiled_from: normalised
---

# Deploying PatterStage

How I run this in production and on a home LAN: ports, scripts, and the deploy buttons in the sidebar. Read [CONTRIBUTING.md](CONTRIBUTING.md) if you are changing deploy behaviour itself.

> **There is one supported deployment model: the native host install.** WG-OPS-002
> ruled A, one model, and a second one costs a second install path to test, a
> second set of instructions to keep true, and a second way for a stranger's
> first hour to fail. The container below is **not** a deployment model. It is the
> CI parity rig and the image the update path is tested against.

> **Platforms:** PatterStage is **Linux-first** (the supported/tested target; also macOS for development). Deploy/self-update (`ps-deploy`) is one Node program ([`scripts/tooling/ps-deploy.mjs`](../scripts/tooling/ps-deploy.mjs)); the bash `ps-deploy.sh` is a thin wrapper. On Windows, run under **WSL2 (Ubuntu)**. See [CROSS_PLATFORM.md](CROSS_PLATFORM.md).

## Host and port

Next.js reads **`PORT`**. After **`bash scripts/bootstrap/setup.sh`**, `.env.local` contains **`PORT`** (first free in **42069–42100** by default, or your chosen port) and **`PS_ALLOWED_DEV_ORIGINS`** for LAN development.

For **production / household LAN**, use **`npm run start:network`** (`next start -H 0.0.0.0`). Note that **`npm run start`** reaches the LAN too: `next start` already defaults to `0.0.0.0`, and `start:network` only states the bind explicitly. The dev-only cross-origin check on `/_next/webpack-hmr` this section used to cite belongs to `next dev`, covered next.

For **`next dev` on another machine** using a URL with a **literal IP** (e.g. `http://192.168.1.10:42069`), the browser `Origin` must be listed in **`PS_ALLOWED_DEV_ORIGINS`** (setup generates common cases). Opening the site via a **`.local` hostname** matches the `*.local` pattern in `next.config.ts` without extra entries.

Override the host port in Docker Compose with **`PORT`** (see `docker-compose.yml`).

## Scripts layout

| Location | Role |
|----------|------|
| `scripts/bootstrap/` | **`install.sh`** (clone or `--in-repo`), **`setup.sh`** and its Node twin **`setup.mjs`**, **`stop.sh`**, **`backup-hermes-config.sh`**, **`setup-hindsight.sh`**, Python helper for Hindsight |
| `scripts/application/` | **`ps-deploy.sh`**, the Unix CLI entry (`update`, `restart`, `rebuild`; optional `--branch`). It is one `exec node …` line: the deploy implementation is **`scripts/tooling/ps-deploy.mjs`**, which the dashboard spawns directly. |
| `scripts/lib/` | Shared bash modules (`ps-deploy-status.sh`, `ps-migrate.sh`, `ps-rename-migrate.sh`, Hermes profile templates, dotenv, port helpers). The deploy implementation used to live here as `ps-deploy-impl.sh`; it was ported to Node and that file is gone. |
| `scripts/tooling/` | **`ps-deploy.mjs`** (the deploy runner), **`prebuild-db.mjs`**, **`discover-agents.mjs`**, **`generate-json-schema.ts`** (also run via `npm run prebuild`, `npm run discover-hermes`, `npm run generate:schema-json`) |
| `scripts/hardware/` | Bundled host scripts. **Every** `.sh` and `.mjs` here is copied into **`PS_DATA_DIR/scripts`** when a file of that name is missing, during **`scripts/bootstrap/setup.sh`**. Behaviour: **[SYSTEM-CRON.md](SYSTEM-CRON.md)**. |
| `data/seed/` | Professional catalog (profiles, template packs); seeded via `npm run db:seed` / `ps-deploy update` (see [CATALOG_AND_PROFILES.md](CATALOG_AND_PROFILES.md)) |
| `scripts/git-hooks/` | Optional Git hooks (see [CONTRIBUTING.md](CONTRIBUTING.md)) |

Deploy from a shell. These are the same actions the dashboard triggers via **`POST /api/update`**, which runs the same `ps-deploy.mjs` runner without going through the bash wrapper:

```bash
bash scripts/application/ps-deploy.sh update
bash scripts/application/ps-deploy.sh update --branch dev
bash scripts/application/ps-deploy.sh restart
bash scripts/application/ps-deploy.sh rebuild
bash scripts/application/ps-deploy.sh rebuild --branch dev   # optional local checkout only
```

### Deploy actions (dashboard + CLI)

| Action | Git | Build | Restart |
|--------|-----|-------|---------|
| **update** | `fetch` + `reset --hard origin/<branch>` | `npm install` if `package-lock.json` is newer than `.next/BUILD_ID` (or `BUILD_ID` is absent), then `npm run build` | yes |
| **rebuild** | optional `git checkout` **only** when `--branch` is passed | identical to **update** | yes |
| **restart** | n/a | n/a | yes |

`update` and `rebuild` share one code path (`runBuildAndMigrate()` → `npmInstallIfNeeded()`), so the install rule is the same mtime test for both. Only the git step differs.

**Status file:** `~/.hermes/logs/ps-deploy.status` (`state`, `action`, `phase`, `message`, …). The sidebar polls **`GET /api/update?deploy=1`** until `success` or `failed`. Concurrent deploys return **exit 1** from the script and **409** from the API.

**Logs:** all under `~/.hermes/logs/`, listed under **Logs** in the UI. Each action writes its npm and git output to one file, `ps-update.log` for **update** and `ps-build.log` for **rebuild**; restart steps go to `ps-restart.log`, and the restarted server's own stdout to `ps-runtime.log`.

### Destructive git and `PORT`

- **`ps-deploy.sh update`** runs **`git reset --hard origin/<branch>`**. That **discards local commits** on the checked-out branch. Use only on machines where the app directory is a throwaway deploy checkout.
- **`rebuild`** does **not** pull or reset; it builds the **current working tree** unless you pass **`--branch`** to switch local checkout first.
- **`ps-deploy.sh restart`** stops whatever is listening on **`PORT`** (from the environment, else the last `PORT=` line in `.env.local`, else the first free port in **42069–42100**). It resolves the listening PIDs with **`ss -tlnp sport = :<port>`** and falls back to **`lsof -tiTCP:<port> -sTCP:LISTEN`**, then kills each process tree. A wrong **`PORT`** can kill an unrelated process; set it deliberately. If you migrated from an old install on **3000**, do a **one-time manual** cleanup of stale listeners; the script does not clear arbitrary ports by default.

## Required environment

Full table: **[ENV_REFERENCE.md](ENV_REFERENCE.md)**.

| Variable | Purpose |
|----------|---------|
| `HERMES_HOME` / `AGENT_HOME` | Hermes install root. Defaults to `~/.hermes`. |
| `PS_DATA_DIR` | PatterStage data root (default `~/patterstage/data`). |
| `PS_SCRIPTS_DIR` / `PS_HARDWARE_LOG_DIR` | Hardware cron script prefix and logs (default `PS_DATA_DIR/scripts` and `PS_DATA_DIR/logs`). |
| `PS_READ_ONLY` | Set to `1` for read-only UI/API. |

### Backup scripts (do not confuse)

| Script | What it backs up | When to use |
|--------|------------------|-------------|
| [`scripts/bootstrap/backup-hermes-config.sh`](../scripts/bootstrap/backup-hermes-config.sh) | Entire `PS_DATA_DIR` tree (SQLite, missions, templates, stories) | Manual operator backup before risky changes |
| [`scripts/hardware/ps-backup.sh`](../scripts/hardware/ps-backup.sh) | Hindsight memory JSON via `hindsight_bridge.py` under `$HERMES_HOME` | Schedule it from Orchestration → Scripts |

`ps-backup.sh` is copied into `PS_DATA_DIR/scripts` during setup when missing, along with every other `.sh` and `.mjs` in `scripts/hardware/`. `backup-hermes-config.sh` is not scheduled by PatterStage.

Run PatterStage where you trust the network, or place it behind your own reverse proxy and access controls. **`PS_REQUEST_SIGNING_SECRET`** can optionally protect specific flows (see `src/lib/api-auth.ts`).

## Docker, the CI parity rig

**This is not a way to deploy PatterStage.** The supported model is the native
host install: `bash scripts/bootstrap/install.sh`, then `npm run start:network`
(or `ps-deploy.sh`) and sidebar deploy, on a host with Node 20+. If you are
reading this to work out how to run the app, you are in the wrong section, and
[the install path](../README.md) is the one to follow.

What the container is for: it gives CI a clean machine to prove the image builds
and the `POST /api/update` restart path still works, and it gives the install
harness ([`tests/integration/test_full_install_update_process.py`](../tests/integration/test_full_install_update_process.py))
throwaway hosts to install onto. Both are testing tools.

Running it yourself is unsupported rather than forbidden. Nothing stops you, the
commands below work, and if it breaks in a way the native install does not, that
is a bug worth reporting but not one that blocks a release.

```bash
docker compose build
docker compose up -d
```

The image defaults to **`PORT=42069`** (override with `-e PORT=...` or Compose `environment`). Map the same value on the host, e.g. `PORT=42069 docker compose up -d`.

The production image includes the full **`scripts/`** tree, plus `bash`, `ca-certificates`, `curl`, `git`, `iproute2` (`ss`), `psmisc` and `socat`, so **`POST /api/update`** can spawn **`node scripts/tooling/ps-deploy.mjs`**. Of those the runner itself shells out to `git`, `npm` and `ss`/`lsof`; `bash` is there for the CLI wrapper and the bundled `.sh` host scripts. `psmisc` (`fuser`) and `socat` are installed but nothing in the repo calls either. **`restart`** brings Next back on **`0.0.0.0:$PORT`** by default (same as `npm run start:network`).

> **`PS_SOCAT_RELAY`, `PS_SOCAT_RELAY_PORT` and `PS_SOCAT_BIND` are inert.** The
> relay was launched by the old bash `ps-deploy-impl.sh`; when deploy moved to
> Node, the launcher went with it and only the stop-side pid cleanup in
> [`scripts/lib/ps-env.sh`](../scripts/lib/ps-env.sh) and the commented-out lines
> in `.env.example` survive. Setting them starts nothing. Since both `restart`
> and `npm run start:network` already bind `0.0.0.0`, there is nothing left for a
> loopback relay to do; put a reverse proxy in front if you need a second port.

**`update` / `rebuild` / GET branch list** need a **git working tree** at `process.cwd()` (`/app`). The default **`.dockerignore` excludes `.git`**, so a plain image build is not a checkout; mount a clone if you need those flows in a container.

**CI / local smoke:** after `docker build`, run **`npm run test:docker-deploy-smoke`** (or `bash tests/scripts/docker-deploy-api-smoke.sh`). It waits for the app, **`GET /api/update?branch=dev`**, **`POST` restart**, then checks the server still answers **`/`**.

Mount `PS_DATA_DIR` (and optionally `PS_SCRIPTS_DIR` / `PS_HARDWARE_LOG_DIR` if you keep hardware cron scripts outside the data tree) so the active Hermes install and PatterStage state match the host.

## Database migrate + professional catalog seed

After **`npm run build`**, **`setup.sh`**, and **`ps-deploy update` / `rebuild`**:

1. **`npm run db:migrate`**: SQLite migrations on `PS_DATA_DIR/patterstage.db`
2. **`npm run db:seed`**: upsert categories, catalog templates, and `agent_profiles`, then push profiles to **`HERMES_HOME/profiles/<slug>/`**

PatterStage SQLite is the **source of truth** for professional profiles; Hermes disk is the **runtime target** for missions/cron. Restore defaults at **Settings → Restore** (`/agent/settings/restore`), which snapshots the database before any overwrite.

Shipped seeds: **`data/seed/profiles/`**, **`data/seed/template-packs/patterstage-professional-v1.json`**. Optional install-only bash copy from **`data/seed/profiles/`**: [`scripts/lib/ps-hermes-profile-templates.sh`](../scripts/lib/ps-hermes-profile-templates.sh) (`INSTALL_HERMES_PROFILE_TEMPLATES=yes` on non-interactive `install.sh`).

`ps-deploy` loads **`HERMES_HOME`** and **`PS_DATA_DIR`** from **`.env.local`** when present.

## TLS

Use a reverse proxy with automatic certificates (Let's Encrypt). Do not commit TLS material into the repo.

## Hindsight Memory: Safe Reconnection After Deploy

Deploy updates (`ps-deploy update`, `seed-catalog.ts --replace`, or Config → Seed
push) can strip Hindsight memory configuration from `~/.hermes/config.yaml` if the
SQLite `agent_root` row is out of sync with disk, for example if Hindsight was
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
cd /path/to/patterstage
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
