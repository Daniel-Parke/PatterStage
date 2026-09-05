---
title: Where your data lives
summary: Where PatterStage keeps its data, and why the legacy control-hub names are still read
section: running
nav: 30
audience: operator
type: reference
tags: [product, data]
compiled_from: normalised
---
# Data Storage

Where PatterStage keeps its data, and how the legacy `control-hub` / `ch.*`
names are handled. PatterStage was renamed from `hermes-control-hub` (and earlier
`control-hub`); the leftover names below are **intentional, working back-compat**,
not rot: they let existing installs keep running without a forced migration.

## The SQLite database (source of truth)

Almost everything lives in one SQLite file: missions, runs, sessions, profiles,
templates, skills/tools, chat conversations, composer workflows, stories,
deep-research runs, the memory-provider config, and the artifacts registry.
Hand-written repositories (`src/lib/*-repository.ts`) read/write it; schema is
versioned migrations under `src/lib/db/migrations/*.sql`.

- **File:** `$PS_DATA_DIR/patterstage.db`. On an un-migrated install the resolver
  falls back to a pre-existing `control-hub.db` (see `getDbPath()` in
  [`src/lib/paths.ts`](../../src/lib/paths.ts)). When both exist it prefers the one
  with data (larger file) so a stale empty `patterstage.db` never shadows a
  populated `control-hub.db`. The on-disk rename is an optimisation, not a
  requirement; the rename/relocate scripts (`scripts/lib/ps-rename-migrate.sh`,
  `scripts/maintenance/ps-relocate.sh`) move it forward when convenient.
- **Data dir:** resolved by `getPsDataDir()`. An explicit env var wins
  (`PS_DATA_DIR` → `CH_DATA_DIR` → `CONTROL_HUB_DATA_DIR`); otherwise it probes
  exactly three candidates, `~/PatterStage/data`, `~/patterstage/data` and
  `~/control-hub/data`, preferring whichever already contains a DB, then
  whichever merely exists, and creating `~/patterstage/data` if none does. The
  repo-adjacent `data/` is **not** a candidate: it is where the committed seed
  pack lives, and a repo checkout is never discovered as a data dir.

## The Hermes agent (separate, not our DB)

The agent runtime (Hermes) keeps its own state under `$HERMES_HOME` (default
`~/.hermes/`): `config.yaml`, agent profiles, and memory (Hindsight). PatterStage
is the **source of truth** and *projects* models/profiles/config onto Hermes
files; it talks to the agent only over HTTP through the `AgentRuntime` port. It
does **not** store its own data under `~/.hermes`. Memory is reached through the
DB-owned `MemoryProvider` config (`memory_providers` table), never by parsing
Hermes files. See [`MEMORY.md`](../guides/memory.md).

## Browser localStorage (UI prefs, plus one unsaved draft)

The `ps.*` prefix is the convention, not a description of every key. Grepping
for `ps.*` alone will miss three of the five keys the app writes:

| Key | Written by | What it holds |
|-----|-----------|---------------|
| `ps.sessions.groupByMission` | `src/app/(main)/sessions/page.tsx` | "Group by mission" toggle |
| `ps.sessions.hideApiNoise` | `src/app/(main)/sessions/page.tsx` | "Hide API noise" toggle |
| `ps-last-mission-category` | `src/lib/missions/mission-composer-utils.ts` | Last mission category picked (hyphen form, predates the dotted convention) |
| `story-weaver-reader-settings` | `src/modules/rec-room/components/ReaderSettings.tsx` | Reader font/theme prefs (unprefixed, predates the convention) |
| `story-weaver-draft` | `src/app/recroom/story-weaver/create/page.tsx` | An unsaved story in progress |

Only the two `ps.sessions.*` toggles go through `useStoredBool`, and only they
carry a pre-rename `ch.*` key that is migrated forward **once** via the
`legacyKey` param (copy → delete), so a rename never loses a saved preference.
The other three are read and written directly and have no legacy alias.

`story-weaver-draft` is the one entry that is not a preference. The composer
auto-saves the title, premise and characters there on every keystroke and offers
to restore them on return, so until the story is saved to the DB that draft is
the only copy of the user's own prose. It is cleared on a successful save.
Nothing else in the app treats localStorage as durable storage: clear it and you
lose some toggles and, if one is open, an unsaved draft, and nothing more.

## Committed vs runtime data

- **Committed (`data/seed/**`):** the bundled seed catalog of default profiles,
  mission templates, skills/tools and agent-root files. This is the *source* the
  Seed page restores from.
- **Gitignored (everything else under `data/`):** the live `patterstage.db` /
  `control-hub.db`, WAL/SHM, and `*.pre-baseline-*` backups. `.gitignore` has
  `/data/*` + `!/data/seed/**`, so **no database is ever committed** to the repo.

## Database snapshots

`{PS_DATA_DIR}/backups/db` holds copies of the database, listed on
**Settings > System**. Three things write one:

| When | Label in the file name |
|------|------------------------|
| The Back up now button on Settings > System | `manual` |
| Before a restore that overwrites rows (Settings > Restore) | `pre-restore` |
| Before a purge of throwaway test data | `pre-clean` |

A snapshot is a consistent copy taken through SQLite's own backup API, so it is
safe to take while the server is running. The migration runner's own
`pre-migrate` and `pre-baseline` copies sit beside the database itself and are
listed on the same card.

Set `PS_DB_BACKUP_DIR` to put snapshots somewhere else, such as a mounted
volume. Restoring one is a manual, deliberate act: stop the server, copy the
file over the database, delete the `-wal` and `-shm` sidecars, start it again.
Settings > System prints that exact sequence with the paths filled in.

## Intentional leftovers (do NOT "clean up" without a migration)

These are deliberate and load-bearing; removing them breaks existing installs:

| Leftover | Where | Why it stays |
|----------|-------|--------------|
| `control-hub.db` fallback | `paths.ts`, `scripts/**` | un-migrated installs still open their existing DB |
| `CH_*` / `CONTROL_HUB_*` env vars | `paths.ts` `readEnv(...)`, deploy scripts | a user's existing `.env.local` keeps working (PS_* supersedes) |
| `ch.cat.*` / `ch.tpl.*` / `ch.prof.*` seed keys | `mission-category-repository.ts`, seed packs, DB `seed_key` columns | renaming requires a DB migration to rewrite the unique `seed_key`, for ~zero user benefit |
| `benchmark_runs`, `benchmark_item_results`, `bench_gateways` | created by migrations 014, 015 and 017 | the benchmark subsystem was deleted ([ADR-0004](../../org/decisions/ADR-0004-brain-and-body.md)) but `schema_version` strictly increases, so pulling those appliers out of the chain would renumber every later one and break every existing database. They stay as no-op-shaped version bumps and the tables stay permanently empty. Migration `016`'s `tool_catalog` and `seed_memory_facts` are *not* in this category: they outlived the benchmark work and are still read and written. |

The CSS tokens were fully renamed to `--ps-*`. Of the localStorage keys, only the
two `ps.sessions.*` toggles ever had a `ch.*` predecessor, and those are migrated
on read (above); the three unprefixed keys are a naming inconsistency rather than
a back-compat shim, so renaming them costs a stored value per user and buys no
compatibility. Everything else legacy is confined to the shims listed here.
