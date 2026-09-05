// ═══════════════════════════════════════════════════════════════
// POST /api/chat/[id]/messages — send a user turn → agent run.
// Body: { content }. Persists the user message, submits a run over the
// conversation's Hermes session (dispatchChatTurn), and returns the
// PatterStage runId — the client opens GET /api/runs/[runId]/events to
// stream the reply live.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest, notFound, serviceUnavailable, methodNotAllowed } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { getConversation } from "@/lib/chat-repository";
import { dispatchChatTurn, appendFastTurn } from "@/lib/orchestration/chat-dispatch";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
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
      // The user message + a failed assistant placeholder ARE persisted on this
      // branch, so the ids go out with the error. The comment here used to say
      // exactly that while `serviceUnavailable(error)` dropped them on the
      // floor, which left the client rendering the failure on its own optimistic
      // stand-in rather than on the rows the server actually wrote.
      //
      // Custom 503 body (error + the persisted ids) kept inline, in the manner
      // of mission-categories/route.ts, because no factory covers 503 with an
      // extended body shape.
      return NextResponse.json(
        {
          error: result.error ?? "Failed to submit chat turn",
          runId: result.runId,
          userMessageId: result.userMessageId,
          assistantMessageId: result.assistantMessageId,
        },
        { status: 503 },
      );
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

// GET is not supported. Messages arrive with the conversation from
// /api/chat/[id]; this route only appends.
export async function GET() {
  return methodNotAllowed(
    "GET is not supported here — messages come back with GET /api/chat/[id]", ["POST"]);
}
