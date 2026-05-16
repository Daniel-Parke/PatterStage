# Mission ↔ Cron Job Integration Plan

**Author:** Bob  
**Date:** 2026-05-16  
**Status:** Awaiting Implementation  

## 1. Problem Summary

When a user creates a mission with `dispatchMode: "cron"` and a schedule (e.g. `"every 30m"`), the current code:

1. **Stores `schedule` on the mission record** in SQLite — ✅ this works
2. **Dispatches the mission once** via `hermes chat` — but never creates a Hermes cron job
3. **Never writes to `cron_jobs` table** — the SQLite table remains empty
4. **Never pushes to `~/.hermes/cron/jobs.json`** — Hermes never sees the job

**Result:** The mission runs exactly once. The schedule is decorative.

## 2. Evidence Found

| Location | Detail |
|---|---|
| `src/app/orchestration/missions/page.tsx` | Frontend already has `"save" \| "now" \| "cron"` dispatch modes (line 337). Sends `schedule` when `dispatchMode === "cron"` (line 601). |
| `src/components/ui/IntervalSelector.tsx` | Exists, offers `every N` presets (line 15-30). Only interval-style scheduling. |
| `src/app/api/missions/route.ts` | Dispatch action stores schedule on mission record but never calls cron API (lines 126-210). |
| `src/app/api/cron/route.ts` | Full cron CRUD exists — `createCronJob`, `pushJobToHermes`, sync — but missions never call it. |
| `src/lib/cron-repository.ts` | `createCronJob()`, `pushJobToHermes()`, `syncAllJobsToHermes()` all implemented. |
| `src/lib/db/migrations/008_cron_jobs.sql` | `cron_jobs` table has `hermes_job_id`, `schedule`, `repeat_json`, `source` — but no `mission_id` column. |
| `src/lib/schema/mission-v1.ts` | Schema already has `cronJobId?: string` and `cronJob?: { state, enabled, ... }` — ready for linking. |
| `~/.hermes/hermes-agent/cron/jobs.py` | `compute_next_run()` treats `interval` schedules as `last_run_at + interval` and `cron` schedules via `croniter` for wall-clock alignment. |
| `~/.hermes/hermes-agent/cron/scheduler.py` | `tick()` runs every 60s via gateway. `advance_next_run()` makes it at-most-once. |
| Hermes jobs.json | Empty. No cron jobs exist. |

## 3. Scheduling Behaviour

This is the key user-facing distinction. Two different schedule formats produce different behaviour:

### Interval Scheduling (`"every 30m"`)
- Next run = `last_run_at + 30 minutes`
- **Drifts** — if a run takes 5 minutes, the next run is 35 minutes from the start
- Grace period for missed runs: half the interval (min 2min, max 2h)
- Hermes handles this in `compute_next_run()` → `interval` kind

### Cron Scheduling (`"*/30 * * * *"`)
- Next run computed by `croniter` on wall clock
- **No drift** — always at :00 and :30 regardless of run duration
- Same grace period logic applies
- Hermes handles this in `compute_next_run()` → `cron` kind

## 4. Implementation Phases

### Phase 1: DB Schema — Add `mission_id` to `cron_jobs`

**Files to create/modify:**
- `src/lib/db/migrations/014_mission_cron_link.sql` — NEW

```sql
CREATE TABLE IF NOT EXISTS _mg14_guard (x INTEGER);
DROP TABLE IF EXISTS _mg14_guard;

ALTER TABLE cron_jobs ADD COLUMN mission_id TEXT REFERENCES missions(id);
CREATE INDEX idx_cron_mission_id ON cron_jobs(mission_id) WHERE mission_id IS NOT NULL;

-- Back-fill: link existing cron jobs to missions where id matches
-- (for cron jobs already using mission_id as their hermes_job_id)
UPDATE cron_jobs SET mission_id = hermes_job_id
WHERE source = 'hermes' AND hermes_job_id IS NOT NULL;
```

**Rationale:** This links the cron job to its mission so we can:
- Show cron status in the missions detail view
- Pause/resume the cron job when a mission is cancelled/resumed
- Delete the cron job when a mission is deleted
- Find the cron job from a mission in O(1)

### Phase 2: API — Create Cron Job When Mission is Dispatched as "cron"

**Files to modify:**
- `src/app/api/missions/route.ts` — Modify dispatch action

**Logic change in `POST /api/missions` when `action === "dispatch"`:**

1. Create the mission record (already done — lines 126-140)
2. If `dispatchMode === "cron"` AND `schedule` is provided:
   a. Create a cron job via `createCronJob()` with:
      - `name`: mission name
      - `prompt`: the full built prompt (same as what gets dispatched)
      - `schedule`: the raw schedule string (e.g. `"every 30m"`)
      - `repeat`: `{ times: null, completed: 0 }` (infinite)
      - `deliver`: `"origin"` (delivers back to where the mission was created)
      - `profile_name`: the resolved profile name
      - `model` / `provider`: resolved model info
      - `source`: `"ch"`
      - `mission_id`: the mission's ID
   b. Push the job to Hermes via `pushJobToHermes()`
   c. Store the cron job ID on the mission record (`UPDATE missions SET cron_job_id = ?`)
   d. Do NOT dispatch as one-shot `hermes chat` — the cron scheduler handles it
   e. Set mission status to `"queued"` (not `"dispatched"`) — it's waiting for first tick
