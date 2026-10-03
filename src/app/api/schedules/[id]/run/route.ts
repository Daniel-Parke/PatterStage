// ═══════════════════════════════════════════════════════════════
// POST /api/schedules/[id]/run — fire a schedule's mission immediately
// (out of band; does not advance the schedule's next_run_at).
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";

import { ok, notFound, badRequest, serverError } from "@/lib/api/api-response";
import { getSchedule, recordScheduleRun } from "@/lib/schedule/schedules-repository";
import { dispatchMissionRun } from "@/lib/orchestration";
import { route } from "@/lib/api/api-route";

interface Ctx {
  params: Promise<{ id: string }>;
}

export const POST = route("POST /api/schedules/[id]/run", (p) => `id=${p.id}`, "Failed to run schedule", async (request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const schedule = getSchedule(id);
  if (!schedule) return notFound("Schedule not found");
  if (!schedule.missionId) return badRequest("Schedule has no linked mission");
  const result = await dispatchMissionRun(schedule.missionId, { scheduleId: schedule.id });
  // Stamp last-run state on the schedule (manual run-now), mirroring the
  // scheduler tick's dispatch-time stamping. Does NOT advance next_run_at — a
  // manual run doesn't change the cadence.
  recordScheduleRun(schedule.id, {
    lastRunId: result.backendRunId ?? result.runId ?? null,
    lastRunAt: new Date().toISOString(),
    lastStatus: result.ok ? "dispatched" : `error: ${result.error ?? "unknown"}`,
  });
  if (!result.ok) return serverError(result.error ?? "Dispatch failed");
  return ok({
    runId: result.runId,
    backendRunId: result.backendRunId,
    sessionId: result.sessionId,
  });
});
