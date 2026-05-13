# Control Hub Migrations

## 2026-04 — Default Mission Data Directory

**Change:** Control Hub now stores missions, templates, operations, stories, and Rec Room data under **`$HOME/control-hub/data/`** by default (unless **`CH_DATA_DIR`** or **`CONTROL_HUB_DATA_DIR`** is set). The previous default was **`$HERMES_HOME/control-hub/data/`** (typically `~/.hermes/control-hub/data/`).

**Why:** Nested Hermes cron (`mark_job_run`) updates mission JSON under `$HOME/control-hub/data/missions/`. Aligning CH’s default avoids silent misses when Hermes posts results back to disk.

**If you already have data under `~/.hermes/control-hub/data/`:**

1. Move or symlink the tree to the new location, for example:
   - `mkdir -p ~/control-hub/data`
   - `mv ~/.hermes/control-hub/data/* ~/control-hub/data/`
2. Or set **`CH_DATA_DIR`** to your existing absolute path (no move required), for example in `.env.local`:
   - `CH_DATA_DIR=/home/you/.hermes/control-hub/data`

**Cron repeat:** Recurring jobs created by CH use **`repeat.times: null`** for “run forever”, matching Hermes’ canonical form.

## Local Hermes install resolution

**Current behaviour:** Control Hub resolves the local Hermes install path from **`HERMES_HOME`** / **`AGENT_HOME`** environment variables (default `~/.hermes`) via **`getActiveHermesPaths()`** / **`getActiveHermesHome()`** in `src/lib/hermes-agent-runtime.ts`.

**If you use env vars:** Set `HERMES_HOME` or `AGENT_HOME` to your Hermes install directory. The default is `~/.hermes`.

**Backups:** Include `CH_DATA_DIR` and your Hermes install root (`HERMES_HOME`). See [CONTROL_HUB.md](CONTROL_HUB.md) and [DEPLOY.md](DEPLOY.md).
