// ═══════════════════════════════════════════════════════════════
// useChatPage — stateful core of the server-persisted agent chat.
//
// Conversations live on the server (chat-repository). A turn is sent via
// POST /api/chat/[id]/messages; in "agent" mode the reply streams from the
// run-event SSE (/api/runs/[runId]/events) — rendering deltas, reasoning,
// tool cards, and HITL approvals — and is finalized via PATCH. "Fast" mode
// streams a raw model reply from the gateway. An assistant turn is never left
// as a stuck "Thinking…" placeholder: empty/aborted/failed runs resolve to an
// explicit terminal status.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { CHAT_DEFAULT_MODEL, CHAT_DEFAULT_MODE } from "@/types/chat";
import type { ChatConversation, ChatMessage, ChatMode, ToolCall } from "@/types/chat";
import {
  fetchConversations,
  fetchConversation,
  createConversationApi,
  deleteConversationApi,
  sendMessageApi,
  finalizeMessageApi,
  stopRunApi,
  resolveApprovalApi,
  toApiMessages,
  streamChatResponse,
  openRunEventStream,
  classifyRunEvent,
  extractDelta,
  extractReasoning,
  extractCompletedOutput,
  extractRunError,
  parseToolEvent,
  mergeToolCall,
  conversationToJson,
  conversationToCsv,
  sanitiseFilename,
  downloadFile,
  COPY_BTN_CLASS,
  COPY_BTN_DATA_ATTR,
} from "@/lib/chat-utils";
import { useGatewayHealth } from "@/hooks/useGatewayHealth";

const stopEvent = (e?: React.MouseEvent) => e?.stopPropagation();

