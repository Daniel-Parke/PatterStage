// ═══════════════════════════════════════════════════════════════
// POST /api/missions/[id]/dispatch — run a mission via the agent runtime
//
// Replaces the old action-field god-route dispatch path. Submits the mission
// as an HTTP run (no bash, no status files); RunSync reconciles completion.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound, serverError } from "@/lib/api-response";
import { getMission } from "@/lib/missions/mission-repository";
import { dispatchMissionRun } from "@/lib/orchestration";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await ctx.params;
  try {
    if (!getMission(id)) return notFound("Mission not found");
    const result = await dispatchMissionRun(id);
    if (!result.ok) return serverError(result.error ?? "Dispatch failed");
    return ok({
      runId: result.runId,
      backendRunId: result.backendRunId,
      sessionId: result.sessionId,
    });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/missions/[id]/dispatch",
      `id=${id}`,
      error,
      "Failed to dispatch mission",
    );
  }
}
