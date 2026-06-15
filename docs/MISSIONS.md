# Missions

How missions are stored, dispatched, and cancelled. Missions live in SQLite (`missions` table) with optional JSON overlays under `CH_DATA_DIR/missions/`.

## Prompt model

- The UI sends **raw** fields (`instruction`, `context`, `goals`, `outputFormat`, `constraints`, dirs, refs, skills, suggested toolsets) on dispatch/update.
- The API builds the stored `prompt` via `buildMissionPrompt()` in `src/lib/build-mission-prompt.ts` — XML under `<hermes_mission>` (agent payload).
- The composer preview can toggle **Human** (form mirror) vs **AI** (stored agent prompt).
- Editing uses `parseMissionPrompt()` for instruction/context/output/constraints; goals, dirs, refs, skills, and suggested toolsets load from DB columns.
- **Recommended toolsets** are prompt hints only (`<recommended_toolsets>`); runtime tools still come from the mission profile's `platform_toolsets`. The composer lists only toolsets enabled on the selected profile. See [TOOLS_AND_MISSIONS.md](TOOLS_AND_MISSIONS.md).
- `output_format` and `constraints` columns (baseline schema) persist those fields for edit round-trip.
- Missions saved before the XML format may need re-save after deploy.

## Dispatch modes

`POST /api/missions` with `action: "dispatch"` accepts `dispatchMode`:

| Mode | Behavior |
|------|----------|
| `save` | Persists a **draft** (`status=queued`, `queued_for_run=0`). Does not spawn Hermes. Shown in the **Drafts** board column. |
| `queue` | Persists as **queued for run** (`queued_for_run=1`). `MissionQueueSync` dispatches the oldest queued mission when no mission is `dispatched` (single-flight, ~15s tick). |
| `now` | Creates the mission and dispatches immediately via `dispatchMissionNow()`. |
| `cron` | Creates a linked Control Hub `schedules` row and runs the **first** execution immediately; later runs are fired by the Control Hub scheduler. |

### Model resolution at dispatch

`resolveMissionModel()` in `src/lib/backends/hermes.ts`:

- If both `modelId` and `provider` are sent → used as-is.
- If only `modelId` is sent → provider (and API key when configured) are resolved from the models registry (`findModelByModelId`).
- If neither is sent → the registry **agent** default from `model_defaults` is used.

The composer pre-fills the agent default model from `GET /api/models/defaults` when opening a new mission.

### Board columns vs status

- **Drafts:** `status=queued` and `queued_for_run=0` (save).
- **Queued:** `status=queued` and `queued_for_run=1` (queue, waiting for the worker).
- **Dispatched / Completed / Failed:** same as `status` enum.

Dashboard **active** count includes `dispatched` missions and queued-for-run missions, not drafts.

## Editing drafts and promoting queued missions

- **Draft** (`status=queued`, `queued_for_run=0`): edit in the composer, choose a dispatch mode, and submit. The UI calls `POST /api/missions` with `action: "promote"` (not `update`).
- **Queued for run** (`status=queued`, `queued_for_run=1`): same promote path — you can update fields, move back to drafts (`dispatchMode: save`), keep in queue (`queue`), or run immediately (`now`).
- **Running** (`status=dispatched`): `action: "update"` only — fields and linked cron sync; no duplicate mission.
- **Completed / failed**: re-dispatch creates a **new** mission id with `action: "dispatch"` and `dispatchMode: now`.

`promote` accepts the same payload fields as dispatch (instruction, profile, model, schedule, etc.). Queue promote triggers an immediate `runMissionQueueTick()` when nothing is already dispatched.

### Sync bootstrap on missions API

`GET` and `POST /api/missions` call `ensureSyncLayer()` so `MissionQueueSync` runs even when the operator stays on Orchestration → Missions without opening the dashboard (which polls `/api/monitor`).

## Categories

- User-managed categories live in `mission_categories` (SQLite).
- Missions use `category_id` (nullable). Templates store `categoryId` in custom JSON.
- APIs: `GET/POST/PUT/DELETE /api/mission-categories`.
- Default categories are seeded via `src/lib/db/seeds/001_mission_categories.sql` and **`npm run db:seed`** (8 categories with `seed_key`).

