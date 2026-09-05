---
title: Upgrades and migrations
summary: How data survives upgrades, the rule for adding a schema change, and what the repository rename means for existing clones and forks
section: running
nav: 50
audience: operator
type: guide
tags: [product, upgrade]
compiled_from: normalised
---
# PatterStage: Migrations & Upgrades

How PatterStage keeps your data across upgrades, and what happens when an existing install moves to a newer version. If something here doesn't match what you see on disk, open an issue with your paths and `PS_DATA_DIR`.

## Repository renamed: `hermes-control-hub` → `PatterStage`

This project was renamed from **`hermes-control-hub`** to **`PatterStage`** (GitHub: `Daniel-Parke/hermes-control-hub` → `Daniel-Parke/PatterStage`). **Nothing breaks.** Here is exactly why, and the one optional step for existing clones and forks.

- **Your history, clones, and forks are safe.** A GitHub repository rename never rewrites history and never deletes anything. GitHub keeps a **permanent redirect** from the old name to the new one that covers the web UI, the API, *and* git itself (`clone` / `fetch` / `pull` / `push`). An existing clone still pointing at `…/hermes-control-hub.git` keeps working unchanged: git is transparently redirected. Forks stay linked to this repo and are unaffected.
- **Optional (recommended) housekeeping: repoint your remote** so you don't rely on the redirect forever:

  ```bash
  git remote set-url origin https://github.com/Daniel-Parke/PatterStage.git
  git remote -v   # confirm it now shows PatterStage
  ```

  Forks: do the same for your fork's URL, and update any `upstream` remote that tracks this repo.
