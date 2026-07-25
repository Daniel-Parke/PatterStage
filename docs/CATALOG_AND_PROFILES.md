# Catalog and professional profiles

PatterStage SQLite is the **source of truth** for agent profiles (including Bob), the global skills catalog, and per-profile policy (`disabled_skills`, `platform_toolsets`). Hermes disk is a **runtime mirror** updated via push/pull sync (same contract as Config → Models).

## Data flow

```text
UI / API writes  ──►  SQLite (agent_profiles, agent_root, skills)
                           │
                           ▼
              POST /api/agent/profiles/sync/push  (profile | root | skills)
                           │
                           ▼
              ~/.hermes/                          Bob: root SOUL, AGENTS, config, memories
              ~/.hermes/profiles/<slug>/          Named: behaviour files only (no skills/ subtree)
              ~/.hermes/skills/<category>/<name>/  Global skills catalog (SKILL.md)
```

**Pull** is explicit: absorb local Hermes edits into SQLite (`POST .../sync/pull`). **Discover/import** creates DB rows for profiles on disk that are not yet in `agent_profiles`.

## Slug vs display name

| Field | Rule | Example |
|-------|------|---------|
| `slug` | Lowercase `[a-z0-9][a-z0-9_-]{0,63}$`, filesystem + CLI | `devops`, `qa`, `swe` |
| `display_name` | UI label only | `DevOps`, `QA` |

Invalid PascalCase profile paths (`profiles/DevOps/`) must not be committed; canonical trees use lowercase slugs only.

## Bob (default agent)

Bob is stored in the **`agent_root`** singleton (`id = 1`), not `agent_profiles`. Sync uses `root: true` on push/pull. The default profile row in the UI has `id: "default"`.

## Skills

- **Content:** `skills` table → pushed to `~/.hermes/skills/`
- **Denylist:** `disabled_skills` JSON on each profile / `agent_root` → merged into `config.yaml` as `skills.disabled` (Hermes native mode)
- **Platform denylist:** `skills.platform_disabled` is preserved when found in config YAML
- **No per-profile mirrors:** `profiles/<slug>/skills/` is not populated by PatterStage or profile create

## Personality / identity

Hermes identity is `SOUL.md`. PatterStage stores root/profile SOUL content in SQLite and pushes it to the Hermes mirror. Do not write identity text to `agent.personality` or `agent.personalities` in `config.yaml`; config is for runtime policy such as `skills.disabled`, `platform_toolsets`, and `agent.max_turns`.

## Tools

Hermes runtime toolsets are profile-scoped `platform_toolsets` in SQLite (`agent_root` / `agent_profiles`), pushed into Hermes `config.yaml`. Edit on **Operations → Tools**; sync with **Pull** / **Push** (same contract as Agents). Pull normalizes duplicate or CLI-expanded toolset lists.

The `/api/tools` route exposes a **read-only catalog** of known Hermes toolset IDs — it does not enable/disable runtime tools. See [TOOLS_AND_MISSIONS.md](TOOLS_AND_MISSIONS.md).

## Seed operations

| Action | How |
|--------|-----|
| **Merge** (default) | Upsert missing seed rows; skip profiles/templates that already exist by `seed_key`. |
| **Replace** | Re-apply seed SQL/content for the selected target. |
| **CLI** | `npm run db:seed` → `scripts/tooling/import-hermes-state.ts` (when Hermes exists), then `scripts/tooling/seed-catalog.ts --merge` |
| **Import disk** | `npx tsx scripts/tooling/import-hermes-state.ts` |
| **Deploy** | `ps-deploy update` runs migrations, imports Hermes state when `HERMES_HOME/config.yaml` exists, then runs `seed-catalog.ts --merge` |

Seed state: `PS_DATA_DIR/seed-state.json`.

## Sync API

| Route | Purpose |
|-------|---------|
| `GET /api/agent/profiles/sync/drift` | Full drift report (root, profiles, skills) |
| `POST /api/agent/profiles/sync/push` | `{ slug?, all?, root?, skills?, skillKey? }` |
| `POST /api/agent/profiles/sync/pull` | `{ slug?, all?, root?, skills?, importDiscovered? }` |
| `GET /api/agent/profiles/sync/import` | List discovered local profiles |
| `POST /api/agent/profiles/sync/import` | Import profile or skills catalog into SQLite |
| `GET /api/agent/profiles` | List profiles + per-row `syncStatus` |

**Operations → Agents:** drift banner, push/pull all, per-profile push/pull (including Bob).

**Models:** separate `GET/POST /api/models/sync/*` routes. Seeds do **not** set `model.default`. After **Push Bob** (root), PatterStage runs `finalizeRootConfigOnDisk()` so `model.*` / `auxiliary.*` from the Models registry are re-applied to `~/.hermes/config.yaml` and stored back in `agent_root.config_yaml` (prevents chat wiping the model block).

## Bootstrap / update order

1. Resolve `HERMES_HOME` from the environment, defaulting to `~/.hermes`.
2. Run `npm run db:migrate`.
3. Import disk state with `npx tsx scripts/tooling/import-hermes-state.ts`.
4. Seed missing defaults with `npx tsx scripts/tooling/seed-catalog.ts --merge`.
5. Run `npx tsx scripts/tooling/ensure-hermes-model-sync.ts` when `model_defaults.agent` is set (also runs on `ps-deploy update` / bootstrap `setup.sh`).
6. Push only when the operator explicitly requests sync, or when replace-mode seed is used.

## Schema

`001_baseline.sql` is the squashed fresh-install schema (v3). Upgrades from `main` apply **`002_profiles_tools_parity.sql`** once.

The **runtime** `schema_version` is whatever the last applier in `runMigrations` sets, currently **30**; the v3 above is the baseline a fresh DB starts from, not where it ends up. Do not restate the current number in prose that will not be updated with it: read `getSchemaVersion()`, or the last applier wired in [`db.ts`](../src/lib/db.ts).

Two columns here were renamed at v30 ([`030_neutral_column_names.sql`](../src/lib/db/migrations/030_neutral_column_names.sql)): `agent_root.hermes_md` is now **`framework_md`**, and `cron_jobs.hermes_job_id` is now **`external_job_id`**. The `/config/hermes_md` route and the `"hermes"` file key in `GET /api/agent/files/[key]` deliberately keep their names: they identify the FILE (HERMES.md), not the column that caches it.

## Authoring

- Pack layout: [`data/seed/README.md`](../data/seed/README.md)
- Validate or scaffold: `node scripts/tooling/generate-seed-pack.mjs`
