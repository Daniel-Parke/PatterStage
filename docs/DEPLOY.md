# Deploying Control Hub

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
| `scripts/hardware/` | Preset cron scripts; copied into **`CH_DATA_DIR/scripts`** when missing during **`scripts/bootstrap/setup.sh`**. Behaviour: **[HARDWARE-CRON.md](HARDWARE-CRON.md)**. |
| `scripts/bundled-profiles/` | Hermes markdown templates synced by install/update when enabled |
| `scripts/git-hooks/` | Optional Git hooks (see [CONTRIBUTING.md](CONTRIBUTING.md)) |

Deploy from a shell (same commands the dashboard triggers via **`POST /api/update`**):

```bash
bash scripts/application/ch-deploy.sh update
bash scripts/application/ch-deploy.sh update --branch dev
bash scripts/application/ch-deploy.sh restart
bash scripts/application/ch-deploy.sh rebuild --branch dev
```

### Destructive git and `PORT`

- **`ch-deploy.sh update`** and **`rebuild`** (after aligning rebuild with update) run **`git reset --hard origin/<branch>`** when a remote tip exists. That **discards local commits** on the checked-out branch. Use only on machines where the app directory is a throwaway deploy checkout.
- **`ch-deploy.sh restart`** stops whatever is listening on **`PORT`** (from the environment or the last `PORT=` line in `.env.local`, default **42069**) using **`fuser`** / **`lsof`**. A wrong **`PORT`** can kill an unrelated process; set it deliberately. If you migrated from an old install on **3000**, do a **one-time manual** cleanup of stale listeners; the script does not clear arbitrary ports by default.

## Required environment

| Variable | Purpose |
|----------|---------|
| `HERMES_HOME` / `AGENT_HOME` | Hermes install root. Defaults to `~/.hermes`. |
| `CH_DATA_DIR` | Control Hub data root (default `~/control-hub/data`).
| `CH_SCRIPTS_DIR` / `CH_HARDWARE_LOG_DIR` | Hardware cron script prefix and logs (default `CH_DATA_DIR/scripts` and `CH_DATA_DIR/logs`). |
| `CH_READ_ONLY` | Set to `1` for read-only UI/API. |

Run Control Hub where you trust the network, or place it behind your own reverse proxy and access controls. **`CH_REQUEST_SIGNING_SECRET`** can optionally protect specific flows (see `src/lib/api-auth.ts`).

## Docker

```bash
docker compose build
docker compose up -d
```

The image defaults to **`PORT=42069`** (override with `-e PORT=...` or Compose `environment`). Map the same value on the host, e.g. `PORT=42069 docker compose up -d`.

The production image includes the full **`scripts/`** tree (and `bash`, `git`, `curl`, `ss` via `iproute2`, `fuser` via `psmisc`, `socat`) so **`POST /api/update`** can spawn **`scripts/application/ch-deploy.sh`**. **`restart`** brings Next back on **`0.0.0.0:$PORT`** by default (same as `npm run start:network`). For a **public relay port** without picking a LAN IP, set **`CH_SOCAT_RELAY=yes`** and optional **`CH_SOCAT_RELAY_PORT`** (default **42069**): socat listens on **`0.0.0.0:$CH_SOCAT_RELAY_PORT`** → **`127.0.0.1:$PORT`**. Override **`CH_SOCAT_BIND`** only if you need the relay on a specific interface IP (see `.env.example`).

**`update` / `rebuild` / GET branch list** need a **git working tree** at `process.cwd()` (`/app`). The default **`.dockerignore` excludes `.git`**, so a plain image build is not a checkout; mount a clone if you need those flows in a container.

**CI / local smoke:** after `docker build`, run **`npm run test:docker-deploy-smoke`** (or `bash tests/scripts/docker-deploy-api-smoke.sh`) — waits for the app, **`GET /api/update?branch=dev`**, **`POST` restart**, then checks the server still answers **`/`**.

Mount `CH_DATA_DIR` (and optionally `CH_SCRIPTS_DIR` / `CH_HARDWARE_LOG_DIR` if you keep hardware cron scripts outside the data tree) so the active Hermes install and Control Hub state match the host.

## Hermes bundled profile templates

Control Hub can copy **shipped** Hermes profile markdown from `scripts/bundled-profiles/` into **`HERMES_HOME/profiles/`** (see [`scripts/lib/ch-hermes-profile-templates.sh`](../scripts/lib/ch-hermes-profile-templates.sh)).

| Variable | When | Behaviour |
|----------|------|-----------|
| `INSTALL_HERMES_PROFILE_TEMPLATES` | `scripts/bootstrap/install.sh`, non-interactive | Set to `yes` to install missing template files; omit/`no` skips (interactive defaults to a prompt when Hermes `config.yaml` exists). |
| `CH_UPDATE_SYNC_HERMES_PROFILE_TEMPLATES` | `scripts/application/ch-deploy.sh update` | `yes`: overwrite bundled `SOUL.md`/`AGENTS.md` from the repo. `no`: skip profile sync. Unset + interactive TTY: prompt. Unset + non-TTY (e.g. dashboard deploy spawn): sync by default. |

`ch-deploy` loads **`HERMES_HOME`** and the variables above from **`.env.local`** when present (same keys as Next.js). For **systemd** or Docker **without** `.env.local**, export these in the unit file or Compose `environment` block.

## TLS

Use a reverse proxy with automatic certificates (Let’s Encrypt). Do not commit TLS material into the repo.