3. If `dispatchMode === "now"`: keep existing one-shot dispatch behaviour

**Code sketch for the cron dispatch path:**
```typescript
if (dispatchMode === "cron" && scheduleVal) {
  const cronJob = createCronJob({
    name: mission.name,
    prompt: mission.prompt,   // the full built prompt
    schedule: scheduleVal,
    repeat: { times: null, completed: 0 },  // infinite
    deliver: "origin",
    model: resolvedModel,
    provider: resolvedProvider,
    profile_name: profileName ?? "default",
    source: "ch",
    hermes_job_id: mission.id,  // reuse mission id as Hermes job id for traceability
  });
  
  // Link mission to cron job
  const db = getDb();
  db.prepare("UPDATE missions SET cron_job_id = ? WHERE id = ?").run(cronJob.id, mission.id);
  
  // Push to Hermes
  pushJobToHermes(cronJob.id);
  
  return { data: { mission: getMission(mission.id) } };
}
```

### Phase 3: API — Include Cron Job Info in Mission Response

**Files to modify:**
- `src/app/api/missions/route.ts` — GET handler

**Change:** When returning a mission (GET by ID or list), also return associated cron job info:

```typescript
// In GET handler, after fetching mission:
let cronJob = null;
if (mission.cronJobId) {
  const job = getCronJob(mission.cronJobId);
  if (job) {
    cronJob = {
      id: job.id,
      name: job.name,
      state: job.state,
      enabled: job.enabled,
      schedule: job.schedule_display,
      nextRun: job.next_run_at,
      lastRun: job.last_run_at,
      lastStatus: job.last_status,
    };
  }
}
return { data: { mission: { ...mission, cronJob } } };
```

This aligns with the `MissionV1` schema which already defines:
```typescript
cronJobId?: string;
cronJob?: {
  state: string;
  enabled: boolean;
  lastRun: string | null;
  lastStatus: string | null;
  schedule?: string;
}
```

### Phase 4: UI — Two Scheduling Modes

**Files to modify:**
- `src/app/orchestration/missions/page.tsx` — Dispatch form
- `src/components/ui/IntervalSelector.tsx` — Or replace with combined scheduler

**Change:** When `dispatchMode === "cron"`, show two scheduling options:

```
Schedule Type: [ Interval ] [ Wall Clock (cron) ]
```

**Interval mode** (default, existing behaviour):
- Current `IntervalSelector` component with `every N` presets
- Maps to schedule string like `"every 30m"`
- User sees: "Runs every 30 minutes (after completion)"

**Cron mode** (new):
- Current `CronScheduleInput` component (already exists in cron page)
- User enters a cron expression like `*/30 * * * *`
- User sees: "Runs at fixed times (e.g. :00 and :30)"

Add a visual explanation tooltip showing which mode does what:

> **Interval**: Next run is 30 minutes after the previous one finishes. Drifts over time.
> **Cron**: Runs on fixed wall-clock boundaries (e.g. :00, :30). No drift.

Also add a preview showing the computed next run time for the chosen schedule.

### Phase 5: Mission Actions — Pause/Resume/Delete Cron Job

**Files to modify:**
- `src/app/orchestration/missions/page.tsx` — handleCancel, handleDelete
- `src/app/api/missions/route.ts` — cancel, delete actions

**Cancel mission** currently sets mission status to `failed`. It should ALSO:
- Pause the linked cron job via the cron API

**Delete mission** currently soft-deletes the mission. It should ALSO:
- Delete the linked cron job from both SQLite and Hermes
- Or at minimum pause + orphan it

### Phase 6: Mission Status — Use Cron Job State

**Files to modify:**
- `src/lib/mission-helpers.ts` — `getMissionStatus()`

The `getMissionStatus()` function already maps cron job state to mission status (lines 160-190). But it reads from `CronJobData` which is the Hermes `jobs.json` format. Once missions are linked to cron jobs via the SQLite `cron_jobs` table, we should update this to:

1. First check the `cron_jobs` SQLite row for the linked job
2. If no linked cron job, fall back to file-based status check

This ensures the missions page always shows accurate status.

### Phase 7: Add `cron_job_id` Column to Missions Table

**Files to create/modify:**
- `src/lib/db/migrations/015_mission_cron_job_id.sql` — NEW

```sql
ALTER TABLE missions ADD COLUMN cron_job_id TEXT;
CREATE INDEX idx_mission_cron_job ON missions(cron_job_id) WHERE cron_job_id IS NOT NULL;
```

**Also update** `mission-repository.ts` to:
- Read/write `cron_job_id` field
- Include it in `CreateMissionInput` and row mapping

### Phase 8: Update Backend Types

**Files to modify:**
- `src/lib/agent-backend/types.ts` — `DispatchMissionInput`

