---
title: Profiles and the skills catalogue
summary: How SQLite holds agent profiles and the skills catalog, and how push and pull mirror them to Hermes on disk
section: reference
nav: 40
audience: contributor
concepts: [profile, skill, toolset]
type: reference
tags: [product, agents]
compiled_from: normalised
---
# Catalog and professional profiles

PatterStage SQLite is the **source of truth** for agent profiles (including Bob), the global skills catalog, and per-profile policy (`disabled_skills`, `platform_toolsets`). Hermes disk is a **runtime mirror** updated via push/pull sync (same contract as Agent → Models).

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

Hermes runtime toolsets are profile-scoped `platform_toolsets` in SQLite (`agent_root` / `agent_profiles`), pushed into Hermes `config.yaml`. Edit on **Agent → Tools**; sync with **Pull** / **Push** (same contract as Agents). Pull normalizes duplicate or CLI-expanded toolset lists.

The `/api/tools` route exposes a **read-only catalog** of known Hermes toolset IDs. It does not enable/disable runtime tools. See [TOOLS_AND_MISSIONS.md](catalog-and-profiles.md).

## Seed operations

| Action | How |
|--------|-----|
| **Merge** (default) | Upsert missing seed rows; skip profiles/templates that already exist by `seed_key`. On the Restore page this is **Add what's missing**. |
| **Replace** | Re-apply seed SQL/content for the selected target. Every replace takes a `pre-restore` database snapshot first and refuses if it cannot take one. |
| **CLI** | `npm run db:seed` → `scripts/tooling/import-hermes-state.ts` (when Hermes exists), then `scripts/tooling/seed-catalog.ts --merge` |
| **Import disk** | `npx tsx scripts/tooling/import-hermes-state.ts` |
| **Deploy** | `ps-deploy update` runs migrations, imports Hermes state when `HERMES_HOME/config.yaml` exists, then runs `seed-catalog.ts --merge` |

Seed state: `PS_DATA_DIR/seed-state.json`.

`GET /api/seed` also answers `pack`, the count of what the shipped set contains,
read from `data/seed/**` rather than from the database. **Agent > Settings > Restore**
renders those numbers, so a fresh install reads "0 of 7 agents" instead of
claiming the pack itself is empty.

## Sync API

| Route | Purpose |
|-------|---------|
| `GET /api/agent/profiles/sync/drift` | Full drift report (root, profiles, skills) |
| `POST /api/agent/profiles/sync/push` | `{ slug?, all?, root?, skills?, skillKey? }` |
| `POST /api/agent/profiles/sync/pull` | `{ slug?, all?, root?, skills?, importDiscovered? }` |
| `GET /api/agent/profiles/sync/import` | List discovered local profiles |
| `POST /api/agent/profiles/sync/import` | Import profile or skills catalog into SQLite |
| `GET /api/agent/profiles` | List profiles + per-row `syncStatus`, `syncError` and `syncedAt` |
| `POST /api/agent/profiles` | Create one. `cloneFrom: "default"` copies the root agent's files; any other slug copies that profile; an empty value starts from the boilerplate |
| `PUT /api/agent/profiles/[id]` | Rename a profile and change its description. A rename moves the slug and the profile directory with it |
| `PUT /api/agent/root` | Rename the root agent. This is PatterStage's own label; nothing is written into the agent's home |

**Agent → Agents:** drift banner, push/pull all, per-profile push/pull (including the root
agent), **Edit profile** on the selected card, and the per-row sync line: the stored
`syncError` in full, then `Last pushed <when>` or `Never pushed`.

A behaviour file lives in SQLite until the first push, so the file list counts a file as
present when the database holds it, whether or not it has reached the disk yet.
`HERMES.md` is the exception: it belongs to the root agent alone, and a PUT of it against a
named profile is a 400 rather than a 200 that wrote nothing.

**Models:** separate `GET/POST /api/models/sync/*` routes. Seeds do **not** set `model.default`. After **Push Bob** (root), PatterStage runs `finalizeRootConfigOnDisk()` so `model.*` / `auxiliary.*` from the Models registry are re-applied to `~/.hermes/config.yaml` and stored back in `agent_root.config_yaml` (prevents chat wiping the model block).

## Toolsets and skills, as the pages present them

A toolset that an enabled `hermes-*` bundle already provides is shown pressed
and not clickable, with the bundle named: turning it on as its own entry is
exactly what the write path removes again, so the grid no longer offers a
switch that turns itself off. Hand-edited advanced JSON is the payload from the
moment it is typed into until it is saved or discarded, and the grid says so;
switching profile with unsaved toolset changes asks first.

Normalisation is a write-path job. A `platform_toolsets` value that came out of
the database was normalised when it went in, so reading it back leaves it
alone; only a value hydrated from `config.yaml` or the seed pack is
canonicalised, because those carry whatever `hermes tools` last wrote.

