// ═══════════════════════════════════════════════════════════════
// PATCH /api/chat/[id]/messages/[messageId] — finalize a streamed turn.
// The client accumulates run-event deltas in the browser and, when the
// run completes, persists the final assistant turn here (content +
// reasoning + tool calls + terminal status) so a reload shows it. The
// load path (GET /api/chat/[id]) also self-heals from the run row, so
// this is the fast path, not the only path.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest, notFound } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import {
  getMessage,
  updateMessage,
  type ChatMessageStatus,
  type ToolCallRecord,
} from "@/lib/chat-repository";

type Ctx = { params: Promise<{ id: string; messageId: string }> };

const TERMINAL: ReadonlySet<string> = new Set(["complete", "failed", "cancelled", "streaming"]);

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id, messageId } = await ctx.params;
  const existing = getMessage(messageId);
  if (!existing || existing.conversationId !== id) return notFound("Message not found");

  const body = await parseJsonBody(request);
  if (body instanceof NextResponse) return body;
  const { content, reasoning, toolCalls, status, error } = body as {
    content?: unknown;
    reasoning?: unknown;
    toolCalls?: unknown;
    status?: unknown;
    error?: unknown;
  };

  if (status !== undefined && (typeof status !== "string" || !TERMINAL.has(status))) {
    return badRequest("status must be one of: streaming, complete, failed, cancelled");
  }

  try {
    const message = updateMessage(messageId, {
      content: typeof content === "string" ? content : undefined,
      reasoning: typeof reasoning === "string" ? reasoning : undefined,
      toolCalls: Array.isArray(toolCalls) ? (toolCalls as ToolCallRecord[]) : undefined,
      status: status as ChatMessageStatus | undefined,
      error: typeof error === "string" ? error : undefined,
    });
    return ok({ message });
  } catch (err) {
    return serverErrorFromCatch("PATCH /api/chat/[id]/messages/[messageId]", messageId, err, "Failed to update message");
  }
}