Add optional `schedule` field so the backend knows when a cron job is expected.

(Alternative: since dispatch for cron mode no longer spawns `hermes chat`, this is less critical — the cron creation happens in the route handler, not the backend.)

### Phase 9: Prevent Duplicate Cron Jobs for Same Mission

When a mission is updated (editingId path), the frontend already calls the update action. We need to ensure:
- If the mission already has a linked cron job, update it (not create a new one)
- If the mission doesn't have a linked cron job but schedule changed to cron, create one
- If the cron-linked mission is updated to `save` or `now`, delete/pause the cron job

### Phase 10: Tests

**Files to create:**
- `tests/unit/mission-cron-dispatch.test.ts`
- `tests/unit/mission-cron-link.test.ts`

Cover:
- Creating a mission with cron dispatch creates a cron job
- Updating a cron-linked mission updates the cron job prompt
- Cancelling a cron-linked mission pauses the cron job
- Deleting a cron-linked mission removes the cron job
- Scheduling behaviour: interval vs cron expression
- Mission status reflects cron job state

## 5. File Change Summary

| File | Action | Reason |
|---|---|---|
| `src/lib/db/migrations/014_mission_cron_link.sql` | CREATE | Add `cron_job_id` to `missions`, add `mission_id` to `cron_jobs` |
| `src/app/api/missions/route.ts` | MODIFY | Create cron job on cron dispatch; include cron info in GET |
| `src/lib/mission-repository.ts` | MODIFY | Read/write `cron_job_id` |
| `src/lib/cron-repository.ts` | MODIFY | Add `createOrUpdateMissionCron()` helper |
| `src/lib/mission-helpers.ts` | MODIFY | Use SQLite cron job, not filesystem |
| `src/app/orchestration/missions/page.tsx` | MODIFY | Add interval/cron toggle UI; fix cancel/delete |
| `src/components/ui/IntervalSelector.tsx` | MODIFY | Rename/clarify; add cron expression option |
| `src/lib/agent-backend/types.ts` | MODIFY | (Optionally) add schedule to DispatchMissionInput |
| `tests/unit/mission-cron-dispatch.test.ts` | CREATE | Integration tests |
| `docs/PLAN-cron-mission-dispatch.md` | CREATE | This document |

## 6. Risk Assessment

| Risk | Mitigation |
|---|---|
| **Existing missions** with `schedule` set but no cron job will remain static — they already ran once. | Acceptable. Post-migration cleanup optional. |
| **Race condition** if cron scheduler fires a job before the mission dispatch response reaches the user. | Cron scheduler ticks every 60s. Mission dispatch creates the job with `next_run_at` set to `now + interval`. The first run won't be immediate. |
| **Hermes jobs.json** could get out of sync with SQLite. | Cron sync button already exists. The `syncCronWithHermes()` function handles bidirectional sync. |
| **Duplicate cron jobs** for same mission if update path is hit. | Phase 9 handles this — check for existing linked cron job before creating. |
| **Profile/auth bootstrap** must work for cron runs too. | Cron jobs already use `profile_name` and Hermes handles auth resolution at run time via config.yaml and auth.json. |

## 7. Future Considerations

- **Delivery targeting**: Cron jobs created from missions should deliver to the `"origin"` (the Control Hub / the user who created it). The Hermes cron scheduler supports this via the `deliver` field.
- **Logging**: Cron job output is saved to `~/.hermes/cron/output/{job_id}/`. We could add a link from the mission detail view to these logs.
- **Manual run**: The "Run Now" button on the cron page already works. We should also surface it on linked missions.
- **One-shot cron**: A mission with `schedule` but no repeat could be a "one-shot at a specific time" which the cron system already supports.
- **Mission-sourced cron editing**: Editing a mission with a linked cron job should be able to update schedule/prompt through the missions form, which the frontend's `handleCreate` already handles when `editingId` is set.

## 8. Scheduling Summary (for user documentation)

```
┌────────────────────────────────────────────────────────────────────┐
│                    Agent Cron Scheduling                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. INTERVAL SCHEDULING (default)                                  │
│     Format: "every 5m", "every 30m", "every 2h"                   │
│     Behaviour: Runs X minutes AFTER the previous run completes.    │
│     Use when: You want fixed gaps between runs, regardless of      │
│               how long each run takes.                             │
│                                                                    │
│  2. WALL CLOCK SCHEDULING (cron expression)                        │
│     Format: "*/5 * * * *", "30 */2 * * *", "0 9 * * 1-5"         │
│     Behaviour: Runs at fixed clock times regardless of duration.   │
│     Use when: You need runs at :00, :30, daily at 9am, etc.       │
│                                                                    │
│  BOTH types create a Hermes cron job. The difference is in how     │
│  the next run time is calculated:                                  │
│    - Interval: next_run = last_run_at + N minutes                  │
│    - Cron:     next_run = croniter.next_match()                    │
│                                                                    │
│  Hardware Cron (legacy systemd/crontab) is separate from Agent     │
│  Cron and uses the OS's own scheduler. See Hardware tab.           │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```
