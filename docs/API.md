---
summary: REST route inventory and the response envelope every PatterStage API handler returns
type: reference
tags: [product, api]
compiled_from: normalised
---

# API Reference

Dry reference for REST routes: envelope shape, inventory, auth notes. For behaviour in plain language, see [USER_WALKTHROUGH_GUIDE.md](USER_WALKTHROUGH_GUIDE.md) or the feature docs linked from [README.md](README.md).

All JSON API routes return the envelope:

```typescript
{ data?: T; error?: string }
```

Some error responses also include `details` (Zod validation). Handlers must call `logApiError(route, context, error)` from `@/lib/api-logger` in catch blocks.

Five routes deliberately sit outside the envelope, and a client integrator should special-case them:

- `/api/health` returns a bare `{ ok: true }` (no `data` wrapper) because it is the one unauthenticated route and must stay trivially parseable by a container probe.
- The three SSE routes (`/api/runs/[id]/events`, `/api/composer/runs/[id]/events`, `/api/laboratory/research/[id]/events`) return a `text/event-stream` body, and their pre-stream errors are plain text, not JSON.
- `/api/laboratory/research/[id]/export` returns raw HTML with a `Content-Disposition` header.

## Route inventory

Every `route.ts` under `src/app/api` has a row, here or in the Chat / Composer / Laboratory tables that follow. A route absent from all four does not exist.

