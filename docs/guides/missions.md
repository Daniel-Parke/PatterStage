---
title: Missions
summary: How missions are stored, dispatched and cancelled, and how the stored prompt is built
section: guides
nav: 30
audience: operator
screen: /work/missions
concepts: [mission, run, schedule]
type: reference
tags: [product, orchestration]
compiled_from: normalised
---
# Missions

How missions are stored, dispatched, and cancelled. Missions live in SQLite (`missions` table), and the database is the single source of truth. `PS_DATA_DIR/missions/` holds only legacy artifacts from the pre-rewrite bash dispatch. There are exactly three readers left: the one-time `*.json` import inside a baseline rebuild of a pre-rewrite database ([MIGRATION.md](../running/migration.md)), a fallback `.session` / `.output.log` read when a mission-born session has no transcript on disk, and a best-effort unlink of the old artifact names when a mission is deleted. Nothing writes there now, and no file overlays a mission row on read.

> Missions are intentionally **simple**: a single or recurring agent task (think "cron for AI agents"). For methodical, **multi-stage** workflows with conditional branches, loop-backs, and human-in-the-loop gates, use **[Composer](COMPOSER.md)** (a separate orchestrator). Missions are not phased.

## Prompt model

- The UI sends **raw** fields (`instruction`, `context`, `goals`, `outputFormat`, `constraints`, dirs, refs, skills, suggested toolsets) on dispatch/update.
- The API builds the stored `prompt` via `buildMissionPrompt()` in `src/lib/missions/build-mission-prompt.ts`: XML under `<hermes_mission>` (agent payload).
- The composer preview can toggle **Human** (form mirror) vs **AI** (stored agent prompt).
- Editing uses `parseMissionPrompt()` for instruction/context/output/constraints; goals, dirs, refs, skills, and suggested toolsets load from DB columns.
- **Recommended toolsets** are prompt hints only (`<recommended_toolsets>`); runtime tools still come from the mission profile's `platform_toolsets`. The composer lists only toolsets enabled on the selected profile. See [TOOLS_AND_MISSIONS.md](../reference/catalog-and-profiles.md).
- `output_format` and `constraints` columns (baseline schema) persist those fields for edit round-trip.
- Missions saved before the XML format may need re-save after deploy.

## Dispatch modes

`POST /api/missions` with `action: "dispatch"` accepts `dispatchMode`:

| Mode | Behavior |
|------|----------|
| `save` | Persists a **draft** (`status=queued`, `queued_for_run=0`). Does not spawn Hermes. Shown in the **Drafts** board column. |
| `queue` | Persists as **queued for run** (`queued_for_run=1`). `MissionQueueSync` dispatches the oldest queued mission when no mission is `dispatched` (single-flight, ~15s tick) **and** the operator's hard spend stop allows unattended dispatch. The spend gate is checked first, so a blocked tick leaves the mission queued and still dispatchable by hand. |
| `now` | Creates the mission and dispatches immediately via `dispatchMissionNow()`. |
| `cron` | Creates a linked PatterStage `schedules` row and runs the **first** execution immediately; later runs are fired by the PatterStage scheduler. |

A queued mission that will not start is worth checking against the spend stop first. `MissionQueueSync` treats a spend refusal as a deliberate outcome rather than a failure: it reports `success: true` with the reason carried in the result's `error` field, so it surfaces on the monitor rather than as a red sync error. See [SPEND.md](../reference/spend.md).

### Model resolution at dispatch

The models registry (`models` table) is the **single source of truth** for what any mission can run on. `parseMissionBodyFields()` in `src/lib/missions/mission-body.ts` validates the request body:

- `modelId` is checked against the registry via `findModelByModelId()`. A foreign `modelId` (not in the table) is **silently dropped**, and only the registry row's own `modelId` is stored.
- `provider` is accepted **only alongside a `modelId` that resolved**, and is stripped whenever the `modelId` was dropped, so `missions.provider` can never contradict `missions.model_id`. It is not re-derived from the registry row: a resolved `modelId` lets the caller's `provider` string through verbatim onto the mission row, and `dispatchMissionRun` reads it straight back out onto the session.
- If no valid `modelId` survives, `missions.model_id` stays NULL and nothing substitutes a default. **Runs carry no model over the wire at all**: `RunSubmit` has `input`, `idempotencyKey`, `profileName`, `sessionId` and friends, but no model field, so the profile's own Hermes configuration decides what actually answers. `mission.model_id` is recorded on the run's pre-registered session row for reporting, and that is the whole of its effect at dispatch time.

`getDefaultModel("agent")` is therefore not a dispatch-time fallback. It has two callers: the tie-break inside `findModelByModelId()` when two registry rows share a `model_id`, and `GET /api/models/defaults`, which the composer reads to pre-fill the model selector when opening a new mission.

### Board columns vs status

- **Drafts:** `status=queued` and `queued_for_run=0` (save).
- **Queued:** `status=queued` and `queued_for_run=1` (queue, waiting for the worker).
- **Dispatched / Completed / Failed:** same as `status` enum.

Dashboard **active** count includes `dispatched` missions and queued-for-run missions, not drafts.

## Editing drafts and promoting queued missions

