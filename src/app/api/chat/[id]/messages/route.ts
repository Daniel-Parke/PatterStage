// ═══════════════════════════════════════════════════════════════
// POST /api/chat/[id]/messages — send a user turn → agent run.
// Body: { content }. Persists the user message, submits a run over the
// conversation's Hermes session (dispatchChatTurn), and returns the
// Control Hub runId — the client opens GET /api/runs/[runId]/events to
// stream the reply live.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest, notFound, serviceUnavailable } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { getConversation } from "@/lib/chat-repository";
import { dispatchChatTurn, appendFastTurn } from "@/lib/orchestration/chat-dispatch";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await ctx.params;
  if (!getConversation(id)) return notFound("Conversation not found");

  const body = await parseJsonBody(request);
  if (body instanceof NextResponse) return body;
  const content = (body as { content?: unknown }).content;
  if (typeof content !== "string" || content.trim().length === 0) {
    return badRequest("content (non-empty string) is required");
  }
  // mode "agent" (default) submits a real agent run (tools + memory); "fast"
  // persists the turn and lets the client stream a raw-model reply.
  const mode = (body as { mode?: unknown }).mode === "fast" ? "fast" : "agent";

  try {
    if (mode === "fast") {
      const fast = appendFastTurn(id, content.trim());
      if (!fast.ok) return serviceUnavailable(fast.error ?? "Failed to append message");
      return ok({ userMessageId: fast.userMessageId, assistantMessageId: fast.assistantMessageId });
    }
    const result = await dispatchChatTurn(id, content.trim());
    if (!result.ok) {
      // The user message + a failed assistant placeholder were still persisted,
      // so surface the ids alongside the error (the client renders the failure).
      return serviceUnavailable(result.error ?? "Failed to submit chat turn");
    }
    return ok({
      runId: result.runId,
      userMessageId: result.userMessageId,
      assistantMessageId: result.assistantMessageId,
    });
  } catch (error) {
    return serverErrorFromCatch("POST /api/chat/[id]/messages", id, error, "Failed to send message");
  }
}
