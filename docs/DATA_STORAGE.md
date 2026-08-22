---
summary: Where PatterStage keeps its data, and why the legacy control-hub names are still read
type: reference
tags: [product, data]
compiled_from: normalised
---

# Data Storage

Where PatterStage keeps its data, and how the legacy `control-hub` / `ch.*`
names are handled. PatterStage was renamed from `hermes-control-hub` (and earlier
`control-hub`); the leftover names below are **intentional, working back-compat**,
not rot — they let existing installs keep running without a forced migration.

## The SQLite database (source of truth)

Almost everything lives in one SQLite file: missions, runs, sessions, profiles,
templates, skills/tools, chat conversations, composer workflows, stories,
benchmarks, deep-research runs, the memory-provider config, and the artifacts
registry. Hand-written repositories (`src/lib/*-repository.ts`) read/write it;
schema is versioned migrations under `src/lib/db/migrations/*.sql`.

- **File:** `$PS_DATA_DIR/patterstage.db`. On an un-migrated install the resolver
  falls back to a pre-existing `control-hub.db` — see `getDbPath()` in
  [`src/lib/paths.ts`](../src/lib/paths.ts). When both exist it prefers the one
  with data (larger file) so a stale empty `patterstage.db` never shadows a
  populated `control-hub.db`. The on-disk rename is an optimisation, not a
  requirement; the rename/relocate scripts (`scripts/lib/ps-rename-migrate.sh`,
  `scripts/maintenance/ps-relocate.sh`) move it forward when convenient.
- **Data dir:** resolved by `getPsDataDir()`. An explicit env var wins
  (`PS_DATA_DIR` → `CH_DATA_DIR` → `CONTROL_HUB_DATA_DIR`); otherwise it probes
  `~/PatterStage/data`, `~/patterstage/data`, `~/control-hub/data` and the
  repo-adjacent `data/`, preferring whichever already contains a DB.

## The Hermes agent (separate, not our DB)

The agent runtime (Hermes) keeps its own state under `$HERMES_HOME` (default
`~/.hermes/`): `config.yaml`, agent profiles, and memory (Hindsight). PatterStage
is the **source of truth** and *projects* models/profiles/config onto Hermes
files; it talks to the agent only over HTTP through the `AgentRuntime` port. It
does **not** store its own data under `~/.hermes`. Memory is reached through the
DB-owned `MemoryProvider` config (`memory_providers` table), never by parsing
Hermes files — see [`MEMORY.md`](MEMORY.md).

## Browser localStorage (client UI prefs only)

Non-critical UI preferences (e.g. the Sessions "group by mission" / "hide API
noise" toggles, the Story-Weaver reader settings) are stored under the `ps.*`
prefix. The pre-rename `ch.*` keys are migrated forward **once** via
`useStoredBool`'s `legacyKey` param (copy → delete) so a rename never loses a
saved preference. No app data lives in localStorage.

## Committed vs runtime data

- **Committed (`data/seed/**`):** the bundled seed catalog — default profiles,
  mission templates, skills/tools, agent-root files. This is the *source* the
  Seed page restores from.
- **Gitignored (everything else under `data/`):** the live `patterstage.db` /
  `control-hub.db`, WAL/SHM, and `*.pre-baseline-*` backups. `.gitignore` has
  `/data/*` + `!/data/seed/**`, so **no database is ever committed** to the repo.

## Intentional legacy names (do NOT "clean up" without a migration)

These are deliberate and load-bearing; removing them breaks existing installs:

| Leftover | Where | Why it stays |
|----------|-------|--------------|
| `control-hub.db` fallback | `paths.ts`, `scripts/**` | un-migrated installs still open their existing DB |
| `CH_*` / `CONTROL_HUB_*` env vars | `paths.ts` `readEnv(...)`, deploy scripts | a user's existing `.env.local` keeps working (PS_* supersedes) |
| `ch.cat.*` / `ch.tpl.*` / `ch.prof.*` seed keys | `mission-category-repository.ts`, seed packs, DB `seed_key` columns | renaming requires a DB migration to rewrite the unique `seed_key`, for ~zero user benefit |

The CSS tokens were fully renamed to `--ps-*`; the localStorage keys are migrated
(above). The remaining legacy names are confined to the back-compat shims listed
here.
