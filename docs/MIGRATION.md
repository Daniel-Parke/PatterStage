---
summary: How data survives upgrades, and what the repository rename means for existing clones and forks
type: guide
tags: [product, upgrade]
compiled_from: normalised
---

# PatterStage — Migrations & Upgrades

How PatterStage keeps your data across upgrades, and what happens when an existing install moves to a newer version. If something here doesn't match what you see on disk, open an issue with your paths and `PS_DATA_DIR`.

## Repository renamed: `hermes-control-hub` → `PatterStage`

This project was renamed from **`hermes-control-hub`** to **`PatterStage`** (GitHub: `Daniel-Parke/hermes-control-hub` → `Daniel-Parke/PatterStage`). **Nothing breaks** — here is exactly why, and the one optional step for existing clones and forks.

- **Your history, clones, and forks are safe.** A GitHub repository rename never rewrites history and never deletes anything. GitHub keeps a **permanent redirect** from the old name to the new one that covers the web UI, the API, *and* git itself (`clone` / `fetch` / `pull` / `push`). An existing clone still pointing at `…/hermes-control-hub.git` keeps working unchanged — git is transparently redirected. Forks stay linked to this repo and are unaffected.
- **Optional (recommended) housekeeping — repoint your remote** so you don't rely on the redirect forever:

  ```bash
  git remote set-url origin https://github.com/Daniel-Parke/PatterStage.git
  git remote -v   # confirm it now shows PatterStage
  ```

  Forks: do the same for your fork's URL, and update any `upstream` remote that tracks this repo.
