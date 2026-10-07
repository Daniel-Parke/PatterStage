// ═══════════════════════════════════════════════════════════════
// /api/schedules/[id] — get / update / delete one schedule
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ok, notFound, badRequest } from "@/lib/api/api-response";
import { parseAndValidateJsonBody } from "@/lib/api/parse-json-body";
import { getSchedule, updateSchedule, deleteSchedule } from "@/lib/schedule/schedules-repository";
import { computeNextRun } from "@/lib/schedule/next-run";
import { scheduleProblem } from "@/lib/schedule/schedule-problem";
import { route, type RouteContext } from "@/lib/api/api-route";

type Ctx = RouteContext<{ id: string }>;

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

export const GET = route("GET /api/schedules/[id]", (p) => `id=${p.id}`, "Failed to load schedule", async (_request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const schedule = getSchedule(id);
  if (!schedule) return notFound("Schedule not found");
  return ok({ schedule });
});

export const PATCH = route("PATCH /api/schedules/[id]", (p) => `id=${p.id}`, "Failed to update schedule", async (request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const parsed = await parseAndValidateJsonBody(request, schedulePatchSchema);
  if (parsed instanceof NextResponse) return parsed;
  if (!getSchedule(id)) return notFound("Schedule not found");

  // Recompute next_run_at when the schedule expression changes.
  let nextRunAt: string | null | undefined;
  if (parsed.schedule !== undefined) {
    const problem = scheduleProblem(parsed.schedule);
    if (problem) return badRequest(problem);
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
});

export const DELETE = route("DELETE /api/schedules/[id]", (p) => `id=${p.id}`, "Failed to delete schedule", async (request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const deleted = deleteSchedule(id);
  if (!deleted) return notFound("Schedule not found");
  return ok({ deleted: true });
});
