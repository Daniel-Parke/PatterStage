// ═══════════════════════════════════════════════════════════════
// /api/schedules — PatterStage-owned recurring schedules
//
// The scheduler (orchestration/scheduler) fires these; PatterStage owns the
// timer (no Hermes jobs.json). GET lists, POST creates with Zod validation.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, created, badRequest } from "@/lib/api-response";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { listSchedules, createSchedule } from "@/lib/schedules-repository";
import { parseSchedule } from "@/lib/schedule/parse-schedule";
import { computeNextRun } from "@/lib/schedule/next-run";
import { recordEvent } from "@/lib/analytics/record-event";

const scheduleCreateSchema = z
  .object({
    missionId: z.string().min(1),
    name: z.string().optional(),
    schedule: z.string().min(1),
    scheduleDisplay: z.string().optional(),
    enabled: z.boolean().optional(),
    catchUpPolicy: z.enum(["fire_once", "skip"]).optional(),
    repeatTimes: z.number().int().positive().nullable().optional(),
    profileName: z.string().nullable().optional(),
  })
  .strict();

export async function GET() {
  try {
    return ok({ schedules: listSchedules() });
  } catch (error) {
    return serverErrorFromCatch("GET /api/schedules", "list", error, "Failed to list schedules");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const parsed = await parseAndValidateJsonBody(request, scheduleCreateSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    if (parseSchedule(parsed.schedule).kind === "invalid") {
      return badRequest(`Unrecognized schedule: ${parsed.schedule}`);
    }
    const next = computeNextRun(parsed.schedule, new Date());
    const schedule = createSchedule({
      missionId: parsed.missionId,
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
  } catch (error) {
    return serverErrorFromCatch("POST /api/schedules", "create", error, "Failed to create schedule");
  }
}
