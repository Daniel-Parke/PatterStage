# Control Hub Migrations

Breaking or structural data changes, documented so upgrades are not guesswork. If something here does not match what you see on disk, open an issue with your paths and `CH_DATA_DIR`.

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

## 2026-05 — Single Hermes install path

**Change:** Control Hub no longer searches `~/.local/share/hermes-agent` or alternate package paths. Hermes code must live at **`{HERMES_HOME}/hermes-agent/`** (default `~/.hermes/hermes-agent/`). Cron and backups use that venv only.

**If you relied on `~/.local/share/hermes-agent`:** Run the [Nous Hermes installer](https://hermes-agent.nousresearch.com/docs/getting-started/installation) so the git layout exists under `~/.hermes`, or set `HERMES_HOME` to a tree that contains `hermes-agent/cron/jobs.py`.

## Local Hermes install resolution

**Current behaviour:** **`HERMES_HOME`** (default `~/.hermes`) via **`getActiveHermesPaths()`** in `src/lib/hermes-agent-runtime.ts`. Agent package: **`getHermesAgentPackageDir()`** → `{defaultRoot}/hermes-agent`.

**Backups:** Include `CH_DATA_DIR` and `HERMES_HOME`. See [DEPLOY.md](DEPLOY.md).

## 2026-05 — SQLite schema v3 (profiles, toolsets, missions)

**Change:** Fresh installs use **[`001_baseline.sql`](../src/lib/db/migrations/001_baseline.sql)** at **`schema_version = 3`** (no `tool_plugins`). Upgrades from **`main`** (v2 baseline) apply a single incremental migration **[`002_profiles_tools_parity.sql`](../src/lib/db/migrations/002_profiles_tools_parity.sql)** — profile SoT columns, `agent_root`, `skills` catalog, `missions.suggested_toolsets`, and **`DROP TABLE tool_plugins`**.

**Automatic upgrade (legacy pre-baseline DBs):** On first open after updating, Control Hub may still run the baseline rebuild path (backup → recreate → re-import). See preserved table list below.

## 2026-06 — `sessions.message_count` column (migration 006)

**Change:** New idempotent migration **[`006_sessions_message_count.sql`](../src/lib/db/migrations/006_sessions_message_count.sql)** adds a `message_count INTEGER` column to the `sessions` table. Mirrors `state.db.sessions.message_count`; populated by the Hermes state.db sync with `COALESCE(excluded.message_count, message_count)` so prior values are preserved on re-sync.

**Why:** The `/sessions` list page renders a "5 msgs" badge per row when `messageCount > 0`, and renders nothing when NULL. The detail page can also show the message count in its header subtitle. For mission/cron sessions written directly by the dispatch pipeline, `message_count` is NULL until the next sync tick populates it.

**Automatic upgrade:** The migration runs as part of the standard `db-schema-ensure` step at next server start. An inline `ensureMessageCountColumn()` in `session-repository.ts` also handles DBs that pre-date the migration but are still on an older CH version — the column is added lazily on the first sync. Idempotent via `PRAGMA if_null` matching the 005_cron_workdir.sql pattern.

**Automatic upgrade:** On first open after updating, Control Hub:

1. Backs up the existing DB to `control-hub.db.pre-baseline-<timestamp>` under `CH_DATA_DIR`
2. Recreates the database from the baseline
3. Re-imports preserved rows from the old SQLite database (see table below)
4. Overlays missions from `CH_DATA_DIR/missions/*.json` (JSON wins on duplicate mission `id`)
5. Runs idempotent Hermes registry import (`config.yaml` + `.env` → models/credentials)

**Preserved on upgrade**

| Table | Preserved |
|-------|-----------|
| `credentials` | Yes |
| `models` | Yes |
| `model_defaults` | Yes |
| `model_fallbacks` | Yes |
| `fallback_config` | Yes |
| `missions` | Yes (+ JSON overlay) |
| `cron_jobs` | Yes |
| `sessions` | Yes |
| `stories` | Yes |
| `sync_registry` | Yes |
| `gateway_platforms` | Yes |
| `tool_plugins` | No (dropped in v3; unused) |

**Fresh installs / `main` branch users:** No prior SQLite DB exists; baseline is applied on first `npm run prebuild` or first API access.

**Upgrade from `main` (schema v2 → v3):**

```bash
npm run db:migrate
npm run db:seed    # import-hermes-state + seed-catalog --merge when HERMES_HOME exists
```

After `db:migrate`, `schema_version` must be **3** and tables `agent_root` and `skills` must exist. If migrate prints `schema_version before: 2` and `after: 2`, you are on a build before the v2→v3 migrate fix — pull latest `dev` and run migrate again.

If `db:seed` fails with `no such table: agent_root`, run `npm run db:migrate` first (or upgrade Control Hub to a release that applies `002_profiles_tools_parity.sql` when `schema_version < 3`, not when the migration file prefix equals the stored version).

Then in the UI: **Operations → Tools** — Pull/Push per profile as needed. Legacy `tool_plugins` rows are not migrated (table dropped).

**Prebuild DB:** `npm run prebuild` writes `{repo}/data/control-hub.db` using the same baseline. Runtime uses `{CH_DATA_DIR}/control-hub.db` (default `~/control-hub/data/control-hub.db`). If `{repo}/data/control-hub.db` has `schema_version !== 3`, prebuild deletes and recreates it (CI/dev convenience only).

**Removed UI areas** (no SQLite tables): teams/kanban/goals — not part of current Control Hub.

## Paths after upgrade

Current **`HERMES_HOME`**, **`CH_DATA_DIR`**, profile layout, and dual SQLite locations are in **[ENV_REFERENCE.md](ENV_REFERENCE.md)**.

**Missions:** Keep mission JSON under `CH_DATA_DIR/missions/` so Hermes `mark_job_run` can update status without writing under `HERMES_HOME`.

**Detection:** `scripts/tooling/discover-agents.mjs` writes `CH_DATA_DIR/hermes-detection.json` after setup (debug only; the app does not read it).

## First release from `main` (checklist)

Before merging `dev` → `main` for users on file/YAML-only Control Hub:

1. Set `CH_DATA_DIR` or move existing `~/control-hub/data` (missions JSON, templates) to the default path.
2. Start Control Hub once; confirm `control-hub.db.pre-baseline-*` backup exists if you had an old SQLite DB.
3. Verify missions, models, and cron jobs in the UI match pre-upgrade expectations.
4. Run `npm test` and `PLAYWRIGHT_SMOKE=1 npm run test:e2e` (or full `navigation-matrix.spec.ts` before release).
5. Run `tests/integration/test_full_install_update_process.py` on a staging host if available.
