// ═══════════════════════════════════════════════════════════════
// /api/chat/[id] — one conversation.
//   GET    → { conversation, messages }  (self-heals stuck assistant turns)
//   DELETE → remove the conversation (+ cascade messages)
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, notFound } from "@/lib/api-response";
import { getConversation, deleteConversation } from "@/lib/chat-repository";
import { reconcilePendingChatMessages } from "@/lib/orchestration/chat-dispatch";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const conversation = getConversation(id);
    if (!conversation) return notFound("Conversation not found");
    // Fold any terminal-but-unfinalized runs onto their messages (client may
    // have disconnected mid-stream) before returning the history.
    const messages = reconcilePendingChatMessages(id);
    return ok({ conversation, messages });
  } catch (error) {
    return serverErrorFromCatch("GET /api/chat/[id]", id, error, "Failed to load conversation");
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const deleted = deleteConversation(id);
    if (!deleted) return notFound("Conversation not found");
    return ok({ id, deleted: true });
  } catch (error) {
    return serverErrorFromCatch("DELETE /api/chat/[id]", id, error, "Failed to delete conversation");
  }
}
