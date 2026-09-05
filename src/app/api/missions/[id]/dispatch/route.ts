// ═══════════════════════════════════════════════════════════════
// POST /api/missions/[id]/dispatch — run a mission via the agent runtime
//
// Replaces the old action-field god-route dispatch path. Submits the mission
// as an HTTP run (no bash, no status files); RunSync reconciles completion.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { requireNotReadOnly } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound, serverError } from "@/lib/api-response";
import { getMission } from "@/lib/missions/mission-repository";
import { dispatchMissionRun } from "@/lib/orchestration";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, ctx: Ctx) {
  // Read-only mode. NOT authentication: src/proxy.ts authenticates every
  // request before a handler runs, and design-lint forbids a per-route auth
  // check. The proxy also refuses unsafe METHODS under PS_READ_ONLY, so this
  // is defence in depth on a write, spelled with the name that says what it
  // does (T-0034).
  const readOnly = requireNotReadOnly("missions cannot be dispatched");
  if (readOnly) return readOnly;

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