- **The only way the redirect breaks:** if a *new* repository named `hermes-control-hub` is ever created under `Daniel-Parke`, GitHub drops the redirect (the new repo claims the path). That name is intentionally left unused.
- **Operational identifiers were renamed (Control Hub → PatterStage), with full back-compat.** Existing installs keep working and **auto-migrate on their next update** — see [Path & environment rename](#path--environment-rename-control-hub--patterstage) below.
- **Renaming a local folder affects no one.** Git identifies remotes by URL, not by the directory you cloned into, so renaming your local checkout folder has zero effect on you or anyone who forked/cloned.

## Path & environment rename (Control Hub → PatterStage)

The internal operational identifiers were renamed to PatterStage. **Existing installs keep working** — every old name is still accepted, and the first `ps-deploy.sh update` migrates you automatically.

| Was (still accepted) | Now (canonical) |
|---|---|
| `~/control-hub` (install / data dir) | `~/patterstage` |
| `control-hub.db` | `patterstage.db` |
| `CH_*` env vars (e.g. `CH_DATA_DIR`) | `PS_*` (e.g. `PS_DATA_DIR`) |
| `ch-*.sh` scripts (e.g. `ch-deploy.sh`) | `ps-*.sh` (e.g. `ps-deploy.sh`) |

**Back-compat — you don't have to do anything:**

- **Path resolution** prefers `~/patterstage/data` but falls back to a pre-existing `~/control-hub/data`, so an un-migrated install reads its data unchanged. The DB resolver prefers `patterstage.db`, else an existing `control-hub.db`.
- **`.env.local`** is loaded under both prefixes — a legacy `CH_DATA_DIR=` line is bridged to `PS_DATA_DIR` automatically.
- **Old `ch-*.sh` paths** remain as thin shims that forward to the `ps-*.sh` scripts, so existing host-cron entries keep firing.

**What the first `ps-deploy.sh update` does automatically** (idempotent; DB backed up first by the normal migration step):

1. Renames `control-hub.db` → `patterstage.db` (plus `-wal` / `-shm`) in place.
2. Rewrites `.env.local` `CH_*` keys → `PS_*` and records a `PS_RENAMED=1` marker.

It does **not** move your data directory — a running deploy can't relocate its own checkout.

**Optional — finish the move to `~/patterstage`** (purely cosmetic). Stop the app and run the guided helper:

```bash
bash scripts/maintenance/ps-relocate.sh        # ~/control-hub → ~/patterstage
```

It moves the repo + data dir, fixes `.env.local` paths, renames the DB, and prints the restart command. If you keep host-cron scripts, update any crontab entries from `…/control-hub/data/scripts/` to `…/patterstage/data/scripts/`.

## How migrations work

- **One source of truth.** All schema migrations live in **`runMigrations()`** (`src/lib/db.ts`) — a hand-wired chain of idempotent, version-gated appliers (`src/lib/db/apply-*.ts`) plus the SQL in `src/lib/db/migrations/`. The running app applies them at first DB open (`getDb()`), and the **`db:migrate`** script (`scripts/tooling/migrate-db.ts`) runs the **exact same** chain. They can never drift.
- **`schema_version`.** Stored in the `meta` table. Fresh installs apply `001_baseline.sql` (the full current schema, `schema_version 3`); existing installs climb through the upgrade-only appliers to the current head (**`schema_version 13`** — v12 added the `analytics_events` log; v13 added the `chat_conversations` + `chat_messages` tables for server-persisted agent chat). Both end with an equivalent schema.
- **Idempotent.** Re-running migrations is always safe — appliers gate on the stored version and no-op when already applied.
- **Backed up first.** Every migration through `setup.sh`, `ps-deploy.sh update|rebuild`, or `ps-migrate.sh` snapshots `patterstage.db` → **`patterstage.db.pre-migrate-<timestamp>.bak`** under `PS_DATA_DIR` before touching anything.

## Running a migration

```bash
bash scripts/maintenance/ps-migrate.sh        # interactive: shows a plan, confirms, backs up, migrates
bash scripts/maintenance/ps-migrate.sh --yes  # unattended (used by the dashboard + CI)
npm run db:migrate                            # schema only (the applier chain), no backup/legacy step
```

`ps-migrate.sh` (and the deploy paths that call it) do three things in order: **backup → schema migration → legacy-data migration** (`scripts/tooling/migrate-to-runtime.mjs --apply`, which converts recurring Hermes cron jobs into PatterStage `schedules` and fails any mission left "dispatched" by the old bash backend).

## Upgrading from `main` (the runtime cutover)

Moving from a pre-runtime `main` install (file/`jobs.json`-era) to the current runtime/scheduler build is **additive and non-destructive**:

1. **Backup** — `patterstage.db.pre-migrate-*.bak` is written.
2. **Schema upgrade** — the appliers add the `runs` and `schedules` tables, mission/run columns, and the catch-up repairs; they **drop only the never-shipped-to-`main` `game_*` tables** (the dialed-back gamification). Your `missions`, `models`, `credentials`, `sessions`, `cron_jobs`, and `stories` are preserved.
3. **Legacy data migration** — recurring missions that were backed by a Hermes cron job become PatterStage `schedules` (mission-linked), firing on the next scheduler tick. The old `cron_jobs` rows are left in place (orphaned/backup only); the legacy agent-cron **Cron page + `jobs.json` bridge have been removed** — scheduling lives in Missions.

The proof is `tests/unit/run-migrations-upgrade.integration.test.ts`, which drives the real `runMigrations` against a degraded legacy DB and asserts the schema climbs to 11 **with the seeded mission and cron job still present**.

### If a database can't be migrated in place

For a database too old or corrupted to upgrade incrementally, PatterStage falls back to a **baseline rebuild**: it backs up the DB to `patterstage.db.pre-baseline-<timestamp>`, recreates it from `001_baseline.sql`, and re-imports the preserved tables. Anything that couldn't be carried over **remains in that backup**, and the migration prints a loud **WARNING** pointing at it. Nothing is silently discarded — review the backup before deleting it.

**Preserved on a baseline rebuild:** `credentials`, `models`, `model_defaults`, `model_fallbacks`, `fallback_config`, `missions`, `cron_jobs`, `sessions`, `stories`, `sync_registry`, `gateway_platforms`.

## Backups

| Backup file (under `PS_DATA_DIR`) | Written by |
|-----------------------------------|------------|
| `patterstage.db.pre-migrate-<ts>.bak` | Every `ps-migrate.sh` / deploy migration (before any change). |
| `patterstage.db.pre-baseline-<ts>` | Only when a baseline rebuild is required. |

Hermes/Hindsight memory backups are separate (`scripts/hardware/ps-backup.sh`). General host backups should include `PS_DATA_DIR` and `HERMES_HOME` — see [DEPLOY.md](DEPLOY.md).

## Data directory & paths

- PatterStage data lives under **`PS_DATA_DIR`** (default `$HOME/patterstage/data`). A pre-existing `~/control-hub/data` (or the even older `$HERMES_HOME/control-hub/data`) is read as a fallback — set `PS_DATA_DIR` explicitly if your data is elsewhere.
- Hermes lives at **`HERMES_HOME`** (default `~/.hermes`), package at `~/.hermes/hermes-agent/`.
- Full path/env reference: [ENV_REFERENCE.md](ENV_REFERENCE.md).

## Release checklist (`dev` → `main`)

1. On a copy of a real install, run `bash scripts/maintenance/ps-migrate.sh` and confirm: a `pre-migrate-*.bak` exists, `schema_version` is 11, `schedules` is populated from any mission-linked cron jobs, and missions/models/sessions are intact.
2. `npm test` (incl. the upgrade-path test) and `npm run test:e2e-hermes` (real-Hermes gate).
3. `npm run test:full-install` on a staging host (`tests/integration/test_full_install_update_process.py`).
