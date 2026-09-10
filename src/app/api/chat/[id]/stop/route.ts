// ═══════════════════════════════════════════════════════════════
// POST /api/chat/[id]/stop — stop the conversation's in-flight run.
// Body: { runId? } (PatterStage run id; defaults to the latest active
// assistant turn). Stops the backend run over HTTP, then finalizes the
// local run + message as cancelled so the UI never shows a stuck turn.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { logApiError } from "@/lib/api/api-logger";
import { ok, notFound } from "@/lib/api/api-response";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { getConversation, getMessages, getMessageByRunId, updateMessage } from "@/lib/chat/chat-repository";
import { getRun, updateRun } from "@/lib/runs/runs-repository";
import { runtime } from "@/lib/runtime";
import { route } from "@/lib/api/api-route";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route("POST /api/chat/[id]/stop", (p) => p.id, "Failed to stop run", async (request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!getConversation(id)) return notFound("Conversation not found");

  const body = await parseJsonBody(request);
  if (body instanceof NextResponse) return body;
  let runId = (body as { runId?: unknown }).runId;

  // Default to the latest still-active assistant turn.
  if (typeof runId !== "string" || !runId) {
    const active = getMessages(id)
      .filter((m) => m.role === "assistant" && (m.status === "streaming" || m.status === "pending") && m.runId)
      .pop();
    runId = active?.runId ?? undefined;
  }
  if (typeof runId !== "string" || !runId) return ok({ stopped: false, reason: "no active run" });

  const run = getRun(runId);
  if (!run) return notFound("Run not found");
  if (run.runId) {
    try {
      await runtime.stopRun(run.runId, run.profileName ?? undefined);
    } catch (err) {
      // Best-effort on the backend — still finalize local state below.
      logApiError("POST /api/chat/[id]/stop", id, err);
    }
  }
  if (run.status === "started") {
    updateRun(run.id, { status: "cancelled", error: "Cancelled by user" });
  }
  const message = getMessageByRunId(runId);
  if (message && (message.status === "streaming" || message.status === "pending")) {
    updateMessage(message.id, { status: "cancelled" });
  }
  return ok({ stopped: true, runId });
});
