// ═══════════════════════════════════════════════════════════════
// useChatSend — sending a turn, stopping it, approving a tool
// ═══════════════════════════════════════════════════════════════
//
// Split out of useChatPage (Phase 4 god-file decomposition). Owns the
// turn lifecycle: create the conversation if there isn't one, render the
// user row and the assistant placeholder optimistically, POST the turn,
// adopt the server-assigned ids, then hand off to whichever stream the
// mode calls for — the run-event SSE in "agent" mode, a raw gateway
// stream in "fast" mode.
//
// Also owns the two effects that keep the transcript in step with the
// active conversation: loading its messages (and adopting its model)
// when the selection changes, and scrolling to the newest turn.
//
// `streamGenRef` is bumped on every send and every stop; each async
// continuation re-checks it, so a superseded turn writes nothing.

"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dispatch, KeyboardEvent, RefObject, MutableRefObject, SetStateAction } from "react";

import type { ToastType } from "@/components/ui/Toast";
import { CHAT_DEFAULT_MODEL } from "@/types/chat";
import type { ChatConversation, ChatMessage, ChatMode } from "@/types/chat";
import {
  fetchConversation,
  createConversationApi,
  sendMessageApi,
  finalizeMessageApi,
  stopRunApi,
  resolveApprovalApi,
  toApiMessages,
  streamChatResponse,
} from "@/lib/chat-utils";
import { localMessage, type PendingApproval } from "@/hooks/chat-local-message";

type ToastFn = (message: string, type?: ToastType) => void;

export interface UseChatSendArgs {
  activeId: string | null;
  setActiveId: Dispatch<SetStateAction<string | null>>;
  setConversations: Dispatch<SetStateAction<ChatConversation[]>>;
  loadConversations: () => Promise<unknown>;
  refreshActiveConversation: () => Promise<void>;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  pendingApproval: PendingApproval | null;
  setPendingApproval: Dispatch<SetStateAction<PendingApproval | null>>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  abortRef: MutableRefObject<AbortController | null>;
  streamGenRef: MutableRefObject<number>;
  updateLocalMessage: (id: string, patch: Partial<ChatMessage>) => void;
  closeStream: () => void;
  streamAgentRun: (
    conversationId: string,
    runId: string,
    assistantId: string,
    gen: number,
  ) => void;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  mode: ChatMode;
  model: string;
  setModel: Dispatch<SetStateAction<string>>;
  /** null while unknown; false is a hard "don't even try". */
  gatewayOnline: boolean | null;
  showToast: ToastFn;
}

