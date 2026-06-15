# Hermes config integration

If you also use a separate **`hermes-config`** repo (dotfiles, extra scripts), keep paths consistent with Control Hub and Hermes when both exist on a machine.

## How Control Hub resolves paths

Path and environment variables (`HERMES_HOME`, `CH_DATA_DIR`, `PORT`, install flags) are documented in **[ENV_REFERENCE.md](ENV_REFERENCE.md)**. Code: `getHermesHome()` in [`src/lib/hermes-home.ts`](../src/lib/hermes-home.ts), `getActiveHermesPaths()` in [`src/lib/hermes-agent-runtime.ts`](../src/lib/hermes-agent-runtime.ts), profile helpers in [`src/lib/hermes-profile-paths.ts`](../src/lib/hermes-profile-paths.ts).

**Canonical layout:**

| Path | Purpose |
|------|---------|
| `HERMES_HOME` (default `~/.hermes`) | `config.yaml`, `.env`, cron, sessions, skills, profiles |
| `{HERMES_HOME}/hermes-agent/` | Hermes Python package + `venv/bin/python3` (Hindsight/backup scripts) |

After bootstrap/setup, [`scripts/tooling/discover-agents.mjs`](../scripts/tooling/discover-agents.mjs) writes **`CH_DATA_DIR/hermes-detection.json`** for operator debugging only (the app does not read it at runtime).

## What to verify in hermes-config scripts

1. **Control Hub data** lives at `CH_DATA_DIR` (default `~/control-hub/data`), not under `HERMES_HOME` unless you intentionally colocate.

2. **Backup/sync jobs** should include `CH_DATA_DIR` alongside `HERMES_HOME`.

3. **Scheduling** — recurring missions are **Control Hub-owned** (the `schedules` table + built-in scheduler); Control Hub no longer writes the legacy Hermes `{HERMES_HOME}/cron/jobs.json` agent-cron bridge. That file is only *read* when present, to give cron-sourced agent sessions human-friendly titles (`session-title-server.ts`).

4. **Config and behaviour files** Hermes reads must exist under the resolved `HERMES_HOME` for that profile.

## Control Hub scripts in this repo

| Script | Notes |
|--------|-------|
| `scripts/bootstrap/setup.sh` | Creates `CH_DATA_DIR`; prints Hermes path banner; runs `discover-agents.mjs`. |
| `scripts/bootstrap/backup-hermes-config.sh` | Backs up `CH_DATA_DIR` and `HERMES_HOME` state. |
| `scripts/hardware/ch-backup.sh` | Hindsight snapshot; uses `$HERMES_HOME/hermes-agent/venv/bin/python3`. |

When you add or clone `hermes-config`, align any data paths with [ENV_REFERENCE.md](ENV_REFERENCE.md).
