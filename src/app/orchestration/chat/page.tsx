// ═══════════════════════════════════════════════════════════════
// Chat Page — Web-based Hermes agent chat interface
// ═══════════════════════════════════════════════════════════════
// Streaming LLM responses via Hermes Gateway API Server.
// Supports: localStorage session persistence, session deletion,
// streaming, markdown rendering, code block copy, model selector.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  MessageCircle, Send, Plus, X, Download,
  Bot, User, Square,
} from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { InlineSelect } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { CHAT_DEFAULT_MODEL, CHAT_MAX_SESSIONS } from "@/types/chat";
import type { ChatMessage, ChatSession } from "@/types/chat";
import {
  loadSessions,
  saveSessions,
  downloadFile,
  sessionToJson,
  sessionToCsv,
  renderMarkdown,
  formatModelName,
  createEmptySession,
  createUserMessage,
  createAssistantMessage,
  toApiMessages,
  streamChatResponse,
} from "@/lib/chat-utils";
import TypingIndicator from "@/components/chat/TypingIndicator";
import GatewayBanner from "@/components/chat/GatewayBanner";
import { useGatewayHealth } from "@/hooks/useGatewayHealth";

// ── Event helpers ──────────────────────────────────────────────

/** Stop click bubbling for inline button-on-button handlers. */
const stopEvent = (e?: React.MouseEvent) => e?.stopPropagation();

// ── Page component ─────────────────────────────────────────────