export function useChatSend({
  activeId,
  setActiveId,
  setConversations,
  loadConversations,
  refreshActiveConversation,
  messages,
  setMessages,
  setIsStreaming,
  pendingApproval,
  setPendingApproval,
  messagesEndRef,
  abortRef,
  streamGenRef,
  updateLocalMessage,
  closeStream,
  streamAgentRun,
  input,
  setInput,
  mode,
  model,
  setModel,
  gatewayOnline,
  showToast,
}: UseChatSendArgs) {
  // The active conversation's read, when it failed. Kept apart from the
  // transcript for the same reason the list keeps `listError` apart from the
  // list (T-0096, the read contract): the effect below used to return early on
  // a failed read, which left the PREVIOUS conversation's turns on screen under
  // the newly selected title and said nothing at all (D49). Now the transcript
  // is cleared and the reason is rendered in its place.
  const [conversationError, setConversationError] = useState<string | null>(null);
  // Bumped by Retry. The read lives in an effect keyed on the active id, so
  // re-running it for the SAME id needs a second key.
  const [reloadNonce, setReloadNonce] = useState(0);

  // ── Load the active conversation's messages when it changes ──
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setConversationError(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const loaded = await fetchConversation(activeId);
      if (cancelled) return;
      if (!loaded.ok || !loaded.messages || !loaded.conversation) {
        setMessages([]); // never show another conversation's turns
        setConversationError(loaded.error ?? "Failed to load conversation");
        return;
      }
      setConversationError(null);
      setMessages(loaded.messages);
      setModel(loaded.conversation.model || CHAT_DEFAULT_MODEL);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, reloadNonce, setMessages, setModel]);

  /** Re-run the read above for the conversation that is already selected. */
  const reloadActiveConversation = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  // Auto-scroll on new/updated messages.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messagesEndRef]);

  // ── Send ────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    if (gatewayOnline === false) {
      showToast("Gateway is offline — start it with: hermes gateway start", "error");
      return;
    }

    closeStream();
    const gen = ++streamGenRef.current;

    // Ensure a conversation exists.
    let conversationId = activeId;
    if (!conversationId) {
      const conversation = await createConversationApi({ title: text.slice(0, 50), model });
      if (!conversation) {
        showToast("Failed to start a new conversation", "error");
        return;
      }
      conversationId = conversation.id;
      setConversations((prev) => [conversation, ...prev]);
      setActiveId(conversation.id);
      setMessages([]);
    }

    // Optimistic local user + assistant placeholder.
    const userMsg = localMessage(conversationId, "user", text, "complete");
    const assistantMsg = localMessage(conversationId, "assistant", "", "streaming");
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    const priorMessages = messages;
    setInput("");
    setIsStreaming(true);

    const send = await sendMessageApi(conversationId, text, mode);
    if (gen !== streamGenRef.current) return; // superseded
    if (!send.ok || !send.result) {
      updateLocalMessage(assistantMsg.id, {
        status: "failed",
        error: send.error || "Failed to send message",
      });
      setIsStreaming(false);
      showToast(send.error || "Failed to send message", "error");
      return;
    }

    // Adopt the server-assigned ids so finalize PATCH + run-events target the
    // real rows.
    const { runId, assistantMessageId, userMessageId } = send.result;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === userMsg.id) return { ...m, id: userMessageId };
        if (m.id === assistantMsg.id) return { ...m, id: assistantMessageId, runId: runId ?? null };
        return m;
      }),
    );

    if (mode === "agent" && runId) {
      streamAgentRun(conversationId, runId, assistantMessageId, gen);
    } else {
      // Fast mode — stream a raw model reply from the gateway.
      const controller = new AbortController();
      abortRef.current = controller;
      const acc = { content: "" };
      await streamChatResponse(
        toApiMessages(priorMessages, text),
        model,
        controller,
        (delta) => {
          if (gen !== streamGenRef.current) return;
          acc.content += delta;
          updateLocalMessage(assistantMessageId, { content: acc.content, status: "streaming" });
        },
        (errMsg) => showToast(errMsg, "error"),
      );
      if (gen !== streamGenRef.current) return;
      const status = acc.content ? "complete" : "failed";
      const error = acc.content
        ? null
        : "The model returned nothing. Check the gateway is reachable and the model is configured.";
      updateLocalMessage(assistantMessageId, { content: acc.content, status, error });
      setIsStreaming(false);
      abortRef.current = null;
      // `error` was omitted here, so fast mode displayed a reason it never
      // saved: the row persisted as failed with error NULL, and a reload showed
      // a failure with no explanation. Agent mode has always passed it
      // (useAgentRunStream), and both the helper and the PATCH route accept it
      // (T-0052).
      void finalizeMessageApi(conversationId, assistantMessageId, {
        content: acc.content,
        status,
        error,
      });
      void loadConversations();
    }
  }, [
    input,
    activeId,
    messages,
    mode,
    model,
    gatewayOnline,
    closeStream,
    showToast,
    updateLocalMessage,
    streamAgentRun,
    loadConversations,
    setConversations,
    setActiveId,
    setMessages,
    setInput,
    setIsStreaming,
    abortRef,
    streamGenRef,
  ]);

  // ── Stop the active run ─────────────────────────────────────
  const handleStop = useCallback(async () => {
    streamGenRef.current++; // supersede any in-flight stream callbacks
    closeStream();
    setIsStreaming(false);
    setPendingApproval(null);
    if (activeId) {
      await stopRunApi(activeId);
      await refreshActiveConversation();
    }
  }, [activeId, closeStream, refreshActiveConversation, streamGenRef, setIsStreaming, setPendingApproval]);

  // ── Resolve a tool approval (HITL) ──────────────────────────
  const handleApproval = useCallback(
    async (approved: boolean) => {
      if (!activeId || !pendingApproval) return;
      const { ok, error } = await resolveApprovalApi(activeId, pendingApproval.runId, approved);
      if (!ok) {
        showToast(error || "Failed to resolve approval", "error");
        return;
      }
      setPendingApproval(null);
      showToast(approved ? "Tool approved" : "Tool denied", "success");
    },
    [activeId, pendingApproval, showToast, setPendingApproval],
  );

  // ── Keyboard ────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  return {
    handleSend,
    handleStop,
    handleApproval,
    handleKeyDown,
    conversationError,
    reloadActiveConversation,
  };
}
