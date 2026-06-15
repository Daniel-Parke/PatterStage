# Control Hub — Migrations & Upgrades

How Control Hub keeps your data across upgrades, and what happens when an existing install moves to a newer version. If something here doesn't match what you see on disk, open an issue with your paths and `CH_DATA_DIR`.

## How migrations work

- **One source of truth.** All schema migrations live in **`runMigrations()`** (`src/lib/db.ts`) — a hand-wired chain of idempotent, version-gated appliers (`src/lib/db/apply-*.ts`) plus the SQL in `src/lib/db/migrations/`. The running app applies them at first DB open (`getDb()`), and the **`db:migrate`** script (`scripts/tooling/migrate-db.ts`) runs the **exact same** chain. They can never drift.
- **`schema_version`.** Stored in the `meta` table. Fresh installs apply `001_baseline.sql` (the full current schema, `schema_version 3`); existing installs climb through the upgrade-only appliers to the current head (**`schema_version 11`**). Both end with an equivalent schema.
- **Idempotent.** Re-running migrations is always safe — appliers gate on the stored version and no-op when already applied.
- **Backed up first.** Every migration through `setup.sh`, `ch-deploy.sh update|rebuild`, or `ch-migrate.sh` snapshots `control-hub.db` → **`control-hub.db.pre-migrate-<timestamp>.bak`** under `CH_DATA_DIR` before touching anything.

## Running a migration

```bash
bash scripts/maintenance/ch-migrate.sh        # interactive: shows a plan, confirms, backs up, migrates
bash scripts/maintenance/ch-migrate.sh --yes  # unattended (used by the dashboard + CI)
npm run db:migrate                            # schema only (the applier chain), no backup/legacy step
```

`ch-migrate.sh` (and the deploy paths that call it) do three things in order: **backup → schema migration → legacy-data migration** (`scripts/tooling/migrate-to-runtime.mjs --apply`, which converts recurring Hermes cron jobs into Control Hub `schedules` and fails any mission left "dispatched" by the old bash backend).

## Upgrading from `main` (the runtime cutover)

Moving from a pre-runtime `main` install (file/`jobs.json`-era) to the current runtime/scheduler build is **additive and non-destructive**:

1. **Backup** — `control-hub.db.pre-migrate-*.bak` is written.
2. **Schema upgrade** — the appliers add the `runs` and `schedules` tables, mission/run columns, and the catch-up repairs; they **drop only the never-shipped-to-`main` `game_*` tables** (the dialed-back gamification). Your `missions`, `models`, `credentials`, `sessions`, `cron_jobs`, and `stories` are preserved.
3. **Legacy data migration** — recurring missions that were backed by a Hermes cron job become Control Hub `schedules` (mission-linked), firing on the next scheduler tick. The old `cron_jobs` rows are left in place for now (the legacy Cron page is being retired in a later step).

The proof is `tests/unit/run-migrations-upgrade.integration.test.ts`, which drives the real `runMigrations` against a degraded legacy DB and asserts the schema climbs to 11 **with the seeded mission and cron job still present**.

### If a database can't be migrated in place

For a database too old or corrupted to upgrade incrementally, Control Hub falls back to a **baseline rebuild**: it backs up the DB to `control-hub.db.pre-baseline-<timestamp>`, recreates it from `001_baseline.sql`, and re-imports the preserved tables. Anything that couldn't be carried over **remains in that backup**, and the migration prints a loud **WARNING** pointing at it. Nothing is silently discarded — review the backup before deleting it.

**Preserved on a baseline rebuild:** `credentials`, `models`, `model_defaults`, `model_fallbacks`, `fallback_config`, `missions`, `cron_jobs`, `sessions`, `stories`, `sync_registry`, `gateway_platforms`.

## Backups

| Backup file (under `CH_DATA_DIR`) | Written by |
|-----------------------------------|------------|
| `control-hub.db.pre-migrate-<ts>.bak` | Every `ch-migrate.sh` / deploy migration (before any change). |
| `control-hub.db.pre-baseline-<ts>` | Only when a baseline rebuild is required. |

Hermes/Hindsight memory backups are separate (`scripts/hardware/ch-backup.sh`). General host backups should include `CH_DATA_DIR` and `HERMES_HOME` — see [DEPLOY.md](DEPLOY.md).

## Data directory & paths

- Control Hub data lives under **`CH_DATA_DIR`** (default `$HOME/control-hub/data`). The older `$HERMES_HOME/control-hub/data` default is no longer used — set `CH_DATA_DIR` if your data is elsewhere.
- Hermes lives at **`HERMES_HOME`** (default `~/.hermes`), package at `~/.hermes/hermes-agent/`.
- Full path/env reference: [ENV_REFERENCE.md](ENV_REFERENCE.md).

## Release checklist (`dev` → `main`)

1. On a copy of a real install, run `bash scripts/maintenance/ch-migrate.sh` and confirm: a `pre-migrate-*.bak` exists, `schema_version` is 11, `schedules` is populated from any mission-linked cron jobs, and missions/models/sessions are intact.
2. `npm test` (incl. the upgrade-path test) and `npm run test:e2e-hermes` (real-Hermes gate).
3. `npm run test:full-install` on a staging host (`tests/integration/test_full_install_update_process.py`).
