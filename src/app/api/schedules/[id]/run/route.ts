// ═══════════════════════════════════════════════════════════════
// POST /api/schedules/[id]/run — fire a schedule's mission immediately
// (out of band; does not advance the schedule's next_run_at).
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound, badRequest, serverError } from "@/lib/api-response";
import { getSchedule } from "@/lib/schedules-repository";
import { dispatchMissionRun } from "@/lib/orchestration";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await ctx.params;
  try {
    const schedule = getSchedule(id);
    if (!schedule) return notFound("Schedule not found");
    if (!schedule.missionId) return badRequest("Schedule has no linked mission");
    const result = await dispatchMissionRun(schedule.missionId, { scheduleId: schedule.id });
    if (!result.ok) return serverError(result.error ?? "Dispatch failed");
    return ok({
      runId: result.runId,
      backendRunId: result.backendRunId,
      sessionId: result.sessionId,
    });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/schedules/[id]/run",
      `id=${id}`,
      error,
      "Failed to run schedule",
    );
  }
}
