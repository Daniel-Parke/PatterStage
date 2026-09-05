// ═══════════════════════════════════════════════════════════════
// orchestration/chat-dispatch.ts — turn a chat message into an agent run
//
// The chat analogue of dispatch.ts (dispatchMissionRun). A user message becomes
// an HTTP run via runtime.submitRun(), threaded onto the conversation's Hermes
// session for memory continuity. The assistant turn is pre-inserted as a
// `pending` row linked to the PatterStage run id, so the live run-event stream
// (/api/runs/[id]/events) and the background RunSync reconcile can both resolve
// it. Mirrors the createRun → submitRun → attachBackendRun → recordEvent pattern.
// ═══════════════════════════════════════════════════════════════

import { createRun, attachBackendRun, updateRun, getRun } from "@/lib/runs-repository";
import {
  getConversation,
  createMessage,
  updateMessage,
  updateConversation,
  getMessages,
  type ChatMessage,
  type ChatMessageStatus,
} from "@/lib/chat-repository";
import { runtime } from "@/lib/runtime";
import { uuid } from "@/lib/db";
import type { RunStatus } from "@/lib/runtime/types";
import { messageFromError } from "@/lib/api-fetch";
import { logApiError } from "@/lib/api-logger";
import { recordEvent } from "@/lib/analytics/record-event";

export interface ChatTurnResult {
  ok: boolean;
  /** PatterStage-owned run id (the Idempotency-Key; also the SSE stream id). */
  runId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  error?: string;
}

/** Map a terminal run status onto the chat-message status vocabulary. */
function messageStatusForRun(status: RunStatus): ChatMessageStatus {
  if (status === "completed") return "complete";
  if (status === "cancelled") return "cancelled";
  return "failed";
}

/**
 * Submit one user turn as an agent run. Persists the user message, pre-inserts a
 * `pending` assistant message bound to the run, submits to the runtime, and
 * promotes the assistant message to `streaming`. On submit failure both the run
 * and the assistant message are marked failed (never left as a stuck placeholder).
 */
export async function dispatchChatTurn(
  conversationId: string,
  text: string,
): Promise<ChatTurnResult> {
  const conversation = getConversation(conversationId);
  if (!conversation) return { ok: false, error: "conversation not found" };

  const userMessage = createMessage({
    conversationId,
    role: "user",
    content: text,
    status: "complete",
  });

  // Pre-insert the assistant placeholder, bound to the CH run id up front so the
  // client can open the SSE stream immediately and reconcile can find it later.
  const runId = uuid();
  const assistantMessage = createMessage({
    conversationId,
    role: "assistant",
    content: "",
    runId,
    status: "pending",
  });

  createRun({ id: runId, profileName: conversation.profileName });

  try {
    const handle = await runtime.submitRun({
      input: text,
      idempotencyKey: runId,
      profileName: conversation.profileName ?? undefined,
      sessionId: conversation.sessionId ?? undefined,
      previousResponseId: conversation.previousResponseId ?? undefined,
    });
    const resolvedSession = handle.sessionId ?? conversation.sessionId ?? null;
    attachBackendRun(runId, {
      runId: handle.runId,
      sessionId: resolvedSession,
      status: handle.status,
    });
    if (resolvedSession && resolvedSession !== conversation.sessionId) {
      updateConversation(conversationId, { sessionId: resolvedSession });
    }
    updateMessage(assistantMessage.id, { status: "streaming" });
    recordEvent("chat.message_sent", {
      entityType: "chat",
      entityId: conversationId,
      profile: conversation.profileName ?? null,
      metadata: { model: conversation.model ?? undefined },
    });
    return {
      ok: true,
      runId,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
    };
  } catch (err) {
    const message = messageFromError(err, "chat submit failed");
    logApiError("orchestration.dispatchChatTurn", conversationId, err);
    updateRun(runId, { status: "failed", error: message });
    updateMessage(assistantMessage.id, { status: "failed", error: message });
    return {
      ok: false,
      runId,
      error: message,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
    };
  }
}

/**
 * Append a turn for the "Fast (raw model)" mode: persist the user message and a
 * `streaming` assistant placeholder WITHOUT submitting an agent run. The client
 * streams the reply from the raw gateway (/api/orchestration/chat) and finalizes
 * the placeholder via PATCH. No tools, no run row — just a model completion that
 * still lands in the conversation's history.
 */
export function appendFastTurn(
  conversationId: string,
  text: string,
): ChatTurnResult {
  const conversation = getConversation(conversationId);
  if (!conversation) return { ok: false, error: "conversation not found" };

  const userMessage = createMessage({
    conversationId,
    role: "user",
    content: text,
    status: "complete",
  });
  const assistantMessage = createMessage({
    conversationId,
    role: "assistant",
    content: "",
    status: "streaming",
  });
  recordEvent("chat.message_sent", {
    entityType: "chat",
    entityId: conversationId,
    profile: conversation.profileName ?? null,
    metadata: { model: conversation.model ?? undefined, mode: "fast" },
  });
  return {
    ok: true,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
  };
}

/**
 * Self-heal: finalize any assistant messages still `pending`/`streaming` whose
 * underlying run has reached a terminal state (e.g. the client disconnected
 * mid-stream). The background RunSync writes the run's output/usage onto the run
 * row; here we copy that onto the message so a reload shows the final answer.
 * Returns the reconciled message list (callers pass it straight to the client).
 */
export function reconcilePendingChatMessages(conversationId: string): ChatMessage[] {
  const messages = getMessages(conversationId);
  let changed = false;
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    if (m.status !== "pending" && m.status !== "streaming") continue;
    if (!m.runId) continue;
    const run = getRun(m.runId);
    if (!run) continue;
    if (run.status === "started") continue; // still in flight
    // Terminal run — fold its result onto the message. Prefer the run output;
    // keep any streamed content the client already persisted if the run output
    // is empty (e.g. an early failure after partial deltas).
    const content = run.output && run.output.length > 0 ? run.output : m.content;
    const status = messageStatusForRun(run.status);
    updateMessage(m.id, {
      content,
      status,
      // `undefined` means "leave unchanged" in updateMessage, so a FAILED run
      // carrying no error of its own used to leave the message's error column
      // exactly as it was: null. The row then read "failed" with no reason
      // anywhere, which is the symptom a QA pass reported (T-0052). A failure
      // always says something; a success clears whatever a previous attempt
      // left behind.
      error:
        status === "failed"
          ? (run.error ?? "The run failed without reporting a reason.")
          : null,
    });
    changed = true;
  }
  return changed ? getMessages(conversationId) : messages;
}
