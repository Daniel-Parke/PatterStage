// ═══════════════════════════════════════════════════════════════
// /api/schedules/[id] — get / update / delete one schedule
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound, badRequest } from "@/lib/api-response";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { getSchedule, updateSchedule, deleteSchedule } from "@/lib/schedules-repository";
import { parseSchedule } from "@/lib/schedule/parse-schedule";
import { computeNextRun } from "@/lib/schedule/next-run";

interface Ctx {
  params: Promise<{ id: string }>;
}

const schedulePatchSchema = z
  .object({
    name: z.string().optional(),
    schedule: z.string().min(1).optional(),
    scheduleDisplay: z.string().optional(),
    enabled: z.boolean().optional(),
    catchUpPolicy: z.enum(["fire_once", "skip"]).optional(),
    repeatTimes: z.number().int().positive().nullable().optional(),
    profileName: z.string().nullable().optional(),
  })
  .strict();

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const schedule = getSchedule(id);
    if (!schedule) return notFound("Schedule not found");
    return ok({ schedule });
  } catch (error) {
    return serverErrorFromCatch("GET /api/schedules/[id]", `id=${id}`, error, "Failed to load schedule");
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = await parseAndValidateJsonBody(request, schedulePatchSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    if (!getSchedule(id)) return notFound("Schedule not found");

    // Recompute next_run_at when the schedule expression changes.
    let nextRunAt: string | null | undefined;
    if (parsed.schedule !== undefined) {
      if (parseSchedule(parsed.schedule).kind === "invalid") {
        return badRequest(`Unrecognized schedule: ${parsed.schedule}`);
      }
      const next = computeNextRun(parsed.schedule, new Date());
      nextRunAt = next ? next.toISOString() : null;
    }

    const schedule = updateSchedule(id, {
      name: parsed.name,
      schedule: parsed.schedule,
      scheduleDisplay: parsed.scheduleDisplay,
      enabled: parsed.enabled,
      catchUpPolicy: parsed.catchUpPolicy,
      repeatTimes: parsed.repeatTimes,
      profileName: parsed.profileName,
      nextRunAt,
    });
    return ok({ schedule });
  } catch (error) {
    return serverErrorFromCatch("PATCH /api/schedules/[id]", `id=${id}`, error, "Failed to update schedule");
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const deleted = deleteSchedule(id);
    if (!deleted) return notFound("Schedule not found");
    return ok({ deleted: true });
  } catch (error) {
    return serverErrorFromCatch("DELETE /api/schedules/[id]", `id=${id}`, error, "Failed to delete schedule");
  }
}
