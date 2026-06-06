# API Reference

Dry reference for REST routes—envelope shape, inventory, auth notes. For behaviour in plain language, see [USER_WALKTHROUGH_GUIDE.md](USER_WALKTHROUGH_GUIDE.md) or the feature docs linked from [README.md](README.md).

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
| `/api/agent/profiles/[id]` | `PUT`, `DELETE` | Update or delete one profile (no `GET` — use list + id). |
| `/api/agent/profiles/sync/drift` | `GET` | Full drift report (root, named profiles, skills catalog). Returns the per-resource sync state that the drift banner reads. |
| `/api/agent/profiles/sync/push` | `POST` | Push profile(s) to `HERMES_HOME/profiles/<slug>/` (`{ slug }` or `{ all: true }`). |
| `/api/agent/profiles/sync/pull` | `POST` | Pull one profile from Hermes disk into DB (`{ slug }` required). |
| `/api/agents` | `GET` | Inspect running Hermes agent processes (OS-dependent). Not the same as `agent/profiles`. |
| `/api/config` | `GET`, `PUT` | Read/update parsed Hermes config content. |
| `/api/credentials` | `GET`, `POST` | API key credentials (masked list; create via POST). No per-id route. |
| `/api/cron` | `GET`, `POST`, `PUT`, `DELETE` | Manage **agent** cron jobs (Hermes `jobs.json`). |
| `/api/cron/hardware` | `GET`, `POST`, `PUT`, `DELETE` | **System** cron under `CH_SCRIPTS_DIR` / `CH_HARDWARE_LOG_DIR`. |
| `/api/cron/hardware/meta` | `GET` | `{ scriptsDir, logDir }`. |
| `/api/fs/git/branches` | `GET` | List git branches for a workspace path. |
| `/api/fs/list` | `GET` | List directory entries (path-validated). |
| `/api/gateway/health` | `GET` | Gateway health probe (`/v1/models`). |
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
| `/api/models/fallbacks` | `GET`, `POST` | Fallback chain entries. |
| `/api/models/fallbacks/[id]` | `GET`, `PUT`, `DELETE` | One fallback entry. |
| `/api/models/fallbacks/config` | `GET`, `PUT` | Fallback chain behaviour config. |
| `/api/models/fallbacks/custom` | `POST` | Add custom (non-registry) fallback. |
| `/api/models/fallbacks/import` | `GET`, `POST` | `GET` preview; `POST` import from Hermes. |
| `/api/models/fallbacks/reorder` | `POST` | Reorder fallback chain. |
| `/api/models/fallbacks/sync` | `POST` | Sync fallbacks to Hermes. |
| `/api/models/fallbacks/toggle` | `POST` | Enable/disable one fallback entry. |
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
| `/api/stories` | `POST` | Story Weaver — all operations via `action` (see [RPC-style routes](#rpc-style-routes)). |
| `/api/sync` | `GET`, `POST` | Background sync control and status. |
| `/api/templates` | `GET`, `POST` | Mission templates; mutations via `action` on `POST`. |
| `/api/tools` | `GET` | Read-only Hermes toolset ID catalog. `POST` returns **410** (writes not supported). |
| `/api/agent/profiles/[id]/toolsets` | `GET`, `PUT` | Read or update `platform_toolsets` for a profile (`default` = agent root). `GET` hydrates from DB → yaml → seed and may persist normalized JSON. `PUT` saves and pushes to Hermes disk. |
| `/api/update` | `GET`, `POST` | Deploy: compare branches, branch list, deploy status; `POST` `restart` \| `rebuild` \| `update`. Requires `CH_ENABLE_DEPLOY_API`. |

## Drift and sync

| Resource | How drift is exposed | Sync routes |
|----------|----------------------|-------------|
| **Models** | `GET /api/models/sync/drift` | `POST .../pull`, `POST .../push` |
| **Profiles** | `GET /api/agent/profiles/sync/drift` for the full report, and `syncStatus` on each row from `GET /api/agent/profiles` for the per-row badge | `POST /api/agent/profiles/sync/push`, `POST .../pull` |

## RPC-style routes

Several routes use **GET for reads** and **POST with an `action` field** for mutations (not HTTP `PUT`/`DELETE` on the same path).

### `/api/missions` — `POST` body `action`

| `action` | Purpose |
|----------|---------|
| `dispatch` | Create mission, optional schedule/cron, spawn Hermes agent |
| `update` | Update mission fields / rebuild prompt |
| `cancel` | Stop running agent; mark failed with "Cancelled by user" |
| `delete` | Remove mission and linked cron |
| `status` | Poll backend status for a mission id |

`GET` supports `?id=` for one mission or list with optional `?categoryId=`.

### `/api/templates` — `POST` body `action`

| `action` | Purpose |
|----------|---------|
| `create` | New template |
| `update` | Update template |
| `delete` | Delete template |
| `importPack` | Import template pack JSON |

`GET` lists templates (cached).

### `/api/stories` — `POST` body `action`

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

### `/api/sessions` — `POST` body `action`

| `action` | Purpose |
|----------|---------|
| `create` | Pre-register session (dispatch pipeline) |
| `update` | Update session status / end time |

### Hindsight actions

**`GET /api/memory/hindsight`** — query param `action` (default `list`):

`list`, `recall`, `reflect`, `directives`, `mental-models`, `health`, `count`

**`POST /api/memory/hindsight`** — body `action` (default `retain`):

`retain`, `create-directive`, `create-model`, `update-directive`, `update-model`, `refresh-model`

**`DELETE /api/memory/hindsight`** — body `{ type, id, bank? }` removes a directive or mental model.

## Naming notes

- **`/api/agent/*`** — Hermes install config: profiles, behavior files, per-profile personality.
- **`/api/agents`** — Running OS processes (gateways, `hermes chat`), not profile CRUD.
- **`/api/personalities`** vs **`/api/agent/personality`** — global `config.yaml` personalities vs one profile’s selected personality.

## System cron notes

Managed crontab lines must run a script **under** `scriptsDir` (default `CH_DATA_DIR/scripts`). `POST`/`PUT` reject any other command path. Preset scripts ship in repo **`scripts/hardware/`**; **`scripts/bootstrap/setup.sh`** copies any missing `*.sh` into `CH_DATA_DIR/scripts` during setup. See **[SYSTEM-CRON.md](SYSTEM-CRON.md)**.

## Auth and safety notes

- **`CH_READ_ONLY`** blocks writes (503) on routes that call `requireAuth()` from `@/lib/api-auth.ts`.
- Not all mutating routes use `requireAuth` (e.g. some `memory` and `personalities` writes).
- Deploy actions (`/api/update` `POST`) require `CH_ENABLE_DEPLOY_API`.
- Optional signed requests: `CH_REQUEST_SIGNING_SECRET`.
- Correlation IDs: `x-correlation-id` or `x-request-id`.