let localSeq = 0;
function localId(): string {
  return `local_${Date.now()}_${localSeq++}`;
}
function localMessage(
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

interface PendingApproval {
  runId: string;
  toolName: string;
}

export function useChatPage() {
  const { showToast, toastElement } = useToast();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [mode, setMode] = useState<ChatMode>(CHAT_DEFAULT_MODE);
  const [model, setModel] = useState(CHAT_DEFAULT_MODEL);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamGenRef = useRef(0);

  const {
    online: gatewayOnline,
    authConfigured: gatewayAuthConfigured,
    agentDefaultModelSet,
    registryModelIds,
    modelLabels,
    modelsError,
    modelsLoading,
  } = useGatewayHealth();

  // ── Local message helpers ───────────────────────────────────
  const updateLocalMessage = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    },
    [],
  );

  const closeStream = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // ── Load conversations on mount ─────────────────────────────
  const loadConversations = useCallback(async () => {
    const list = await fetchConversations();
    setConversations(list);
    return list;
  }, []);

  useEffect(() => {
    void (async () => {
      const list = await loadConversations();
      if (list.length > 0) setActiveId(list[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load the active conversation's messages when it changes ──
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const loaded = await fetchConversation(activeId);
      if (cancelled || !loaded) return;
      setMessages(loaded.messages);
      setModel(loaded.conversation.model || CHAT_DEFAULT_MODEL);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // Auto-scroll on new/updated messages.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup any live stream on unmount.
  useEffect(() => closeStream, [closeStream]);

  const refreshActiveConversation = useCallback(async () => {
    if (!activeId) return;
    const loaded = await fetchConversation(activeId);
    if (loaded) setMessages(loaded.messages);
  }, [activeId]);

  // ── New conversation ────────────────────────────────────────
  const handleNewChat = useCallback(async () => {
    closeStream();
    const conversation = await createConversationApi({ title: "New Chat", model });
    if (!conversation) {
      showToast("Failed to start a new conversation", "error");
      return;
    }
    setConversations((prev) => [conversation, ...prev]);
    setActiveId(conversation.id);
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  }, [closeStream, model, showToast]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      if (id === activeId) return;
      closeStream();
      setIsStreaming(false);
      setPendingApproval(null);
      setActiveId(id);
    },
    [activeId, closeStream],
  );

  // ── Delete conversation ─────────────────────────────────────
  const handleDeleteConversation = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      stopEvent(e);
      if (id === activeId) closeStream();
      const { ok, error } = await deleteConversationApi(id);
      if (!ok) {
        showToast(error || "Failed to delete conversation", "error");
        return;
      }
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        if (id === activeId) setActiveId(remaining.length > 0 ? remaining[0].id : null);
        return remaining;
      });
      showToast("Conversation deleted", "success");
    },
    [activeId, closeStream, showToast],
  );

  // ── Download conversation ───────────────────────────────────
  const handleDownloadConversation = useCallback(
    (conversation: ChatConversation, format: "json" | "csv", e?: React.MouseEvent) => {
      stopEvent(e);
      const safeTitle = sanitiseFilename(conversation.title);
      const ts = Date.now();
      if (format === "json") {
        downloadFile(conversationToJson(conversation, messages), `${safeTitle}_${ts}.json`, "application/json");
        showToast("Conversation exported as JSON", "success");
      } else {
        downloadFile(conversationToCsv(messages), `${safeTitle}_${ts}.csv`, "text/csv");
        showToast("Conversation exported as CSV", "success");
      }
    },
    [messages, showToast],
  );

  // ── Stream an agent run's events into the assistant message ──
  const streamAgentRun = useCallback(
    (conversationId: string, runId: string, assistantId: string, gen: number) => {
      const acc = { content: "", reasoning: "", tools: [] as ToolCall[] };
      let finalized = false;

      const finalize = (
        status: ChatMessage["status"],
        content: string,
        error?: string,
      ) => {
        if (finalized || gen !== streamGenRef.current) return;
        finalized = true;
        esRef.current?.close();
        esRef.current = null;
        updateLocalMessage(assistantId, {
          content,
          status,
          error: error ?? null,
          reasoning: acc.reasoning || null,
          toolCalls: acc.tools.length > 0 ? acc.tools : null,
        });
        setIsStreaming(false);
        setPendingApproval(null);
        void finalizeMessageApi(conversationId, assistantId, {
          content,
          reasoning: acc.reasoning || undefined,
          toolCalls: acc.tools.length > 0 ? acc.tools : undefined,
          status,
          error: error ?? undefined,
        });
        void loadConversations();
      };

      const es = openRunEventStream(runId, (type, data) => {
        if (gen !== streamGenRef.current) return;
        switch (classifyRunEvent(type)) {
          case "delta": {
            const d = extractDelta(data);
            if (d) {
              acc.content += d;
              updateLocalMessage(assistantId, { content: acc.content, status: "streaming" });
            }
            break;
          }
          case "reasoning": {
            const r = extractReasoning(data);
            if (r) {
              acc.reasoning += r;
              updateLocalMessage(assistantId, { reasoning: acc.reasoning });
            }
            break;
          }
          case "tool": {
            const tc = parseToolEvent(type, data);
            acc.tools = mergeToolCall(acc.tools, tc);
            updateLocalMessage(assistantId, { toolCalls: [...acc.tools] });
            if (tc.status === "approval_required") {
              setPendingApproval({ runId, toolName: tc.name });
            }
            break;
          }
          case "completed":
            finalize("complete", acc.content || extractCompletedOutput(data));
            break;
          case "failed":
            finalize("failed", acc.content, extractRunError(data));
            break;
          case "cancelled":
            finalize("cancelled", acc.content || "");
            break;
          case "done":
            finalize("complete", acc.content);
            break;
          default:
            break;
        }
      });
      esRef.current = es;
      es.onerror = () => {
        if (finalized || gen !== streamGenRef.current) return;
        // The proxy closes the socket after "done"; if we haven't finalized, the
        // run may still be completing — reconcile from the server (it self-heals
        // the message from the run row) rather than guessing a failure.
        es.close();
        esRef.current = null;
        setIsStreaming(false);
        finalized = true;
        window.setTimeout(() => {
          if (gen === streamGenRef.current) void refreshActiveConversation();
        }, 1500);
      };
    },
    [updateLocalMessage, loadConversations, refreshActiveConversation],
  );

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
      updateLocalMessage(assistantMessageId, {
        content: acc.content,
        status,
        error: acc.content ? null : "No response",
      });
      setIsStreaming(false);
      abortRef.current = null;
      void finalizeMessageApi(conversationId, assistantMessageId, { content: acc.content, status });
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
  }, [activeId, closeStream, refreshActiveConversation]);

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
    [activeId, pendingApproval, showToast],
  );

  // ── Keyboard ────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  const handleModelChange = useCallback((next: string) => setModel(next), []);
  const handleModeChange = useCallback((next: ChatMode) => setMode(next), []);

  // ── Copy-code-block delegation (renderMarkdown injects the buttons) ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains(COPY_BTN_CLASS)) {
        const code = target.getAttribute(COPY_BTN_DATA_ATTR) || "";
        void navigator.clipboard.writeText(code).then(() => showToast("Code copied", "success"));
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showToast]);

  const activeConversation = conversations.find((c) => c.id === activeId);
  const hasActiveConversation = activeConversation !== undefined;

  return {
    toastElement,
    // model dropdown
    model,
    handleModelChange,
    registryModelIds,
    modelLabels,
    modelsLoading,
    modelsError,
    // mode toggle
    mode,
    handleModeChange,
    // conversations
    conversations,
    activeConversation,
    activeId,
    hasActiveConversation,
    handleSelectConversation,
    handleNewChat,
    handleDeleteConversation,
    handleDownloadConversation,
    // gateway banners
    gatewayOnline,
    gatewayAuthConfigured,
    agentDefaultModelSet,
    // messages + streaming
    messages,
    isStreaming,
    pendingApproval,
    handleApproval,
    messagesEndRef,
    inputRef,
    input,
    setInput,
    handleKeyDown,
    handleSend,
    handleStop,
  };
}
