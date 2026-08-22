// ═══════════════════════════════════════════════════════════════
// POST /api/missions/[id]/cancel — stop a running mission via the runtime
//
// Replaces SIGTERM/SIGKILL/pkill process-group killing with an HTTP
// runtime.stopRun(). Local run/mission/session state is always finalised.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound, serverError } from "@/lib/api-response";
import { getMission } from "@/lib/missions/mission-repository";
import { cancelMissionRun } from "@/lib/orchestration";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await ctx.params;
  try {
    if (!getMission(id)) return notFound("Mission not found");
    const result = await cancelMissionRun(id);
    if (!result.ok) return serverError(result.error ?? "Cancel failed");
    return ok({ cancelled: true });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/missions/[id]/cancel",
      `id=${id}`,
      error,
      "Failed to cancel mission",
    );
  }
}
