// ═══════════════════════════════════════════════════════════════
// /api/schedules/[id] — get / update / delete one schedule
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ok, notFound, badRequest } from "@/lib/api/api-response";
import { parseAndValidateJsonBody } from "@/lib/api/parse-json-body";
import { getSchedule, updateSchedule, deleteSchedule } from "@/lib/schedule/schedules-repository";
import { parseSchedule } from "@/lib/schedule/parse-schedule";
import { computeNextRun, scheduleCanEverFire } from "@/lib/schedule/next-run";
import { scheduleIntervalProblem } from "@/lib/schedule/interval-bounds";
import { route } from "@/lib/api/api-route";

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
    if (parseSchedule(parsed.schedule).kind === "invalid") {
      return badRequest(`Unrecognized schedule: ${parsed.schedule}`);
    }
    // Shape is not satisfiability -- see the note in
    // src/app/api/schedules/route.ts. `0 0 30 2 *` parses cleanly and can
    // never fire (T-0079).
    if (!scheduleCanEverFire(parsed.schedule)) {
      return badRequest(
        `Schedule "${parsed.schedule}" can never fire: it names a date that does not ` +
          `exist, or a field outside its range. Check the day-of-month against the month.`,
      );
    }
    // How often, as well as whether. See the note in
    // src/app/api/schedules/route.ts: `every 0m` is due again the instant it
    // fires, so it dispatched a paid agent run on every tick.
    const tooFrequent = scheduleIntervalProblem(parsed.schedule);
    if (tooFrequent) return badRequest(tooFrequent);
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