| Route | Methods | Purpose |
|---|---|---|
| `/api/agent/files/[key]` | `GET`, `PUT` | Read/update one behavior file (`soul`, `hermes`, `user`, `memory`, `agent`, `env`, `config`). Any other key is a **400** (`Unknown file key`). Optional `?profile=` for non-default profiles. |
| `/api/agent/personality` | `PUT` | Set personality for one agent profile (Operations → Agents). |
| `/api/agent/profiles` | `GET`, `POST` | Professional profiles (SQLite source of truth; each row includes `syncStatus` for drift). |
| `/api/agent/profiles/[id]` | `PUT`, `DELETE` | Update or delete one profile (no `GET`, use list + id). |
| `/api/agent/profiles/sync/drift` | `GET` | Full drift report (root, named profiles, skills catalog). Returns the per-resource sync state that the drift banner reads. |
| `/api/agent/profiles/sync/push` | `POST` | Push to `HERMES_HOME/profiles/<slug>/`. Body is a bag of optional flags, first match wins: `{ root }`, `{ skills }`, `{ skillKey }`, `{ all }` / `{ missingOnly }` / `{ onlyOutOfSync }`, else `{ slug }`. |
| `/api/agent/profiles/sync/pull` | `POST` | Pull from Hermes disk into the DB. Same flag-bag shape: `{ skills }`, `{ skillKey }`, `{ all }` / `{ importDiscovered }`, `{ root }` (or `slug: "default"`), else `{ slug }`. Supplying none of them is a **400** (`slug, all, root, or skills required`). |
| `/api/agent/profiles/sync/import` | `GET`, `POST` | `GET` lists profiles discovered on Hermes disk (each with an `inDatabase` flag); `POST` imports them into the DB (`{ importSkills }`, `{ importAllDiscovered }`, or `{ slug }`). |
| `/api/agents` | `GET` | Inspect running Hermes agent processes (OS-dependent). Not the same as `agent/profiles`. |
| `/api/agents/experience` | `GET` | Every profile's accumulated Agent Experience, ranked. Derived from completed runs, active days, enabled skills, attached toolsets and memory facts. The surviving half of the deleted benchmark subsystem (ADR-0004): no capability claim, only what the agent actually did or was given. |
| `/api/config` | `GET`, `PUT` | Read/update parsed Hermes config content. |
| `/api/credentials` | `GET`, `POST` | API key credentials (masked list; create via POST). |
| `/api/credentials/[id]` | `DELETE` | Delete one credential: its Hermes `.env` variable goes with it unless a same-provider sibling still uses it, and the models that pointed at it are unlinked; the answer says which happened. `GET` returns **405**. |
| `/api/cron/hardware` | `GET`, `POST`, `PUT`, `DELETE` | Host **scripts** (system cron) under `PS_SCRIPTS_DIR` / `PS_HARDWARE_LOG_DIR`, powering the Scripts page. (The legacy `/api/cron` agent-cron bridge has been removed; recurring agent work uses `/api/schedules`.) |
| `/api/cron/hardware/meta` | `GET` | `{ scriptsDir, logDir }`. |
| `/api/scripts` | `GET` | List host script files under `PS_DATA_DIR/scripts` with schedule + last-run (powers the Scripts page). |
| `/api/scripts/[name]` | `GET`, `PUT`, `DELETE` | Read, upsert (`{ content }`) or delete one host script. Path-validated under `PS_DATA_DIR/scripts`; powers the in-app editor. |
| `/api/scripts/run` | `POST` | Run a script on demand (`{ name }`). Path-validated, no shell. |
| `/api/scripts/logs` | `GET` | Tail a script's log (`?name=&lines=`). |
| `/api/schedules` | `GET`, `POST` | PatterStage-owned recurring missions (the scheduler fires these; no `jobs.json`). |
| `/api/schedules/[id]` | `GET`, `PATCH`, `DELETE` | Read one schedule (404 when missing), pause/resume or edit it (`enabled`, `name`, `schedule`, `scheduleDisplay`, `catchUpPolicy`, `repeatTimes`, `profileName`), or delete it. |
| `/api/schedules/[id]/run` | `POST` | Dispatch a scheduled mission immediately (run-now). |
| `/api/stats` | `GET` | Dashboard analytics aggregate (throughput, mission mix, run activity, tokens, per-agent performance, derived progression + the ~36 achievements). Also appends a per-agent progression snapshot when an agent's recorded level or unlocked set has moved. |
| `/api/agents/progression` | `GET` | The **recorded** per-agent growth, from the append-only `agent_progression_snapshots` table: newest row per profile, or one profile's whole trail with `?slug=`. Survives the retention prune of the events it was derived from (see [MIGRATION.md](MIGRATION.md)). |
| `/api/analytics` | `GET` | Interaction analytics summary (`{ totals, last30, activeDays }`) over the `analytics_events` log. Read-only: events are server-emitted, so there is no `POST`. See [ANALYTICS.md](ANALYTICS.md). |
| `/api/analytics/timeseries` | `GET` | Gap-filled daily event counts (`?type=&days=&bucket=day`; `days` clamped 1–365). |
| `/api/analytics/insights` | `GET` | Composed bundle for the Insights workbench (`?days=`, default 30): hour-of-day, per-category daily, run-duration distribution, per-model tokens/cost, top missions, success-rate trend. |
| `/api/spend` | `GET`, `PUT` | Provider spend per calendar period and per source, plus the operator's **optional** budget and the verdict against it. `PUT` sets `limitUsd` (positive number, or `null` to remove the budget), `period` (`day`/`week`/`month`) and `hardStop`. Arming `hardStop` without a figure is a 400. See [SPEND.md](SPEND.md). |
| `/api/fs/git/branches` | `GET` | List git branches for a workspace path. |
| `/api/fs/list` | `GET` | List directory entries (path-validated). |
| `/api/gateway/health` | `GET` | Gateway probe → `{ online, authConfigured }`. Any HTTP response (incl. 401/403) ⇒ reachable; 401/403 ⇒ reachable but the `API_SERVER_KEY` is missing/wrong. |
| `/api/gateway/models` | `GET` | List models from gateway. |
| `/api/logs` | `GET`, `DELETE` | Read recent Hermes logs; clear/truncate log tail. |
| `/api/memory` | `GET` | Memory **provider status**, not facts: `{ facts, total, dbSize, available, provider, message }`, with `facts` empty on every branch. Facts are managed by agent tools (`hindsight_retain` / `_recall` / `_reflect`), never by the dashboard, so `POST`, `PUT` and `DELETE` are all bound to one handler that returns **400** for every provider. |
| `/api/memory/config` | `GET`, `PUT`, `POST` | The PatterStage-owned memory provider config. `GET` lists providers + the active connection; `PUT` updates a provider's host/port/bank (and enable/activate); `POST { action: "test", type, config }` probes an endpoint before saving. No file edits. See [MEMORY.md](MEMORY.md). |
| `/api/memory/hindsight` | `GET`, `POST`, `DELETE` | Hindsight bridge (see [Hindsight actions](#hindsight-actions) below). |
| `/api/mission-categories` | `GET`, `POST`, `PUT`, `DELETE` | Mission category CRUD (see [MISSIONS.md](MISSIONS.md)). |
| `/api/missions` | `GET`, `POST` | Mission list/detail + RPC mutations (see [RPC-style routes](#rpc-style-routes)). |
| `/api/missions/[id]` | `GET` | One mission, for REST symmetry with the sub-routes below. The list endpoint also accepts `?id=`. |
| `/api/missions/[id]/dispatch` | `POST` | Run a mission through the agent runtime (no bash, no status files); RunSync reconciles completion. |
| `/api/missions/[id]/cancel` | `POST` | Stop a running mission via `runtime.stopRun`. Local run/mission/session state is finalised even if the backend call fails. |
| `/api/missions/[id]/run` | `GET` | The mission's latest run, so the board can resolve a PatterStage run id and stream `/api/runs/[id]/events`. |
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
| `/api/personalities` | `GET`, `POST`, `PUT` | Global personalities in the active Hermes `config.yaml`. `DELETE` returns **405**: a personality is a profile's SOUL.md identity, so delete the profile instead. |
| `/api/runs/[id]` | `GET` | Current state of one agent run. |
| `/api/runs/[id]/events` | `GET` | Live **SSE** proxy for a run (`text/event-stream`). 404 when the run is unknown, 409 before it has been submitted to the backend. The Chat page and the mission board both stream from here. |
| `/api/runs/reconcile` | `POST` | Force an immediate reconcile pass over active runs, rather than waiting for the ~15s BackgroundScheduler tick. Idempotent. |
| `/api/seed` | `GET`, `POST` | Read seed state / run catalog seed. |
| `/api/seed/clean` | `GET`, `POST` | `GET` previews the throwaway test data a purge would remove; `POST` purges it and writes an audit line. |
| `/api/sessions` | `GET`, `POST` | List sessions; `POST` for dispatch pipeline (see [RPC-style routes](#rpc-style-routes)). |
| `/api/sessions/[id]` | `GET` | Read one session transcript. |
| `/api/admin/sessions/backfill-status` | `POST` | One-shot orphan-close sweep over stuck session rows, running the same logic as the recurring 15s sync as an explicit operator action. `{ dryRun: true }` (the default) returns the counts that *would* change. See [MISSIONS.md](MISSIONS.md). |
| `/api/skills` | `GET` | List skills inventory. |
| `/api/skills/[name]` | `GET`, `PUT` | Read or update one skill document. |
| `/api/skills/[name]/toggle` | `PUT` | Enable/disable a skill for a profile. |
| `/api/skills/[...path]` | `GET` | Read files under a skill tree (`SKILL.md`, etc.). |
| `/api/status` | `GET` | Basic readiness endpoint, read from the `meta` table. Requires auth. |
| `/api/status/subsystems` | `GET` | The dashboard's Subsystems panel: gateway (with its URL), memory, scheduler and database, each with a state and the reason for it. |
| `/api/status/runtime` | `GET` | How this install is configured, as data: auth mode, whether the deploy API and read-only are on, the composer flag, data directory, database path, Hermes home, port, schema version, app version, commit, gateway address, Node and platform. No secrets: it says whether the token mode is on, never what the token is. Backs Settings > System and its "Copy for a bug report". |
| `/api/backup` | `GET`, `POST` | `GET` lists the database backups newest first (`{ dbPath, dir, backups: [{ name, path, bytes, takenAt, kind }], restoreCommand }`): the snapshots under `PS_DATA_DIR/backups/db` (or `PS_DB_BACKUP_DIR`) plus the `pre-migrate` and `pre-baseline` files beside the database. It creates nothing, and read-only can still read it. `POST` takes one with better-sqlite3's online backup, which is consistent under WAL, and answers **201** `{ backup }`; read-only refuses it. The same snapshot runs before a replace-mode Restore and before a test-data purge. Restoring is a shell step the operator runs with the server stopped; `restoreCommand` is that command, and nothing here executes it. Backs the Backups card on Settings > System. |
| `/api/prefs` | `GET`, `PUT` | The console's own settings for this operator (`{ prefs }`): the rail collapsed, the dispatch strip open, quests completed or skipped, the guide hidden, the last help page. `PUT` `{ key, value }` against a Zod allow-list of six keys; an unknown key or a wrong shape is **400**, and read-only refuses it. |
| `/api/health` | `GET` | The one **unauthenticated** route (the `PUBLIC_PATHS` allow-list in `src/proxy.ts`). Returns a bare `{ ok: true }` and deliberately reports nothing about the system, so a container probe never needs the access token. Anything describing real state belongs on `/api/status`. |
| `/api/feature-flags` | `GET` | Current feature-flag state (`{ flags }`), so client components can hide disabled surfaces without a rebuild. Flags default ON; today the only flag is `composer`. |
| `/api/stories` | `POST` | Story Weaver: all operations via `action` (see [RPC-style routes](#rpc-style-routes)). |
| `/api/sync` | `GET`, `POST` | Background sync control and status. |
| `/api/templates` | `GET`, `POST` | Mission templates; mutations via `action` on `POST`. |
| `/api/tools` | `GET` | Read-only Hermes toolset ID catalog. `POST` returns **405** (writes not supported). |
| `/api/agent/profiles/[id]/toolsets` | `GET`, `PUT` | Read or update `platform_toolsets` for a profile (`default` = agent root). `GET` hydrates from DB → yaml → seed and may persist normalized JSON. `PUT` saves and pushes to Hermes disk. `DELETE` returns **405**. |
| `/api/update` | `GET`, `POST` | Deploy: compare branches, branch list, deploy status; `POST` `restart` \| `rebuild` \| `update`. `POST` is gated by `PS_ENABLE_DEPLOY_API` (see [Auth and safety notes](#auth-and-safety-notes)); both `GET` answers carry `deployEnabled` so the footer can say so before the click, and a compare that could not be made says `checkFailed: true` rather than "up to date". |

### Chat

Agent conversations. See [CHAT.md](CHAT.md).

| Route | Methods | Purpose |
|---|---|---|
| `/api/chat` | `GET`, `POST` | List conversations (most recent first); create one, mapped to a fresh Hermes session (`{ title?, profileName?, model? }`). |
| `/api/chat/[id]` | `GET`, `DELETE` | Read `{ conversation, messages }`, self-healing any stuck assistant turn on the way out; or delete the conversation and cascade its messages. |
| `/api/chat/[id]/messages` | `POST` | Send a user turn (`{ content, mode? }`). `mode: "agent"` (the default) submits a run and returns the PatterStage `runId` to stream from `/api/runs/[runId]/events`; `mode: "fast"` persists the turn and an assistant placeholder with no run behind it, and the client streams the raw-model reply itself. |
| `/api/chat/[id]/messages/[messageId]` | `PATCH` | Finalize a streamed turn: content, reasoning, tool calls, terminal status. The fast path, not the only path, since `GET /api/chat/[id]` also heals from the run row. |
| `/api/chat/[id]/stop` | `POST` | Stop the conversation's in-flight run (`{ runId? }`, defaulting to the latest active assistant turn) and finalize it as cancelled. A turn with no run returns `{ stopped: false, reason: "no active run" }`. |
| `/api/chat/[id]/approval` | `POST` | Resolve a tool-use approval gate (`{ runId, approved, note? }`) via `runtime.resolveApproval`. |

### Composer

Graph orchestration. Every route below, the SSE stream included, returns **503** when `PS_COMPOSER` is falsy. See [COMPOSER.md](COMPOSER.md).

| Route | Methods | Purpose |
|---|---|---|
| `/api/composer/workflows` | `GET`, `POST` | List workflow definitions; create one from a whole-graph definition. |
| `/api/composer/workflows/[id]` | `GET`, `PUT`, `DELETE` | Read the full graph, replace it atomically, or delete it. Edits are blocked while the workflow has active runs. |
| `/api/composer/runs` | `GET`, `POST` | List recent runs; start one (`{ workflowId \| workflowKey, input }`) and kick the engine so the first stage dispatches immediately. |
| `/api/composer/runs/[id]` | `GET` | One run + its node-runs + the workflow graph. |
| `/api/composer/runs/[id]/events` | `GET` | Live **SSE** (`{ run, nodeRuns }` snapshots), closing when the run is terminal. |
| `/api/composer/runs/[id]/cancel` | `POST` | Cancel a run: the run and its live node-runs are marked cancelled and their backend runs are stopped. |
| `/api/composer/runs/[id]/nodes/[nodeId]/approve` | `POST` | Resolve a human-in-the-loop gate (`accept` \| `reject` \| `review` \| `add_feature`) and advance the graph. |
| `/api/composer/runs/[id]/clarify` | `POST` | Answer a stage's clarification question (`{ answer }`); the answer enriches the objective and re-dispatches the asking stage. |

### Laboratory

Deep Research and the artifacts registry. See [LABORATORY.md](LABORATORY.md) and [DEEP_RESEARCH.md](DEEP_RESEARCH.md).

| Route | Methods | Purpose |
|---|---|---|
| `/api/laboratory/research` | `GET`, `POST` | List recent research runs; start one (`{ query, config? }`), which creates the row and fires the engine as fire-and-forget. |
| `/api/laboratory/research/[id]` | `GET` | One research run + its steps. |
| `/api/laboratory/research/[id]/events` | `GET` | Live **SSE** (`{ run, steps }` snapshots), closing when the run is terminal. |
| `/api/laboratory/research/[id]/export` | `GET` | The standalone interactive HTML report. Raw `text/html` with a `Content-Disposition: inline` header, not the JSON envelope. |
| `/api/laboratory/research/presets` | `GET`, `POST`, `DELETE` | Saved Deep Research configurations; `DELETE` takes `?id=`. |
| `/api/artifacts` | `GET`, `POST` | The artifacts registry. `GET` lists, filterable by `?kind=` and `?runId=`; `POST` creates one, with `sourceKind` one of `research`, `composer`, `mission`, `chat`, `manual` (default `manual`). |
| `/api/artifacts/[id]` | `GET`, `DELETE` | Read one artifact with its content, or delete it. |

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
| `characters` | The reusable character library. Takes a `subAction` of its own (`list` (default) \| `create` \| `update` \| `delete`). |
| `themes` | The reusable theme library, same `subAction` set. |

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

- **`PS_READ_ONLY`** rejects unsafe HTTP **methods** with a 503, in `src/proxy.ts`, before any handler runs. Reads keep working, which is the point of the mode. It applies to every route uniformly by method. Three reads do bookkeeping writes of their own on every poll (the `/api/stats` progression capture, the toolsets normalisation, the `/api/sessions` state.db sync); each skips that write under the mode and still answers, and the linter that forbids a read-only guard in a GET accepts exactly those three, each with its reason on the line above.
- The refusal happens **after** authentication, so an unauthenticated write gets a 401 rather than learning whether the instance is read-only.
- Routes used to carry their own `requireAuth()` guard. It authenticated nothing, and because 34 GET handlers called it the mode blanked the dashboard it exists to enable. It was deleted in T-0048; `scripts/tooling/check-read-only-guards.mjs` fails the build if one comes back.
- Deploy actions (`POST /api/update`) require `PS_ENABLE_DEPLOY_API`. Setup writes it `true` on a fresh install (only when absent, so a choice survives a re-run); set it `0`/`false`/`no` to close the route, and the sidebar block says so before the click. Unset, the gate falls back to `NODE_ENV !== "production"`, so an install that predates setup writing it is *enabled* under `npm run dev` and closed under `npm run start`.
- **Host-affecting writes** (`POST /api/scripts/run`, `PUT`/`DELETE /api/scripts/[name]`, `POST`/`PUT`/`DELETE /api/cron/hardware`, `POST /api/update`) return **403** while `PS_AUTH_MODE=none`. Writing a script that a crontab will later execute, running one, or spawning the deploy script is unauthenticated RCE once the token is switched off; with the token on, the operator already has shell access to that host, so it is a feature. The proxy refuses these from a list of paths before any handler runs, and the routes carry the same guard themselves.
- The two notes below are **`POST /api/update` only**, not API-wide. Nothing else calls these helpers, so setting the secret or sending the headers hardens no other route.
- Optional signed requests: `PS_REQUEST_SIGNING_SECRET`, with `x-ps-ts` + `x-ps-signature` headers over `METHOD:path:ts` and a 5-minute window. Unset means unsigned requests pass.
- Correlation IDs: `x-correlation-id` or `x-request-id`; a UUID is generated when neither is sent.