- **Draft** (`status=queued`, `queued_for_run=0`): edit in the composer, choose a dispatch mode, and submit. The UI calls `POST /api/missions` with `action: "promote"` (not `update`).
- **Queued for run** (`status=queued`, `queued_for_run=1`): same promote path. You can update fields, move back to drafts (`dispatchMode: save`), keep in queue (`queue`), or run immediately (`now`).
- **Running** (`status=dispatched`): `action: "update"` only. Fields and linked cron sync; no duplicate mission.
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

Runtime database path: `PS_DATA_DIR/patterstage.db`. Setting `PS_DATA_DIR` (or the legacy `CH_DATA_DIR` / `CONTROL_HUB_DATA_DIR`) always wins and stops the guessing. With none of them set, PatterStage discovers the directory: it probes `~/PatterStage/data`, then `~/patterstage/data`, then the pre-rename `~/control-hub/data`, taking the first that already holds a database, else the first that merely exists, else creating `~/patterstage/data`. Inside that directory it prefers `patterstage.db` but opens a pre-existing `control-hub.db` when that is the only one, or the larger of the two when both exist. So an install can legitimately be running out of a capitalised directory or a legacy filename. Check which file the server actually opened before assuming it is `~/patterstage/data/patterstage.db`.

1. After deploying new code, **restart** the PatterStage process so `getDb()` runs pending migrations.
2. `npm run build` alone does **not** migrate your live DB (prebuild only touches `repo/data/`).
3. If the UI shows “No categories loaded”, on the host run:

   ```bash
   npm run db:migrate
   ```

   Ensure `PS_DATA_DIR` in `.env.local` matches where the server stores data, then restart.

4. Create categories from **Manage categories** (missions page) or the category combobox in the composer.

## Recurring missions

Recurring runs are **PatterStage-owned schedules**, and the agent's `jobs.json` cron is no longer used:

- A `schedules` row links to a mission and holds the canonical schedule, `next_run_at`, `catch_up_policy`, and repeat count. The scheduler tick (`src/lib/orchestration/scheduler/`) selects due rows and dispatches a run via the runtime; **PatterStage owns the timer**.
- Manage via `/api/schedules` or the **Scheduled missions** section on the **Orchestration → Missions** page (create, pause/resume, run-now, delete). Old-fashioned **host shell scripts** on a timer live on the separate **Orchestration → Scripts** page (system crontab), not here.
- Restart-safe (recomputed from `next_run_at`, never an in-memory timer) and exactly-once per occurrence (deterministic run-id PK guard + `Idempotency-Key`).

## Cancellation

When you cancel a **running** mission, `cancelMissionRun()` (orchestration core):

1. **Backend:** calls `runtime.stopRun(run_id)` over HTTP (the Hermes API Server's `POST /v1/runs/{id}/stop`). No process signals, no pid files, no `pkill`, no platform restriction.
2. **SQLite:** the `runs` row becomes `cancelled`; the mission becomes `failed` with result `Cancelled by user`.
3. **Session:** the linked session row is ended.

Local run/mission/session state is finalised even if the backend stop call fails, so the board never shows a stuck "running" row.

## Session closure bridge

Every mission dispatch pre-registers a `sessions` row with `status="active"` before submitting the run (see `src/lib/orchestration/dispatch.ts`). The mission lifecycle and the session lifecycle therefore need to stay in lockstep. Otherwise the Sessions page shows a "live" pulsing dot on rows whose mission is already `successful` or `failed` days ago.

The bridge is `closeSessionForMission(missionId, updates)` in `src/lib/sessions/session-repository.ts`, called from two places:

1. **`reconcileActiveRuns()`** (`src/lib/orchestration/run-reconcile.ts`, on the 15s background tick via `RunSync`) polls each non-terminal run with `runtime.getRun()`. When the backend reports a terminal state (completed/failed/cancelled), or a stuck run passes its deadline, it writes the terminal state to the run, mission, and session rows in the same pass. This replaced the old `MissionSync` / `status.json` polling.
2. **Admin backfill:** `POST /api/admin/sessions/backfill-status` with `{"dryRun": false}` runs the same logic for any pre-existing stuck rows. The matching `dryRun: true` returns counts without writing. Default is `dryRun: true` for safety.

The recurring orphan-sweep in `syncHermesSessionsToDb` (every 15s sync tick) also calls `closeOrphanedActiveSessions()` to catch any sessions the mission-side bridge missed. It has two paths:

- **Path A: parent-mission gated.** Active session whose `mission_id` points to a mission that is no longer `dispatched` (status `successful`/`failed`/`cancelled`/anything-else-terminal, or the mission is missing/soft-deleted). Closes as `completed`/`failed` derived from the parent.
- **Path B: age-only fallback.** Active session with no `mission_id` AND (size > 0 with age > 5 min, OR age > 30 min). The 30-min orphan gate catches parentless empty sessions that the original `size > 0` guard would have missed (e.g. orphaned api/cli/telegram sessions whose gateway never wrote `end_reason`).

Both paths share a 5-min boot safety window: a session that started in the last 5 minutes is never closed, even if its parent is long gone.

## UI

- **Compose:** right-side Sheet (`MissionCreateForm`) with category combobox and prompt preview.
- **View:** inline `MissionEditorPanel` on the mission board (no sheet scroll).
