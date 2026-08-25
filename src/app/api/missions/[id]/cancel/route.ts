// ═══════════════════════════════════════════════════════════════
// POST /api/missions/[id]/cancel — stop a running mission via the runtime
//
// Replaces SIGTERM/SIGKILL/pkill process-group killing with an HTTP
// runtime.stopRun(). Local run/mission/session state is always finalised.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { requireNotReadOnly } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound, serverError } from "@/lib/api-response";
import { getMission } from "@/lib/missions/mission-repository";
import { cancelMissionRun } from "@/lib/orchestration";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, ctx: Ctx) {
  // Read-only mode. NOT authentication: src/proxy.ts authenticates every
  // request before a handler runs, and design-lint forbids a per-route auth
  // check. The proxy also refuses unsafe METHODS under PS_READ_ONLY, so this
  // is defence in depth on a write, spelled with the name that says what it
  // does (T-0034).
  const readOnly = requireNotReadOnly("mission runs cannot be cancelled");
  if (readOnly) return readOnly;

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