export default function ChatPage() {
  // `toastElement` is the portal-rendered toast UI — without rendering it
  // in the JSX (just below the closing `</div>` of the page body), every
  // `showToast(...)` call would be silent. Both the destructure and the
  // render are required.
  const { showToast, toastElement } = useToast();

  // Sessions — initialized from localStorage
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [model, setModel] = useState(CHAT_DEFAULT_MODEL);

  // Gateway health, models, and agent default — all in one hook
  const {
    online: gatewayOnline,
    agentDefaultModelSet,
    registryModelIds,
    modelLabels,
    gatewayModelIds,
    modelsError,
    modelsLoading,
  } = useGatewayHealth();

  // Current messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamGenRef = useRef(0);

  // ── Helpers for session state mutation ──────────────────────

  const updateSessionMessages = useCallback(
    (sessionId: string, updater: (messages: ChatMessage[]) => ChatMessage[]) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, messages: updater(s.messages), updated_at: Date.now() }
            : s,
        ),
      );
    },
    [],
  );

  // ── Load persisted sessions from localStorage on mount ─────
  useEffect(() => {
    const saved = loadSessions();
    if (saved.length > 0) {
      setSessions(saved);
      setActiveSessionId(saved[0].id);
    }
  }, []);

  // ── Persist sessions to localStorage on every change ─────────
  // The `if (sessions.length === 0) return;` guard is load-bearing: on
  // first mount the loadSessions effect above populates `sessions`
  // asynchronously (next tick), so the *very first* render of this effect
  // sees `sessions = []`. Without the guard, we'd overwrite localStorage
  // with `[]` before the load effect ran, wiping persisted data. After
  // the first save, sessions is non-empty, so the guard is a no-op and
  // every subsequent change (create/delete/rename/stream delta) is
  // persisted normally.
  useEffect(() => {
    if (sessions.length === 0) return;
    saveSessions(sessions);
  }, [sessions]);

  // ── Restore per-session model when switching sessions ────────
  // The previous dependency `[activeSessionId, activeSession]` re-fired this
  // effect on EVERY session mutation (including message updates), because
  // `activeSession` is a fresh object reference each time `sessions` changes.
  // The effect is a no-op when the model is unchanged, but the call itself
  // still ran setModel() on every streamed delta. Narrowing the dependency
  // to the actual field we read (the model) keeps the call to once per
  // session switch + once per explicit model change.
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeSessionModel = activeSession?.model;
  const messages = useMemo(() => activeSession?.messages ?? [], [activeSession]);
  useEffect(() => {
    if (activeSessionModel !== undefined) {
      setModel(activeSessionModel || CHAT_DEFAULT_MODEL);
    }
  }, [activeSessionId, activeSessionModel]);

  // Auto-scroll on new messages (only when current session's messages change)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Model change ────────────────────────────────────────────
  const handleModelChange = useCallback(
    (nextModel: string) => {
      setModel(nextModel);
      if (activeSessionId) {
        setSessions((prev) =>
          prev.map((s) => (s.id === activeSessionId ? { ...s, model: nextModel } : s)),
        );
      }
    },
    [activeSessionId],
  );

  // ── New chat (creates session immediately) ─────────────────
  const handleNewChat = useCallback(() => {
    const newSession = createEmptySession(model);
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setInput("");
    inputRef.current?.focus();
  }, [model]);

  // ── Delete session ─────────────────────────────────────────
  const handleDeleteSession = useCallback(
    (id: string, e?: React.MouseEvent) => {
      stopEvent(e);
      abortControllerRef.current?.abort();
      // We can't call `setActiveSessionId` directly inside the
      // `setSessions` updater — React disallows setState-during-setState
      // (the updater is supposed to be a pure function of `prev`). Using
      // `flushSync` would force a sync flush and is even more invasive, so
      // we just compute the next-id eagerly from the current `sessions`
      // snapshot and call both setters synchronously outside the updater.
      // This is byte-equivalent to the old `setTimeout(..., 0)` trick
      // (which was the same thing — defer the setState to escape the
      // updater scope) but without the microtask deferral.
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (id === activeSessionId) {
        const remaining = sessions.filter((s) => s.id !== id);
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
      }
      showToast("Session deleted", "success");
    },
    [activeSessionId, sessions, showToast],
  );

  // ── Download session ───────────────────────────────────────
  const handleDownloadSession = useCallback(
    (s: ChatSession, format: "json" | "csv", e?: React.MouseEvent) => {
      stopEvent(e);
      const safeTitle = s.title.replace(/[^a-zA-Z0-9_-]/g, "_");
      const timestamp = Date.now();
      if (format === "json") {
        downloadFile(sessionToJson(s), `${safeTitle}_${timestamp}.json`, "application/json");
        showToast("Session exported as JSON", "success");
      } else {
        downloadFile(sessionToCsv(s), `${safeTitle}_${timestamp}.csv`, "text/csv");
        showToast("Session exported as CSV", "success");
      }
    },
    [showToast],
  );

  // ── Send message ───────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;

    // Abort any existing stream
    abortControllerRef.current?.abort();
    const gen = ++streamGenRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Don't send if gateway is confirmed offline
    if (gatewayOnline === false) {
      showToast("Gateway is offline — start it with: hermes gateway start", "error");
      return;
    }

    // Resolve the target session — creating one on demand if there is no
    // active session yet. The `existing` lookup decides (a) whether we
    // need to insert a brand-new session and (b) what prior-message
    // history to send to the API (empty for new sessions, full history
    // for existing ones).
    const existing = activeSessionId
      ? sessions.find((s) => s.id === activeSessionId)
      : undefined;
    const newSession = !existing ? createEmptySession(model) : undefined;
    const targetSessionId = existing?.id ?? newSession!.id;

    if (newSession) {
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
    }

    // Create user and assistant messages
    const userMessage = createUserMessage(text);
    const assistantMessage = createAssistantMessage();
    const assistantId = assistantMessage.id;

    // Optimistically add messages
    updateSessionMessages(targetSessionId, (prev) => [
      ...prev,
      userMessage,
      assistantMessage,
    ]);

    // If new session, set the title from first message
    if (newSession) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId ? { ...s, title: text.slice(0, 50) } : s,
        ),
      );
    }

    setInput("");
    setIsStreaming(true);

    // Build API messages (existing sessions include full history; new
    // sessions send only the new user message). `existing` was the lookup
    // we did above, so its `messages` field is the authoritative history.
    const priorMessages = existing?.messages ?? [];
    const apiMessages = toApiMessages(priorMessages, text);

    // Stream the response (errors handled via onError callback)
    await streamChatResponse(
      apiMessages,
      model,
      controller,
      (delta) => {
        updateSessionMessages(targetSessionId!, (prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + delta } : m,
          ),
        );
      },
      (errMsg) => showToast(errMsg, "error"),
    );

    if (gen === streamGenRef.current) {
      setIsStreaming(false);
    }
  }, [input, activeSessionId, sessions, model, gatewayOnline, showToast, updateSessionMessages]);

  // ── Keyboard shortcuts ─────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  // ── Copy code block handler ────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("copy-btn")) {
        const code = target.getAttribute("data-code") || "";
        navigator.clipboard.writeText(code).then(() => {
          showToast("Code copied", "success");
        });
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showToast]);

  // ── Models for dropdown ────────────────────────────────────
  // The `add` closure dedupes via `seen`, so the gateway loop doesn't
  // need its own `id !== CHAT_DEFAULT_MODEL` guard — that was redundant
  // (and silently relied on `seen` to do the work anyway).
  const mergedModels = useMemo(() => {
    const seen = new Set<string>();
    const merged: string[] = [];
    const add = (id: string) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      merged.push(id);
    };
    add(CHAT_DEFAULT_MODEL);
    for (const id of registryModelIds) add(id);
    for (const id of gatewayModelIds) add(id);
    return merged;
  }, [registryModelIds, gatewayModelIds]);

  const displayModelName = useCallback(
    (id: string) => modelLabels[id] || formatModelName(id),
    [modelLabels],
  );

  // Only show sessions with messages in the sidebar
  const sessionList = useMemo(
    () => sessions.filter((s) => s.messages.length > 0).slice(0, CHAT_MAX_SESSIONS),
    [sessions],
  );

  const hasActiveSession = activeSession !== undefined;

  // ── Render ─────────────────────────────────────────────────
  return (
    <AppPageShell className="flex flex-col h-full min-h-0">
      <div className="flex flex-col flex-1 min-h-0">
      <PageHeader
        icon={MessageCircle}
        title="Chat"
        subtitle="Web-based Hermes agent interface"
        color="cyan"
        actions={
          <div className="flex items-center gap-2">
            <InlineSelect
              value={model}
              onChange={handleModelChange}
              options={mergedModels.map((m) => ({ value: m, label: displayModelName(m) }))}
              accentColor="purple"
              className="w-[220px] text-xs"
              disabled={modelsLoading}
            />
            {modelsError && (
              <span className="text-[10px] text-neon-orange/80 font-mono" title={modelsError}>
                !
              </span>
            )}
            <Button
              variant="secondary"
              color="cyan"
              size="sm"
              icon={Plus}
              onClick={handleNewChat}
            >
              New Chat
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — only visible when there are sessions to show */}
        <div className="w-60 shrink-0 border-r border-white/10 bg-white/[0.01] flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
              Sessions ({sessionList.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {sessionList.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={`w-full text-left px-3 py-2 border-b border-white/5 transition-colors hover:bg-white/5 group relative ${
                  s.id === activeSessionId ? "bg-white/10 border-l-2 border-l-neon-cyan" : ""
                }`}
                title={s.title}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white/70 truncate font-medium">
                      {s.title}
                    </div>
                    <div className="text-[10px] text-white/30 mt-0.5 font-mono">
                      {s.messages.length} message{s.messages.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  {/* Hover actions: download + delete */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <div className="relative group/download">
                      <button
                        onClick={(e) => handleDownloadSession(s, "json", e)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-neon-cyan/20 hover:text-neon-cyan text-white/30"
                        title="Download as JSON"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <div className="absolute right-0 top-full mt-0.5 hidden group-hover/download:block z-50">
                        <button
                          onClick={(e) => handleDownloadSession(s, "csv", e)}
                          className="whitespace-nowrap text-[10px] font-mono px-2 py-1 rounded bg-dark-900 border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors shadow-lg"
                        >
                          as CSV
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-neon-red/20 hover:text-neon-red text-white/30"
                      title="Delete session"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </button>
            ))}
            {sessionList.length === 0 && (
              <div className="p-3 text-xs text-white/20 italic">No sessions</div>
            )}
          </div>
        </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Gateway status banners — shown regardless of session state */}
            {!hasActiveSession && messages.length === 0 && (
              <>
                {gatewayOnline === false && <GatewayBanner status="offline" />}
                {gatewayOnline !== false && agentDefaultModelSet === false && (
                  <GatewayBanner status="model-missing" />
                )}
                {gatewayOnline === null && <GatewayBanner status="checking" />}
              </>
            )}
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-24">
                <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-white/30" />
                </div>
                <h3 className="text-lg font-semibold text-white/60 mb-1">
                  {hasActiveSession
                    ? sessions.find((s) => s.id === activeSessionId)?.title || "New Chat"
                    : "Chat with your agent"}
                </h3>
                <p className="text-sm text-white/40 mb-2 max-w-md">
                  {hasActiveSession
                    ? "Send a message to begin."
                    : "Type a message below to start a new conversation."}
                </p>
                {!hasActiveSession && gatewayOnline !== false && (
                  <p className="text-xs text-white/20 font-mono">
                    Connected via Gateway API Server at localhost:8642
                  </p>
                )}
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg bg-neon-purple/20 border border-neon-purple/30 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-neon-purple" />
                    </div>
                  )}

                  <div
                    className={`max-w-[70%] rounded-xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-neon-cyan/10 border border-neon-cyan/20 text-white"
                        : "bg-white/5 border border-white/10 text-white/80"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div
                        className="text-sm leading-relaxed prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: msg.content
                            ? renderMarkdown(msg.content)
                            : '<span class="text-white/30 italic">Thinking...</span>',
                        }}
                      />
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}
                    <div className="text-[10px] text-white/20 font-mono mt-1 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>

                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-lg bg-neon-cyan/20 border border-neon-cyan/30 flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4 text-neon-cyan" />
                    </div>
                  )}
                </div>
              ))
            )}

            {isStreaming && messages.length > 0 && !messages[messages.length - 1].content && (
              <TypingIndicator />
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area — always visible */}
          <div className="border-t border-white/10 px-6 py-4">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isStreaming
                    ? "Type to interrupt and send a new message..."
                    : hasActiveSession
                    ? "Type a message... (Enter to send, Shift+Enter for newline)"
                    : "Type a message to start a new conversation..."
                }
                rows={1}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-neon-cyan/50 transition-colors font-mono resize-none"
                style={{ minHeight: "42px", maxHeight: "120px" }}
                onInput={(e) => {
                  const ta = e.target as HTMLTextAreaElement;
                  ta.style.height = "auto";
                  ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={isStreaming ? () => abortControllerRef.current?.abort() : handleSend}
                disabled={!input.trim() && !isStreaming}
                className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${
                  isStreaming
                    ? "bg-neon-red/20 border-neon-red/30 text-neon-red hover:bg-neon-red/30"
                    : "bg-neon-cyan/20 border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed"
                }`}
              >
                {isStreaming ? (
                  <Square className="w-4 h-4 fill-current" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
      {toastElement}
    </AppPageShell>
  );
}
