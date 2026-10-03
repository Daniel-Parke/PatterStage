// ═══════════════════════════════════════════════════════════════
// /api/chat/[id] — one conversation.
//   GET    → { conversation, messages }  (self-heals stuck assistant turns)
//   DELETE → remove the conversation (+ cascade messages)
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";

import { ok, notFound } from "@/lib/api/api-response";
import { getConversation, deleteConversation } from "@/lib/chat/chat-repository";
import { reconcilePendingChatMessages } from "@/lib/orchestration/chat-dispatch";
import { route } from "@/lib/api/api-route";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route("GET /api/chat/[id]", (p) => p.id, "Failed to load conversation", async (_request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const conversation = getConversation(id);
  if (!conversation) return notFound("Conversation not found");
  // Fold any terminal-but-unfinalized runs onto their messages (client may
  // have disconnected mid-stream) before returning the history.
  const messages = reconcilePendingChatMessages(id);
  return ok({ conversation, messages });
});

export const DELETE = route("DELETE /api/chat/[id]", (p) => p.id, "Failed to delete conversation", async (request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const deleted = deleteConversation(id);
  if (!deleted) return notFound("Conversation not found");
  return ok({ id, deleted: true });
});
