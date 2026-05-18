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
  MessageCircle, Send, Plus, Trash2, X,
  Bot, User, Loader2, AlertTriangle,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

// ── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = "ch_sessions";
const DEFAULT_MODEL = "hermes-agent";
const MAX_SESSIONS = 50;

// ── Types ──────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  created_at: number;
  updated_at: number;
}

// ── localStorage helpers ───────────────────────────────────────

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_SESSIONS);
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

// ── Simple HTML entity escape for markdown rendering ───────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Simple markdown-like rendering for chat responses ──────────

function renderMarkdown(text: string): string {
  // Escape HTML entities first to prevent XSS
  let safe = escapeHtml(text);

  // Code blocks (must come before inline code)
  let html = safe.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<div class="relative group"><div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">' +
    '<button class="copy-btn text-[10px] font-mono text-white/40 hover:text-white/80 bg-gray-900/80 px-2 py-1 rounded border border-white/10" data-code="$2">Copy</button></div>' +
    '<pre class="bg-gray-900 border border-white/10 rounded-lg p-4 overflow-x-auto text-sm font-mono text-white/80 leading-relaxed my-2"><code>$2</code></pre></div>',
  );
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-xs font-mono text-neon-cyan">$1</code>');
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // Line breaks
  html = html.replace(/\n/g, "<br />");
  return html;
}

