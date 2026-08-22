// ═══════════════════════════════════════════════════════════════
// chat-local-message — optimistic message rows and the click guard
// ═══════════════════════════════════════════════════════════════
//
// Split out of useChatPage (Phase 4 god-file decomposition). A turn is
// rendered optimistically before the server has assigned ids: the user
// row and the assistant placeholder are built here, given a local id,
// and swapped for the server-assigned ids once POST returns.
//
// Module-level, not hook-level: `localSeq` is a process-wide counter, so
// two conversations open at once cannot mint the same local id.

import type { MouseEvent } from "react";

import type { ChatMessage } from "@/types/chat";

/** A row action inside a clickable conversation row must not also select it. */
export const stopEvent = (e?: MouseEvent) => e?.stopPropagation();

export interface PendingApproval {
  runId: string;
  toolName: string;
}

let localSeq = 0;

function localId(): string {
  return `local_${Date.now()}_${localSeq++}`;
}

export function localMessage(
  conversationId: string,
  role: ChatMessage["role"],
  content: string,
  status: ChatMessage["status"],
): ChatMessage {
  const ts = new Date().toISOString();
  return {
    id: localId(),
    conversationId,
    role,
    content,
    reasoning: null,
    toolCalls: null,
    runId: null,
    status,
    error: null,
    createdAt: ts,
    updatedAt: ts,
  };
}