A skill can be toggled when the catalogue holds it **or** the agent's disk
does, which is the same set `GET /api/skills` lists. The standalone viewer is
the catalogue's destination: when `SKILL.md` is not on disk it answers from the
catalogue row instead of 404, marks the answer `source: "catalog"`, and carries
no linked files, because linked files live beside a `SKILL.md` that is not
there.

## Bootstrap / update order

1. Resolve `HERMES_HOME` from the environment, defaulting to `~/.hermes`.
2. Run `npm run db:migrate`.
3. Import disk state with `npx tsx scripts/tooling/import-hermes-state.ts`.
4. Seed missing defaults with `npx tsx scripts/tooling/seed-catalog.ts --merge`.
5. Run `npx tsx scripts/tooling/ensure-hermes-model-sync.ts` when `model_defaults.agent` is set (also runs on `ps-deploy update` / bootstrap `setup.sh`).
6. Push only when the operator explicitly requests sync, or when replace-mode seed is used.

## Schema

`001_baseline.sql` is the squashed fresh-install schema (v3). Upgrades from `main` apply **`002_profiles_tools_parity.sql`** once.

The **runtime** `schema_version` is whatever the last applier in `runMigrations` sets, currently **34**; the v3 above is the baseline a fresh DB starts from, not where it ends up. Do not restate the current number in prose that will not be updated with it: read `getSchemaVersion()`, or the last applier wired in [`db/index.ts`](../../src/lib/db/index.ts).

Two columns here were renamed at v30 ([`030_neutral_column_names.sql`](../../src/lib/db/migrations/030_neutral_column_names.sql)): `agent_root.hermes_md` is now **`framework_md`**, and `cron_jobs.hermes_job_id` is now **`external_job_id`**. The `/agent/settings/hermes_md` route and the `"hermes"` file key in `GET /api/agent/files/[key]` deliberately keep their names: they identify the FILE (HERMES.md), not the column that caches it.

## Authoring

- Pack layout: [`data/seed/README.md`](../../data/seed/README.md)
- Validate or scaffold: `node scripts/tooling/generate-seed-pack.mjs`

---

## Toolsets and what a mission may reach for

Merged from `TOOLS_AND_MISSIONS.md` in T-0109, so one page answers one question.

## Hermes toolsets and missions

## Runtime tools (Hermes)

Hermes controls which tools are available per platform via `platform_toolsets` in each profile's `config.yaml`. See [Hermes configuration: platform toolsets](https://hermes-agent.nousresearch.com/docs/user-guide/configuration).

PatterStage stores toolsets in SQLite (`agent_profiles.platform_toolsets`, `agent_root.platform_toolsets`) and mirrors them to disk on **push**.

| Surface | Action |
|---------|--------|
| **Agent → Tools** | One **enabled toolsets** grid per profile (fans out to all gateways on save, the same idea as `hermes tools` → configure all platforms). Optional **advanced per-platform** overrides and JSON. **Save & push** writes SQLite and `config.yaml`. |
| **Pull from Hermes** | Import disk `config.yaml` into SQLite (normalizes duplicates / `hermes-cli` expansion). |
| **Push to Hermes** | Write assembled config from SQLite to `HERMES_HOME` or `profiles/<slug>/`. |
| **Agent → Agents** | Push/pull all profile content (includes toolsets in full `config.yaml`). Push Bob re-applies Models registry defaults to root `config.yaml`. |

`/api/tools` (GET) returns a read-only catalog of known toolset IDs; POST is not supported.

## Missions: recommended toolsets

Missions can include **recommended toolsets** in the assembled prompt (`<recommended_toolsets>`), same pattern as **recommended skills**:

- Stored in `missions.suggested_toolsets` (JSON array).
- **Not enforced** at dispatch. A mission is submitted to the runtime over HTTP (`dispatchMissionRun` → `runtime.submitRun`, no `hermes chat` shell-out any more), carrying the prompt and the mission's profile. What the agent may actually call is that profile's `platform_toolsets`; `suggested_toolsets` reaches it as prompt text and nothing else.
- Mission composer **ToolsetSelector** only lists toolsets enabled on the selected profile.

## Operator bootstrap

```bash
npm run db:migrate
npx tsx scripts/tooling/import-hermes-state.ts   # when ~/.hermes exists
npm run db:seed
```

Then open **Agent → Tools**, select each profile, **Pull from Hermes** if you edited toolsets with `hermes tools`, or confirm seeded toolsets appear. **Save & push** when editing in PatterStage.

A fresh install starts from the squashed `001_baseline.sql`; an upgrade from `main` applies `002_profiles_tools_parity.sql` once. Neither is where the database ends up: `runMigrations` then applies the whole chain. For the number the running database is actually at, read `getSchemaVersion()` rather than any figure written into prose. See [CATALOG_AND_PROFILES.md](catalog-and-profiles.md#schema).
