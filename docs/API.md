---
summary: REST route inventory and the response envelope every PatterStage API handler returns
type: reference
tags: [product, api]
compiled_from: normalised
---

# API Reference

Dry reference for REST routes: envelope shape, inventory, auth notes. For behaviour in plain language, see [USER_WALKTHROUGH_GUIDE.md](USER_WALKTHROUGH_GUIDE.md) or the feature docs linked from [README.md](README.md).

All API routes return the envelope:

```typescript
{ data?: T; error?: string }
```

Some error responses also include `details` (Zod validation). Handlers must call `logApiError(route, context, error)` from `@/lib/api-logger` in catch blocks.

## Route inventory

| Route | Methods | Purpose |
|---|---|---|
| `/api/agent/files/[key]` | `GET`, `PUT` | Read/update one behavior file (`soul`, `hermes`, `user`, `memory`, `agent`, `env`). Optional `?profile=` for non-default profiles. |
| `/api/agent/personality` | `PUT` | Set personality for one agent profile (Operations → Agents). |
| `/api/agent/profiles` | `GET`, `POST` | Professional profiles (SQLite source of truth; each row includes `syncStatus` for drift). |
| `/api/agent/profiles/[id]` | `PUT`, `DELETE` | Update or delete one profile (no `GET`, use list + id). |
| `/api/agent/profiles/sync/drift` | `GET` | Full drift report (root, named profiles, skills catalog). Returns the per-resource sync state that the drift banner reads. |
| `/api/agent/profiles/sync/push` | `POST` | Push profile(s) to `HERMES_HOME/profiles/<slug>/` (`{ slug }` or `{ all: true }`). |
| `/api/agent/profiles/sync/pull` | `POST` | Pull one profile from Hermes disk into DB (`{ slug }` required). |
| `/api/agents` | `GET` | Inspect running Hermes agent processes (OS-dependent). Not the same as `agent/profiles`. |
| `/api/config` | `GET`, `PUT` | Read/update parsed Hermes config content. |
| `/api/credentials` | `GET`, `POST` | API key credentials (masked list; create via POST). No per-id route. |
| `/api/cron/hardware` | `GET`, `POST`, `PUT`, `DELETE` | Host **scripts** (system cron) under `PS_SCRIPTS_DIR` / `PS_HARDWARE_LOG_DIR`, powering the Scripts page. (The legacy `/api/cron` agent-cron bridge has been removed; recurring agent work uses `/api/schedules`.) |
| `/api/cron/hardware/meta` | `GET` | `{ scriptsDir, logDir }`. |
| `/api/scripts` | `GET` | List host script files under `PS_DATA_DIR/scripts` with schedule + last-run (powers the Scripts page). |
| `/api/scripts/run` | `POST` | Run a script on demand (`{ name }`). Path-validated, no shell. |
| `/api/scripts/logs` | `GET` | Tail a script's log (`?name=&lines=`). |
| `/api/schedules` | `GET`, `POST` | PatterStage-owned recurring missions (the scheduler fires these; no `jobs.json`). |
| `/api/schedules/[id]` | `PATCH`, `DELETE` | Pause/resume (`{ enabled }`) or delete a schedule. |
| `/api/schedules/[id]/run` | `POST` | Dispatch a scheduled mission immediately (run-now). |
| `/api/stats` | `GET` | Dashboard analytics aggregate (throughput, mission mix, run activity, tokens, per-agent performance, derived progression + the ~36 achievements). Also appends a per-agent progression snapshot when an agent's recorded level or unlocked set has moved. |
| `/api/agents/progression` | `GET` | The **recorded** per-agent growth, from the append-only `agent_progression_snapshots` table: newest row per profile, or one profile's whole trail with `?slug=`. Survives the retention prune of the events it was derived from (see [MIGRATION.md](MIGRATION.md)). |
| `/api/analytics` | `GET` | Interaction analytics summary (`{ totals, last30, activeDays }`) over the `analytics_events` log. Read-only: events are server-emitted, so there is no `POST`. See [ANALYTICS.md](ANALYTICS.md). |
| `/api/analytics/timeseries` | `GET` | Gap-filled daily event counts (`?type=&days=&bucket=day`; `days` clamped 1–365). |
| `/api/spend` | `GET`, `PUT` | Provider spend per calendar period and per source, plus the operator's **optional** budget and the verdict against it. `PUT` sets `limitUsd` (positive number, or `null` to remove the budget), `period` (`day`/`week`/`month`) and `hardStop`. Arming `hardStop` without a figure is a 400. See [SPEND.md](SPEND.md). |
| `/api/fs/git/branches` | `GET` | List git branches for a workspace path. |
| `/api/fs/list` | `GET` | List directory entries (path-validated). |
| `/api/gateway/health` | `GET` | Gateway probe → `{ online, authConfigured }`. Any HTTP response (incl. 401/403) ⇒ reachable; 401/403 ⇒ reachable but the `API_SERVER_KEY` is missing/wrong. |
| `/api/gateway/models` | `GET` | List models from gateway. |
| `/api/logs` | `GET`, `DELETE` | Read recent Hermes logs; clear/truncate log tail. |
| `/api/memory` | `GET`, `POST`, `PUT`, `DELETE` | Holographic memory facts. |
| `/api/memory/hindsight` | `GET`, `POST`, `DELETE` | Hindsight bridge (see [Hindsight actions](#hindsight-actions) below). |
| `/api/mission-categories` | `GET`, `POST`, `PUT`, `DELETE` | Mission category CRUD (see [MISSIONS.md](MISSIONS.md)). |
| `/api/missions` | `GET`, `POST` | Mission list/detail + RPC mutations (see [RPC-style routes](#rpc-style-routes)). |
| `/api/models` | `GET`, `POST` | Models registry (SQLite). |
| `/api/models/[id]` | `GET`, `PUT`, `DELETE` | One model row. |
| `/api/models/[id]/diff` | `POST` | Diff model row vs Hermes config. |
| `/api/models/defaults` | `GET`, `PUT` | Default model per task slot. |
| `/api/models/fallbacks` | `GET`, `POST` | `GET` lists the chain + config; `POST` is an `action`-discriminated mutation (`add` \| `toggle` \| `reorder` \| `custom` \| `import` \| `sync`). |
| `/api/models/fallbacks/[id]` | `GET`, `PUT`, `DELETE` | One fallback entry. |
| `/api/models/fallbacks/config` | `GET`, `PUT` | Fallback chain behaviour config. |
| `/api/models/import` | `GET`, `POST` | `GET` preview; `POST` import from Hermes config. |
| `/api/models/sync/drift` | `GET` | Model drift between DB and Hermes. |
| `/api/models/sync/pull` | `POST` | Pull models from Hermes into DB. |
| `/api/models/sync/push` | `POST` | Push models from DB to Hermes. |
| `/api/monitor` | `GET` | Aggregated dashboard snapshot (cron, sessions, gateway, sync, errors). |
| `/api/orchestration/chat` | `POST` | Proxy chat to Hermes gateway. |
| `/api/personalities` | `GET`, `POST`, `PUT`, `DELETE` | Global personalities in active Hermes `config.yaml`. |
| `/api/seed` | `GET`, `POST` | Read seed state / run catalog seed. |
| `/api/sessions` | `GET`, `POST` | List sessions; `POST` for dispatch pipeline (see [RPC-style routes](#rpc-style-routes)). |
| `/api/sessions/[id]` | `GET` | Read one session transcript. |
| `/api/skills` | `GET` | List skills inventory. |
| `/api/skills/[name]` | `GET`, `PUT` | Read or update one skill document. |
| `/api/skills/[name]/toggle` | `PUT` | Enable/disable a skill for a profile. |
| `/api/skills/[...path]` | `GET` | Read files under a skill tree (`SKILL.md`, etc.). |
| `/api/status` | `GET` | Basic readiness endpoint. |
| `/api/stories` | `POST` | Story Weaver: all operations via `action` (see [RPC-style routes](#rpc-style-routes)). |
| `/api/sync` | `GET`, `POST` | Background sync control and status. |
| `/api/templates` | `GET`, `POST` | Mission templates; mutations via `action` on `POST`. |
| `/api/tools` | `GET` | Read-only Hermes toolset ID catalog. `POST` returns **410** (writes not supported). |
| `/api/agent/profiles/[id]/toolsets` | `GET`, `PUT` | Read or update `platform_toolsets` for a profile (`default` = agent root). `GET` hydrates from DB → yaml → seed and may persist normalized JSON. `PUT` saves and pushes to Hermes disk. |
| `/api/update` | `GET`, `POST` | Deploy: compare branches, branch list, deploy status; `POST` `restart` \| `rebuild` \| `update`. Requires `PS_ENABLE_DEPLOY_API`. |

## Drift and sync

| Resource | How drift is exposed | Sync routes |
|----------|----------------------|-------------|
| **Models** | `GET /api/models/sync/drift` | `POST .../pull`, `POST .../push` |
| **Profiles** | `GET /api/agent/profiles/sync/drift` for the full report, and `syncStatus` on each row from `GET /api/agent/profiles` for the per-row badge | `POST /api/agent/profiles/sync/push`, `POST .../pull` |

## RPC-style routes

Several routes use **GET for reads** and **POST with an `action` field** for mutations (not HTTP `PUT`/`DELETE` on the same path).

### `/api/missions`: `POST` body `action`

Each action body lives in its own handler under `src/lib/missions/mission-handlers/*` behind a thin router in the route.

| `action` | Purpose |
|----------|---------|
| `dispatch` | Create a mission and run it per `dispatchMode` (`save` draft / `queue` / `cron` recurring schedule / immediate) |
| `promote` | Promote a draft or queued-waiting mission per `dispatchMode` |
| `update` | Update fields of a **running** mission / rebuild prompt |
| `cancel` | Stop the backend run; mark failed with "Cancelled by user" |
| `delete` | Remove the mission and its linked PatterStage schedule |

`GET` supports `?id=` for one mission (status synced in background) or list with optional `?categoryId=`.

### `/api/models/fallbacks`: `POST` body `action`

| `action` | Purpose |
|----------|---------|
| `add` | Add a registry model to the fallback chain |
| `toggle` | Enable/disable one entry (`entryId`, `enabled`) |
| `reorder` | Swap an entry up/down (`entryId`, `direction`) |
| `custom` | Add a custom (non-registry) fallback (`name`, `provider`, `modelIdString`, `baseUrl?`) |
| `import` | Import the chain from Hermes `config.yaml` |
| `sync` | Write the enabled chain + behaviour config to Hermes |

`GET` returns the chain entries + behaviour config. Per-entry `GET`/`PUT`/`DELETE` live at `/api/models/fallbacks/[id]`; the behaviour config at `/api/models/fallbacks/config`.

### `/api/templates`: `POST` body `action`

| `action` | Purpose |
|----------|---------|
| `create` | New template |
| `update` | Update template |
| `delete` | Delete template |
| `importPack` | Import template pack JSON |

`GET` lists templates (cached).

### `/api/stories`: `POST` body `action`

| `action` | Purpose |
|----------|---------|
| `create` | New story |
| `list` | List stories |
| `load` | Load one story |
| `update` | Update metadata/config |
| `delete` | Delete story |
| `generate-chapter` | Generate chapter content |
| `retry-chapter` | Retry failed chapter |
| `rewrite-chapter` | Rewrite chapter |
| `edit-chapter` | Edit chapter text |
| `extend` | Extend outline |
| `continue` | Continue generation |
| `sync-titles` | Sync chapter titles |

### `/api/sessions`: `POST` body `action`

| `action` | Purpose |
|----------|---------|
| `create` | Pre-register session (dispatch pipeline) |
| `update` | Update session status / end time |

### Hindsight actions

**`GET /api/memory/hindsight`**, query param `action` (default `list`):

`list`, `recall`, `reflect`, `directives`, `mental-models`, `health`, `count`

**`POST /api/memory/hindsight`**, body `action` (default `retain`):

`retain`, `create-directive`, `create-model`, `update-directive`, `update-model`, `refresh-model`

**`DELETE /api/memory/hindsight`** with body `{ type, id, bank? }` removes a directive or mental model.

## Naming notes

- **`/api/agent/*`**: Hermes install config (profiles, behavior files, per-profile personality).
- **`/api/agents`**: Running OS processes (gateways, `hermes chat`), not profile CRUD.
- **`/api/personalities`** vs **`/api/agent/personality`**: global `config.yaml` personalities vs one profile’s selected personality.

## System cron notes

Managed crontab lines must run a script **under** `scriptsDir` (default `PS_DATA_DIR/scripts`). `POST`/`PUT` reject any other command path. Preset scripts ship in repo **`scripts/hardware/`**; **`scripts/bootstrap/setup.sh`** copies any missing `*.sh` into `PS_DATA_DIR/scripts` during setup. See **[SYSTEM-CRON.md](SYSTEM-CRON.md)**.

## Auth and safety notes

- **`PS_READ_ONLY`** rejects unsafe HTTP **methods** with a 503, in `src/proxy.ts`, before any handler runs. Reads keep working, which is the point of the mode. It applies to every route uniformly: there is nothing a route can forget to call.
- The refusal happens **after** authentication, so an unauthenticated write gets a 401 rather than learning whether the instance is read-only.
- Routes used to carry their own `requireAuth()` guard. It authenticated nothing, and because 34 GET handlers called it the mode blanked the dashboard it exists to enable. It was deleted in T-0048; `scripts/tooling/check-read-only-guards.mjs` fails the build if one comes back.
- Deploy actions (`/api/update` `POST`) require `PS_ENABLE_DEPLOY_API`.
- Optional signed requests: `PS_REQUEST_SIGNING_SECRET`.
- Correlation IDs: `x-correlation-id` or `x-request-id`.