function generateId(): string {
  return `msg_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function generateSessionId(): string {
  return `session_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

// ── Typing indicator component ─────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <div className="w-8 h-8 rounded-lg bg-neon-purple/20 border border-neon-purple/30 flex items-center justify-center shrink-0 mt-1">
        <Bot className="w-4 h-4 text-neon-purple" />
      </div>
      <div className="max-w-[70%] rounded-xl px-4 py-3 bg-white/5 border border-white/10">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

// ── Page component ─────────────────────────────────────────────

export default function ChatPage() {
  const { showToast } = useToast();

  // Sessions — initialized from localStorage
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [availableModels, setAvailableModels] = useState<string[]>([DEFAULT_MODEL]);

  // Current messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Gateway connectivity check
  const [gatewayOnline, setGatewayOnline] = useState<boolean | null>(null);

  // ── Load persisted sessions from localStorage on mount ─────
  useEffect(() => {
    const saved = loadSessions();
    if (saved.length > 0) {
      setSessions(saved);
      setActiveSessionId(saved[0].id);
    }
  }, []);

  // ── Persist sessions to localStorage on every change ───────
  // We use a ref to avoid saving during initial mount hydration
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveSessions(sessions);
  }, [sessions]);

  // ── Fetch dynamic models from gateway ──────────────────────
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch("/api/gateway/models", {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const json = await res.json();
          const models: string[] = json.data?.models || json.data || [];
          if (models.length > 0) {
            setAvailableModels(models);
          }
        }
      } catch {
        // Gateway not available — keep defaults
      }
    };
    fetchModels();
  }, []);

  // ── Gateway connectivity check ─────────────────────────────
  useEffect(() => {
    const checkGateway = async () => {
      try {
        const res = await fetch("/api/gateway/health", {
          method: "GET",
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const json = await res.json();
          setGatewayOnline(json.data?.online === true);
        } else {
          setGatewayOnline(false);
        }
      } catch {
        setGatewayOnline(false);
      }
    };
    checkGateway();
    const id = setInterval(checkGateway, 30000);
    return () => clearInterval(id);
  }, []);

  // Get or create active session
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = useMemo(() => activeSession?.messages || [], [activeSession]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Session state mutation helpers (auto-persist via useEffect) ─

  const updateSession = useCallback(
    (sessionId: string, updater: (s: ChatSession) => ChatSession) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? updater(s) : s)),
      );
    },
    [],
  );

  // ── New chat ───────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    const id = generateSessionId();
    const newSession: ChatSession = {
      id,
      title: "New Chat",
      messages: [],
      model,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(id);
    setInput("");
    inputRef.current?.focus();
  }, [model]);

  // Auto-create first session if none exist and none loaded from localStorage
  useEffect(() => {
    if (sessions.length === 0 && activeSessionId === null) {
      handleNewChat();
    }
  }, [sessions.length, activeSessionId, handleNewChat]);

  // ── Delete session ─────────────────────────────────────────
  const handleDeleteSession = useCallback(
    (id: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        // If we deleted the active session, switch to the next available
        if (id === activeSessionId) {
          const nextActive = next.length > 0 ? next[0].id : null;
          // Schedule the next tick to set activeSessionId
          setTimeout(() => setActiveSessionId(nextActive), 0);
        }
        return next;
      });
      showToast("Session deleted", "success");
    },
    [activeSessionId, showToast],
  );

  // ── Send message ───────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !activeSessionId) return;

    // Don't send if gateway is confirmed offline
    if (gatewayOnline === false) {
      showToast("Gateway is offline — start it with: hermes gateway start", "error");
      return;
    }

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    // Add user message optimistically
    updateSession(activeSessionId, (s) => ({
      ...s,
      messages: [...s.messages, userMessage],
      updated_at: Date.now(),
      title: s.messages.length === 0 ? text.slice(0, 50) : s.title,
    }));
    setInput("");

    // Prepare assistant message placeholder
    const assistantId = generateId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    updateSession(activeSessionId, (s) => ({
      ...s,
      messages: [...s.messages, assistantMessage],
    }));
    setIsStreaming(true);

    try {
      // Build message history for the API
      // Use current session messages directly (before state updates above take effect)
      const session = sessions.find((s) => s.id === activeSessionId);
      const currentMessages = session?.messages || [];
      const apiMessages = [
        ...currentMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text },
      ];

      const res = await fetch("/api/orchestration/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          model,
          stream: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        showToast(err.error || "Chat request failed", "error");
        setIsStreaming(false);
        return;
      }

      // Read the streaming response
      const reader = res.body?.getReader();
      if (!reader) {
        showToast("No response stream available", "error");
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Parse SSE format: data: {...}\n\n
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || "";
              if (delta) {
                updateSession(activeSessionId, (s) => ({
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + delta }
                      : m,
                  ),
                }));
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Chat failed", "error");
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, activeSessionId, sessions, model, showToast, gatewayOnline, updateSession]);

  // ── Keyboard shortcuts ─────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ── Clear session messages ─────────────────────────────────
  const handleClearSession = useCallback(() => {
    if (!activeSessionId) return;
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session || session.messages.length === 0) return;

    const count = session.messages.length;

    updateSession(activeSessionId, (s) => ({
      ...s,
      messages: [],
      title: "New Chat",
      updated_at: Date.now(),
    }));

    showToast(`${count} message${count !== 1 ? "s" : ""} cleared`, "info");
  }, [activeSessionId, sessions, showToast, updateSession]);

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

  // ── Models that appear in dropdown ─────────────────────────
  // Always include user-selected model + defaults + fetched
  const mergedModels = useMemo(() => {
    const set = new Set([DEFAULT_MODEL, ...availableModels, model]);
    return Array.from(set);
  }, [availableModels, model]);

  const sessionList = sessions.slice(0, MAX_SESSIONS);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={MessageCircle}
        title="Chat"
        subtitle="Web-based Hermes agent interface"
        color="cyan"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/80 outline-none focus:border-neon-purple/50 transition-colors font-mono cursor-pointer appearance-none max-w-[200px]"
              title="Select model"
            >
              {mergedModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
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
        {/* Sidebar */}
        <div className="w-60 border-r border-white/10 bg-white/[0.01] flex flex-col">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
              Sessions ({sessionList.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessionList.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={`w-full text-left px-3 py-2 border-b border-white/5 transition-colors hover:bg-white/5 group relative ${
                  s.id === activeSessionId ? "bg-white/10 border-l-2 border-l-neon-cyan" : ""
                }`}
                title={s.title}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white/70 truncate font-medium">
                      {s.title}
                    </div>
                    <div className="text-[10px] text-white/30 mt-0.5 font-mono">
                      {s.messages.length} message{s.messages.length !== 1 ? "s" : ""}
                      {s.messages.length === 0 && " (empty)"}
                    </div>
                  </div>
                  {/* Delete button — visible on hover */}
                  <button
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-neon-red/20 hover:text-neon-red text-white/30"
                    title="Delete session"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </button>
            ))}
            {sessionList.length === 0 && (
              <div className="p-3 text-xs text-white/20 italic">No sessions</div>
            )}
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-24">
                {/* Gateway offline banner */}
                {gatewayOnline === false && (
                  <div className="w-full max-w-md mb-6 p-4 bg-neon-red/10 border border-neon-red/20 rounded-lg text-left">
                    <div className="flex items-center gap-2 text-neon-red mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-semibold">Gateway Offline</span>
                    </div>
                    <p className="text-xs text-white/60">
                      The Hermes Gateway (port 8642) is not responding.
                      Start it with: <code className="text-neon-cyan">hermes gateway start</code>
                    </p>
                  </div>
                )}
                {gatewayOnline === null && (
                  <div className="flex items-center gap-2 mb-4">
                    <Loader2 className="w-3 h-3 text-white/30 animate-spin" />
                    <span className="text-xs text-white/30">Checking gateway connection...</span>
                  </div>
                )}
                <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-white/30" />
                </div>
                <h3 className="text-lg font-semibold text-white/60 mb-1">
                  Chat with your agent
                </h3>
                <p className="text-sm text-white/40 mb-2 max-w-md">
                  Send a message to interact with your Hermes agent through the web interface.
                </p>
                {gatewayOnline !== false && (
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

            {/* Typing indicator while streaming */}
            {isStreaming && messages.length > 0 && (
              <TypingIndicator />
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-white/10 px-6 py-4">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={'Type a message... (Enter to send, Shift+Enter for newline)'}
                rows={1}
                disabled={isStreaming}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-neon-cyan/50 transition-colors font-mono resize-none disabled:opacity-50"
                style={{ minHeight: "42px", maxHeight: "120px" }}
                onInput={(e) => {
                  const ta = e.target as HTMLTextAreaElement;
                  ta.style.height = "auto";
                  ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
                }}
              />
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={handleClearSession}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/30 hover:text-neon-red hover:border-neon-red/30 transition-colors"
                    title="Clear conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-neon-cyan/20 border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {isStreaming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
