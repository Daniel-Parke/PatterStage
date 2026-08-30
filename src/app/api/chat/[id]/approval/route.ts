// ═══════════════════════════════════════════════════════════════
// POST /api/chat/[id]/approval — resolve a tool-use approval (HITL).
// Body: { runId, approved, note? }. Maps the PatterStage run id to the
// backend run id and forwards the decision to runtime.resolveApproval —
// the agent then either runs or skips the gated tool.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest, notFound } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { getConversation } from "@/lib/chat-repository";
import { getRun } from "@/lib/runs-repository";
import { runtime } from "@/lib/runtime";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getConversation(id)) return notFound("Conversation not found");

  const body = await parseJsonBody(request);
  if (body instanceof NextResponse) return body;
  const { runId, approved, note } = body as {
    runId?: unknown;
    approved?: unknown;
    note?: unknown;
  };
  if (typeof runId !== "string" || !runId) return badRequest("runId is required");
  if (typeof approved !== "boolean") return badRequest("approved (boolean) is required");

  const run = getRun(runId);
  if (!run || !run.runId) return notFound("Run not found");

  try {
    await runtime.resolveApproval(
      run.runId,
      { approved, note: typeof note === "string" ? note : undefined },
      run.profileName ?? undefined,
    );
    return ok({ runId, approved });
  } catch (error) {
    return serverErrorFromCatch("POST /api/chat/[id]/approval", id, error, "Failed to resolve approval");
  }
}
