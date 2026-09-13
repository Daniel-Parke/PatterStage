// ═══════════════════════════════════════════════════════════════
// /api/schedules — PatterStage-owned recurring schedules
//
// The scheduler (orchestration/scheduler) fires these; PatterStage owns the
// timer (no Hermes jobs.json). GET lists, POST creates with Zod validation.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ok, created, badRequest } from "@/lib/api/api-response";
import { parseAndValidateJsonBody } from "@/lib/api/parse-json-body";
import { listSchedules, createSchedule } from "@/lib/schedule/schedules-repository";
import { boundsFrom, SCHEDULE_LIST_BOUNDS } from "@/lib/ui/list-bounds";
import { parseSchedule } from "@/lib/schedule/parse-schedule";
import { computeNextRun, scheduleCanEverFire } from "@/lib/schedule/next-run";
import { scheduleIntervalProblem } from "@/lib/schedule/interval-bounds";
import { recordEvent } from "@/lib/analytics/record-event";
import { route } from "@/lib/api/api-route";

const scheduleCreateSchema = z
  .object({
    // A schedule row can name a script instead of a mission (T-0107, decision
    // 10), so neither id is required by the schema; which one is required is a
    // function of `kind`, and the handler answers that below in words.
    kind: z.enum(["mission", "script"]).optional(),
    missionId: z.string().min(1).optional(),
    scriptName: z.string().min(1).optional(),
    name: z.string().optional(),
    schedule: z.string().min(1),
    scheduleDisplay: z.string().optional(),
    enabled: z.boolean().optional(),
    catchUpPolicy: z.enum(["fire_once", "skip"]).optional(),
    repeatTimes: z.number().int().positive().nullable().optional(),
    profileName: z.string().nullable().optional(),
  })
  .strict();

export const GET = route("GET /api/schedules", "list", "Failed to list schedules", async (request?: NextRequest) => {
  return ok({ schedules: listSchedules({ limit: boundsFrom(request, SCHEDULE_LIST_BOUNDS).limit }) });
});

export const POST = route("POST /api/schedules", "create", "Failed to create schedule", async (request: NextRequest) => {
  const parsed = await parseAndValidateJsonBody(request, scheduleCreateSchema);
  if (parsed instanceof NextResponse) return parsed;
  // Before the schedule-shape checks: a row with nothing to fire is refused
  // on the thing that is actually missing, not on its cron.
  const kind = parsed.kind ?? "mission";
  if (kind === "mission" && !parsed.missionId) {
    return badRequest("missionId is required for a mission schedule");
  }
  if (kind === "script" && !parsed.scriptName) {
    return badRequest("scriptName is required for a script schedule");
  }
  if (parseSchedule(parsed.schedule).kind === "invalid") {
    return badRequest(`Unrecognized schedule: ${parsed.schedule}`);
  }
  // Shape is not satisfiability. `0 0 30 2 *` is five well-formed fields
  // naming a date that never comes: it stored enabled, computed a null
  // next-run, and getDueSchedules filters `next_run_at IS NOT NULL` -- so
  // the row sat enabled forever and dead forever (T-0079).
  if (!scheduleCanEverFire(parsed.schedule)) {
    return badRequest(
      `Schedule "${parsed.schedule}" can never fire: it names a date that does not ` +
        `exist, or a field outside its range. Check the day-of-month against the month.`,
    );
  }
  // And how OFTEN is a third question. `every 0m` names a moment that is
  // always reachable: the one you are standing in. It stored happily, was due
  // again on the tick that had just fired it, and every tick of that loop
  // dispatched a real agent run at a paid provider.
  const tooFrequent = scheduleIntervalProblem(parsed.schedule);
  if (tooFrequent) return badRequest(tooFrequent);
  const next = computeNextRun(parsed.schedule, new Date());
  const schedule = createSchedule({
    kind,
    missionId: parsed.missionId ?? null,
    scriptName: parsed.scriptName ?? null,
    name: parsed.name,
    schedule: parsed.schedule,
    scheduleDisplay: parsed.scheduleDisplay ?? parsed.schedule,
    enabled: parsed.enabled,
    catchUpPolicy: parsed.catchUpPolicy,
    repeatTimes: parsed.repeatTimes ?? null,
    profileName: parsed.profileName ?? null,
    nextRunAt: next ? next.toISOString() : null,
  });
  recordEvent("schedule.created", {
    entityType: "schedule",
    entityId: schedule.id,
    profile: schedule.profileName,
  });
  return created({ schedule });
});