### Database migrations (operator)

Runtime database path: `CH_DATA_DIR/control-hub.db` (default `~/control-hub/data/control-hub.db`).

1. After deploying new code, **restart** the Control Hub process so `getDb()` runs pending migrations.
2. `npm run build` alone does **not** migrate your live DB (prebuild only touches `repo/data/`).
3. If the UI shows “No categories loaded”, on the host run:

   ```bash
   npm run db:migrate
   ```

   Ensure `CH_DATA_DIR` in `.env.local` matches where the server stores data, then restart.

4. Create categories from **Manage categories** (missions page) or the category combobox in the composer.

## Recurring missions

Recurring runs are **Control Hub-owned schedules** — the agent's `jobs.json` cron is no longer used:

- A `schedules` row links to a mission and holds the canonical schedule, `next_run_at`, `catch_up_policy`, and repeat count. The scheduler tick (`src/lib/orchestration/scheduler/`) selects due rows and dispatches a run via the runtime; **Control Hub owns the timer**.
- Manage via `/api/schedules` or the **Scheduled missions** section on the **Orchestration → Missions** page (create, pause/resume, run-now, delete). Old-fashioned **host shell scripts** on a timer live on the separate **Orchestration → Scripts** page (system crontab), not here.
- Restart-safe (recomputed from `next_run_at`, never an in-memory timer) and exactly-once per occurrence (deterministic run-id PK guard + `Idempotency-Key`).

## Cancellation

When you cancel a **running** mission, `cancelMissionRun()` (orchestration core):

1. **Backend** — calls `runtime.stopRun(run_id)` over HTTP (the Hermes API Server's `POST /v1/runs/{id}/stop`). No process signals, no pid files, no `pkill`, no platform restriction.
2. **SQLite** — the `runs` row becomes `cancelled`; the mission becomes `failed` with result `Cancelled by user`.
3. **Session** — the linked session row is ended.

Local run/mission/session state is finalised even if the backend stop call fails, so the board never shows a stuck "running" row.

## Session closure bridge

Every mission dispatch pre-registers a `sessions` row with `status="active"` before spawning Hermes (see `src/lib/mission-dispatch.ts`). The mission lifecycle and the session lifecycle therefore need to stay in lockstep — otherwise the Sessions page shows a "live" pulsing dot on rows whose mission is already `successful` or `failed` days ago.

The bridge is `closeSessionForMission(missionId, updates)` in `src/lib/session-repository.ts`, called from two places:

1. **`MissionSync.sync()`** — when the on-disk `<id>.status.json` says `successful`/`failed`, the sync updates the mission row and the session row in the same iteration. The orphan branch (process died without writing status.json) does the same with `status="failed"`, `error="Process terminated without completion"`.
2. **Admin backfill** — `POST /api/admin/sessions/backfill-status` with `{"dryRun": false}` runs the same logic for any pre-existing stuck rows. The matching `dryRun: true` returns counts without writing. Default is `dryRun: true` for safety.

The recurring orphan-sweep in `syncHermesSessionsToDb` (every 15s sync tick) also calls `closeOrphanedActiveSessions()` to catch any sessions the mission-side bridge missed — it has two paths:

- **Path A — parent-mission gated.** Active session whose `mission_id` points to a mission that is no longer `dispatched` (status `successful`/`failed`/`cancelled`/anything-else-terminal, or the mission is missing/soft-deleted). Closes as `completed`/`failed` derived from the parent.
- **Path B — age-only fallback.** Active session with no `mission_id` AND (size > 0 with age > 5 min, OR age > 30 min). The 30-min orphan gate catches parentless empty sessions that the original `size > 0` guard would have missed (e.g. orphaned api/cli/telegram sessions whose gateway never wrote `end_reason`).

Both paths share a 5-min boot safety window — a session that started in the last 5 minutes is never closed, even if its parent is long gone.

## UI

- **Compose:** right-side Sheet (`MissionCreateForm`) with category combobox and prompt preview.
- **View:** inline `MissionEditorPanel` on the mission board (no sheet scroll).