- **The only way the redirect breaks:** if a *new* repository named `hermes-control-hub` is ever created under `Daniel-Parke`, GitHub drops the redirect (the new repo claims the path). That name is intentionally left unused.
- **Operational identifiers were renamed (Control Hub → PatterStage), with full back-compat.** Existing installs keep working and **auto-migrate on their next update**. See [Path & environment rename](#path--environment-rename-control-hub--patterstage) below.
- **Renaming a local folder affects no one.** Git identifies remotes by URL, not by the directory you cloned into, so renaming your local checkout folder has zero effect on you or anyone who forked/cloned.

## Path & environment rename (Control Hub → PatterStage)

The internal operational identifiers were renamed to PatterStage. **Existing installs keep working**: every old name is still accepted, and the first `ps-deploy.sh update` migrates you automatically.

| Was (still accepted) | Now (canonical) |
|---|---|
| `~/control-hub` (install / data dir) | `~/patterstage` |
| `control-hub.db` | `patterstage.db` |
| `CH_*` env vars (e.g. `CH_DATA_DIR`) | `PS_*` (e.g. `PS_DATA_DIR`) |
| `ch-*.sh` scripts (e.g. `ch-deploy.sh`) | `ps-*.sh` (e.g. `ps-deploy.sh`) |

**Back-compat, so you don't have to do anything:**

- **Path resolution** probes three candidates in order, `~/PatterStage/data`, `~/patterstage/data`, then a pre-existing `~/control-hub/data`, and a candidate that already holds a database wins over that order, so an un-migrated install reads its data unchanged. When none of the three exists the lowercase `~/patterstage/data` is the default. The DB resolver prefers `patterstage.db`, else an existing `control-hub.db`.
- **`.env.local`** is loaded under both prefixes: a legacy `CH_DATA_DIR=` line is bridged to `PS_DATA_DIR` automatically.
- **Old `ch-*.sh` paths** remain as thin shims that forward to the `ps-*.sh` scripts, so existing host-cron entries keep firing.

**What the first `ps-deploy.sh update` does automatically** (idempotent; DB backed up first by the normal migration step):

1. Renames `control-hub.db` → `patterstage.db` (plus `-wal` / `-shm`) in place.
2. Rewrites `.env.local` `CH_*` keys → `PS_*` and records a `PS_RENAMED=1` marker.

It does **not** move your data directory, because a running deploy can't relocate its own checkout.

**Optional: finish the move to `~/patterstage`** (purely cosmetic). Stop the app and run the guided helper:

```bash
bash scripts/maintenance/ps-relocate.sh        # ~/control-hub → ~/patterstage
```

It moves the repo + data dir, fixes `.env.local` paths, renames the DB, and prints the restart command. If you keep host-cron scripts, update any crontab entries from `…/control-hub/data/scripts/` to `…/patterstage/data/scripts/`.

## How migrations work

- **One source of truth.** All schema migrations live in **`runMigrations()`**, exported from the `@/lib/db` entry module: a hand-wired chain of idempotent, version-gated appliers (`src/lib/db/apply-*.ts`) plus the SQL in `src/lib/db/migrations/`. The running app applies them at first DB open (`getDb()`), and the **`db:migrate`** script (`scripts/tooling/migrate-db.ts`) runs the **exact same** chain. They can never drift.
- **`schema_version`.** Stored in the `meta` table. Fresh installs apply `001_baseline.sql` (the squashed schema, `schema_version 3`); existing installs climb through the 30 upgrade-only appliers, v3 to the current head. Both end with an equivalent schema. The head is a constant and not a number this page will keep re-typing, for the reason in the next bullet.
- **The head is a constant, not a number typed into prose.** It is `MIGRATION_HEAD_SCHEMA_VERSION` in `src/lib/db-schema.ts`, and `tests/unit/run-migrations-upgrade.integration.test.ts` asserts the chain actually reaches it, that it equals the last applier's own gate, that the last gate sits exactly one above the gate it displaced, and that it equals the highest-numbered file in `src/lib/db/migrations/`. This section claimed 13, and two others claimed 11, for a long stretch while the code climbed well past both, and a later pass left 33 in two further places after the chain had already reached 34. That is what the constant and those assertions exist to prevent, and it is why the head is no longer written out anywhere on this page.
- **A fresh database converges over several passes.** `runMigrations()` applies the baseline and returns; the incremental appliers only run on later passes. `getDb()` loops until the version stops moving, so one boot still reaches the head.
- **Idempotent.** Re-running migrations is always safe: appliers gate on the stored version and no-op when already applied.
- **Backed up first.** Every migration through `setup.sh`, `ps-deploy.sh update|rebuild`, or `ps-migrate.sh` snapshots `patterstage.db` → **`patterstage.db.pre-migrate-<timestamp>.bak`** under `PS_DATA_DIR` before touching anything.

## Adding a schema change: the going-forward rule

A schema change is **a new numbered `.sql` plus a version-gated applier that execs it**, appended to the hand-wired order. Three steps, in one commit:

1. **Add the `.sql`.** A new file in `src/lib/db/migrations/`, taking the next free number.
2. **Add the applier.** A new `src/lib/db/apply-*.ts` that reads `getSchemaVersion`, returns early when the database is already at or past its gate, execs its `.sql` through `execMigrationFile` (`src/lib/db/apply-sql.ts`), and calls `setSchemaVersion` only after that succeeds.
3. **Wire it and raise the head.** Append one call to the end of `runMigrations()` and bump `MIGRATION_HEAD_SCHEMA_VERSION` in `src/lib/db-schema.ts` to match the new gate.

The rules around it are not negotiable:

- **The order is load-bearing.** The chain is hand-wired, not discovered by scanning the directory. Appliers run in written order, and several depend on an earlier one having run. Append to the end. Never insert into the middle, never reorder.
- **A `.sql` file alone is inert.** Nothing scans the directory and runs what it finds. A migration that is not called from `runMigrations()` does nothing at all, on any install, forever. The upgrade-path test asserts the tables of the recent migrations exist specifically to catch that.
- **Shipped migrations are immutable.** Once a numbered `.sql` has been released it is history and is never edited, not even when it created a column that has since been renamed. `030` renames `agent_root.hermes_md`, and `001` and `002` still create `hermes_md`, deliberately. Migration history is a record of what happened, not a description of the current schema.
- **`schema_version` strictly increases.** A gate is claimed once, never reused and never lowered. A mistake in a shipped migration is corrected by a new, higher-numbered migration.
- **Bump the version last.** `execMigrationFile` swallows only already-applied errors (`duplicate column name`, `already exists`) and rethrows everything else, so a genuine failure leaves the version un-bumped and the boot fails loudly. Setting the version before the work, or wrapping the work in a blanket `catch`, records a half-migrated database as done and there is no retry.

### Two tables refuse to be written twice

`agent_progression_snapshots` (migration `031`) and `retention_prune_runs` (migration `032`) are the schema's append-only tables, and they enforce that themselves: each carries two `BEFORE` triggers that `RAISE(ABORT)` on any `UPDATE` and on any `DELETE`. If you write a migration or a repository function that tries to edit a row in either, it will not fail review, it will fail at runtime with the trigger's own message.

That is deliberate, and it is what the table is for. It records the level and achievements an agent had reached (WG-ARCH-003, ADR-0004) so that recorded growth survives the retention prune of the `analytics_events` and `chat_messages` rows the numbers were derived from. A correction is a new row; the older row keeps saying what it said, which is what holds the high-water mark when a later recomputation reads lower. `tests/unit/agent-progression-immutability.test.ts` proves both refusals against real SQLite, and proves that a genuine correction driven through the real write path appends rather than edits.

Two consequences worth knowing before you trip over them. The table cannot be repaired in place, so a wrong row is corrected by appending a right one and never by patching it. And a future migration that needs to change its shape has to build a new table beside it, because `ALTER` is fine but the row-level edits a backfill usually wants are not.

`retention_prune_runs` is the same shape for the same kind of reason. It records every applied run of the retention prune, and an audit of deletions that can itself be edited or deleted is not an audit. Both consequences above apply to it identically.

### Retention: the only migration that can eventually remove your rows

Migration `032` adds `retention_policy`, which declares a window for the two tables that grow without bound (`analytics_events` and `chat_messages`), and `retention_prune_runs`, which records every prune that runs. The full reasoning is [ADR-0009](../../org/decisions/ADR-0009-retention-for-the-readings-tables.md); the parts that matter when you are upgrading are short.

- **The upgrade deletes nothing.** Both policies are seeded `enabled = 0` on every install, fresh and existing alike, with `INSERT OR IGNORE` so a re-run cannot overwrite a choice you already made. Five weeks of history, or five years, is exactly as intact after the upgrade as before it. There is no first-run prune and no default that switches itself on later.
- **Deleting is a separate, deliberate act.** `npm run db:retention` prints the policy, the volume and what a real run would take, and changes nothing. Turning a policy on is one command; `--apply` is another. There is no HTTP route and no scheduler wiring, on purpose.
- **The windows have floors the database enforces.** `analytics_events` keeps at least 365 days because that is the longest read its consumers perform; `chat_messages` keeps at least 30. A `CHECK` constraint refuses anything shorter. Widening is always allowed.
- **The prune refuses rather than risks it.** Nothing is deleted that the per-Body progression record (migration `031`) has not already captured. The prune captures first, then checks that the newest capture is at or after the cutoff, and marks the table `refused` if it is not.
- **Back up before you apply.** `ps-migrate.sh` and the deploy paths snapshot the database before a migration, but the prune is not a migration and takes no backup of its own. The deletion is permanent.

### The spend budget: the only migration that can eventually stop your work

Migration `033` adds `spend_policy`, a single row holding an **optional** budget for LLM provider spend, the period it covers, and whether breaching it pauses unattended dispatch. Full behaviour is in [SPEND.md](../reference/spend.md); the parts that matter when you are upgrading are three sentences.

- **The upgrade sets nothing and stops nothing.** The seeded row carries `limit_usd NULL` and `hard_stop 0` on every install, fresh and existing alike, with `INSERT OR IGNORE` so a re-run cannot overwrite a figure you already chose. An install that takes this upgrade dispatches on the next tick exactly as it did on the last one.
- **A figure alone only warns.** Setting a budget changes what the console says, not what the scheduler does. Pausing unattended work is a second, separate switch, off by default.
- **The pair is enforced by the database.** A `CHECK` refuses `hard_stop = 1` with no figure beside it, in either direction, because a stop with no ceiling would refuse every unattended dispatch forever with no number anybody could raise.

Attended dispatch is never affected by any of this, at any setting. Clicking dispatch, running a schedule now, or approving a Composer gate works identically whether the budget is unset, breached or armed.

### Historical exceptions

Of the 30 appliers, 23 exec their numbered `.sql` through `execMigrationFile`. The other seven do not. They are **grandfathered, not a precedent**, and they are worth naming precisely, because calling all seven "embedded SQL" is less accurate than what is actually on disk.

**Four read the numbered `.sql` directly with `readFileSync`.** They predate `apply-sql.ts` and its fail-loudly contract:

| Applier | Reads | Note |
|---|---|---|
| `apply-profiles-tools-upgrade.ts` | `002_profiles_tools_parity.sql` | Reaches the file by scanning the migrations directory, not by naming it. Gates at v3. |
| `apply-mission-repeat-migration.ts` | `003_mission_infinite_repeat.sql` | Gates at v4. |
| `apply-mission-queue-migration.ts` | `004_mission_queue.sql` | Gates at v5. |
| `apply-benchmark-config-migration.ts` | `015_benchmark_config.sql` | Gates at v15. |

**Three do the work in TypeScript instead.** Only one of the three has no `.sql` at all, so do not read this table as "these have no file":

| Applier | Gate | Its `.sql` | Why it does not exec one |
|---|---|---|---|
| `apply-cron-schedule-canonicalisation.ts` | v7 | `007` + `008`, both inert | Rewrites `cron_jobs.schedule` values. The work is string parsing, not DDL, so its two numbered files are the comment-only markers described under Ladder quirks and there is nothing in them to exec. |
| `apply-legacy-column-repair.ts` | v9 | none | Catch-up repair for the `005` and `006` column adds the ladder skipped. Runs late so it repairs already-deployed installs too. This is the one applier here with no numbered file of its own. |
| `apply-neutral-column-names.ts` | v30 | `030_neutral_column_names.sql`, deliberately not exec'd | `ALTER TABLE ... RENAME COLUMN` is not idempotent: it throws on a second run. The applier re-implements both renames guarded on the live shape read from `PRAGMA table_info`, which a static `.sql` cannot do. The file stays on disk as the shipped record of what `030` was, and is never run. |

### Ladder quirks

The version ladder is not a clean one-step-per-number run. The gaps are real history, not mess to tidy up, and nothing should be renumbered to close them:

- **No applier sets v6.** Canonicalisation jumps 5 straight to 7. That orphaned the `005_cron_workdir` and `006_sessions_message_count` column adds, which are repaired at v9 by `apply-legacy-column-repair.ts`.
- **There is no `010`.** The files run 001 to 034 with 010 absent: it created the `game_*` tables and was deleted with the gamification dial-back. `011_drop_game_tables.sql` drops what it created and documents the removal. Thirty-three files, thirty-four numbers.
- **`007` and `008` are inert markers.** Both are comment-only `.sql` files that exec nothing. Their logic is `applyCronScheduleCanonicalisation()` in TypeScript, and the pair is covered by the single v7 gate. They exist so the migration index increments.
- **The file number does not always equal the gate.** `002` bumps to v3 and `008` bumps to v7. Going forward the two match, and the upgrade-path test asserts it for the head. Historically they do not, which is why the gate in the applier, not the filename, is the authority for any migration below 012.
- **A backfill in a migration runs exactly once, and only because the applier's version guard says so.** `execMigrationFile` execs the whole `.sql` in a single call, and the "already applied" guard swallows the first duplicate-column error. Since `exec` stops at the first failing statement, re-running a file whose columns already exist would silently skip everything after the first `ALTER`, including a backfill `UPDATE`. `040_runs_spend_source.sql` is the shape to copy from: two `ALTER`s and then a backfill `UPDATE` that classifies the rows already there, protected by `applyRunsSpendSourceMigration`'s `>= 40` gate rather than by anything in the SQL. `039_models_origin.sql` is the same shape with three `ALTER`s. `041_schedule_kind.sql` is the other shape: two `ALTER`s and no backfill at all, because its new column's DEFAULT is already true of every existing row, which is the safest kind of migration to write.

### Ruling D6: session-sync's lazy self-heal is sanctioned

One place outside the chain still alters a table. `ensureMessageCountColumn()` in `src/lib/sessions/session-sync.ts` adds `sessions.message_count` when a `pragma_table_info` probe says it is missing.

**Operator ruling D6 (2026-08-22): this is deliberate and sanctioned, not debt.** It is paired with `006_sessions_message_count.sql` and with the v9 repair that covers the orphaned column adds, and it protects a database that pre-dates migration 006 and runs a session sync before it finishes climbing. The pragma guard means a database that already has the column pays one cheap read and nothing else.

Sanctioned does not mean invisible, and where its visibility now comes from changed on
2026-08-22. It used to be a counted `sql-outside-repository` violation. Phase 5 moved the
statement into `src/lib/sessions/session-sync-repository.ts`, which is a repository and so is
exempt from that rule, and the rule's baseline is now empty. That is compliance with
WG-ARCH-002 rather than a way around it: the whole point of Phase 5 was to put SQL behind the
repository seam, and this is SQL.

So the lint no longer guards it, and three other things do. The call site in
`src/lib/sessions/session-sync.ts` carries ruling D6 in its file header. The repository
function is named `addSessionMessageCountColumn` and does nothing else, so it cannot be reached
by accident. And it is paired with `hasSessionMessageCountColumn`, the pragma probe, so the
`ALTER` only ever runs on a database that genuinely predates migration 006.

The ruling covers this one site, paired with this one migration. It is not a licence for the
next lazy `ALTER`. New columns go through the chain.

## Running a migration

```bash
bash scripts/maintenance/ps-migrate.sh        # interactive: shows a plan, confirms, backs up, migrates
bash scripts/maintenance/ps-migrate.sh --yes  # unattended (used by the dashboard + CI)
npm run db:migrate                            # schema only (the applier chain), no backup/legacy step
```

`ps-migrate.sh` (and the deploy paths that call it) do three things in order: **backup → schema migration → legacy-data migration** (`scripts/tooling/migrate-to-runtime.mjs --apply`, which converts recurring Hermes cron jobs into PatterStage `schedules` and fails any mission left "dispatched" by the old bash backend).

## Upgrading from `main` (the runtime cutover)

Moving from a pre-runtime `main` install (file/`jobs.json`-era) to the current runtime/scheduler build is **additive and non-destructive**:

1. **Backup:** `patterstage.db.pre-migrate-*.bak` is written.
2. **Schema upgrade:** the appliers add the `runs` and `schedules` tables, mission/run columns, and the catch-up repairs; they **drop only the never-shipped-to-`main` `game_*` tables** (the dialed-back gamification). Your `missions`, `models`, `credentials`, `sessions`, `cron_jobs`, and `stories` are preserved.
3. **Legacy data migration:** recurring missions that were backed by a Hermes cron job become PatterStage `schedules` (mission-linked), firing on the next scheduler tick. The old `cron_jobs` rows are left in place (orphaned/backup only); the legacy agent-cron **Cron page + `jobs.json` bridge have been removed**. Scheduling lives in Missions.

The proof is `tests/unit/run-migrations-upgrade.integration.test.ts`, which drives the real `runMigrations` against a degraded legacy DB and asserts the schema climbs to the head (`getSchemaVersion` equals `MIGRATION_HEAD_SCHEMA_VERSION`, not a literal) **with the seeded mission and cron job still present**, and with both retention policies seeded off.

### If a database can't be migrated in place

For a database too old or corrupted to upgrade incrementally, PatterStage falls back to a **baseline rebuild**: it backs up the DB to `patterstage.db.pre-baseline-<timestamp>`, recreates it from `001_baseline.sql`, and re-imports the preserved tables. Anything that couldn't be carried over **remains in that backup**, and the migration prints a loud **WARNING** pointing at it. Nothing is silently discarded. Review the backup before deleting it.

**Preserved on a baseline rebuild:** `credentials`, `models`, `model_defaults`, `model_fallbacks`, `fallback_config`, `missions`, `cron_jobs`, `sessions`, `stories`, `sync_registry`, `gateway_platforms`, `agent_profiles`, `agent_root`, `skills`. That is the whole of `PRESERVE_TABLES` in [`src/lib/db/upgrade.ts`](../../src/lib/db/upgrade.ts); read the constant rather than this list if the two ever disagree. Your agent profiles, the Bob root row and the skills catalog are carried across, not left behind in the backup.

## Backups

| Backup file | Written by |
|-------------|------------|
| `<PS_DATA_DIR>/patterstage.db.pre-migrate-<ts>.bak` | Every `ps-migrate.sh` / deploy migration (before any change). |
| `<PS_DATA_DIR>/patterstage.db.pre-baseline-<ts>` | Only when a baseline rebuild is required. |
| `<PS_DB_BACKUP_DIR>/patterstage.manual.<ts>.db` | The Back up now button on **Settings > System**. |
| `<PS_DB_BACKUP_DIR>/patterstage.pre-restore.<ts>.db` | A restore that overwrites rows (**Settings > Restore**). |
| `<PS_DB_BACKUP_DIR>/patterstage.pre-clean.<ts>.db` | A purge of throwaway test data. |

`PS_DB_BACKUP_DIR` defaults to `<PS_DATA_DIR>/backups/db`. The last three are
taken through SQLite's own backup API, so they are consistent copies of a
running database; the first two are file copies taken with the app stopped.
Settings > System lists every one of them and prints the restore command.

Hermes/Hindsight memory backups are separate (`scripts/hardware/ps-backup.sh`). General host backups should include `PS_DATA_DIR` and `HERMES_HOME`. See [DEPLOY.md](DEPLOY.md).

## Data directory & paths

- PatterStage data lives under **`PS_DATA_DIR`**. An explicit `PS_DATA_DIR` (or the legacy `CH_DATA_DIR` / `CONTROL_HUB_DATA_DIR`) always wins. With none set, `resolveDataDir()` in [`src/lib/paths.ts`](../../src/lib/paths.ts) probes `~/PatterStage/data`, `~/patterstage/data` and a pre-existing `~/control-hub/data`, takes the first that already holds a database, falls back to the first that merely exists, and creates `$HOME/patterstage/data` if none does. Set `PS_DATA_DIR` explicitly if your data is elsewhere. `$HERMES_HOME/control-hub/data` is **not** one of the candidates the app resolves; it survives only as a backup source in `scripts/bootstrap/backup-hermes-config.sh`.
- Hermes lives at **`HERMES_HOME`** (default `~/.hermes`), package at `~/.hermes/hermes-agent/`.
- Full path/env reference: [ENV_REFERENCE.md](env-reference.md).

## Release checklist (`dev` → `main`)

1. On a copy of a real install, run `bash scripts/maintenance/ps-migrate.sh` and confirm: a `pre-migrate-*.bak` exists, `schema_version` matches the head, which is always whatever `MIGRATION_HEAD_SCHEMA_VERSION` in `src/lib/db-schema.ts` currently says and never a number remembered from a previous release, `schedules` is populated from any mission-linked cron jobs, and missions/models/sessions are intact.
2. `npm test` (incl. the upgrade-path test) and `npm run test:e2e-hermes` (real-Hermes gate).
3. `npm run test:full-install` on a staging host (`tests/integration/test_full_install_update_process.py`).
