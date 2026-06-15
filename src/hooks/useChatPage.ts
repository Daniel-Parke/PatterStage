// ═══════════════════════════════════════════════════════════════
// useChatPage — the Chat page's stateful core (sessions + streaming).
// Extracted verbatim from app/orchestration/chat/page.tsx so the page
// component is a thin render shell (mirrors useMissionsPage/useModelsPage).
// Every dependency array, ref, and effect guard is preserved byte-for-byte.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useToast } from "@/components/ui/Toast";
import { CHAT_DEFAULT_MODEL, CHAT_MAX_SESSIONS } from "@/types/chat";
import type { ChatMessage, ChatSession } from "@/types/chat";
import {
  loadSessions,
  saveSessions,
  downloadFile,
  sessionToJson,
  sessionToCsv,
  sanitiseFilename,
  createEmptySession,
  createUserMessage,
  createAssistantMessage,
  toApiMessages,
  streamChatResponse,
  COPY_BTN_CLASS,
  COPY_BTN_DATA_ATTR,
} from "@/lib/chat-utils";
import { useGatewayHealth } from "@/hooks/useGatewayHealth";

// ── Event helpers ──────────────────────────────────────────────

/** Stop click bubbling for inline button-on-button handlers. */
const stopEvent = (e?: React.MouseEvent) => e?.stopPropagation();

export function useChatPage() {
  // `toastElement` is the portal-rendered toast UI — without rendering it
  // in the JSX (just below the closing `</div>` of the page body), every
  // `showToast(...)` call would be silent. Both the destructure and the
  // render are required.
  const { showToast, toastElement } = useToast();

  // Sessions — initialized from localStorage
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [model, setModel] = useState(CHAT_DEFAULT_MODEL);

  // Gateway health, models, and agent default — all in one hook.
  // `gatewayModelIds` is intentionally NOT destructured here — the
  // chat dropdown only shows registered models (the registry is the
  // source of truth). The hook still fetches and exposes the gateway
  // list internally for the `modelsError` badge when the gateway is
  // offline, but the chat page no longer surfaces those IDs.
  const {
    online: gatewayOnline,
    authConfigured: gatewayAuthConfigured,
    agentDefaultModelSet,
    registryModelIds,
    modelLabels,
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

  /**
   * Generalised session-by-id updater. Updates the session matching
   * `sessionId` by applying the `updater` to its full record, and
   * stamps `updated_at = Date.now()`. Sessions with a different id
   * pass through unchanged.
   *
   * The 2 remaining inline `setSessions((prev) => prev.map((s) =>
   * s.id === X ? { ...s, ...FIELD } : s))` sites (model change +
   * new-session title set) collapse to a single call shape. The
   * pre-existing `updateSessionMessages` is a 1-line wrapper that
   * adapts the message-only updater to this generalised form — so the
   * helper has 2 direct callers (model + title) and 1 indirect caller
   * (`updateSessionMessages`), with zero external change in semantics.
   */
  const updateSession = useCallback(
    (sessionId: string, updater: (session: ChatSession) => ChatSession) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...updater(s), updated_at: Date.now() }
            : s,
        ),
      );
    },
    [],
  );

  const updateSessionMessages = useCallback(
    (sessionId: string, updater: (messages: ChatMessage[]) => ChatMessage[]) => {
      updateSession(sessionId, (s) => ({ ...s, messages: updater(s.messages) }));
    },
    [updateSession],
  );

  // Prepend a brand-new session to the top of the list and make it the
  // active session. The 2-line pattern `setSessions((prev) => [newSession,
  // ...prev]); setActiveSessionId(newSession.id);` appears at 2 sites —
  // `handleNewChat` (the "New Chat" button) and `handleSend` (the
  // first-message path that lazily creates a session when there is no
  // active one yet). Centralising the 2-setter sequence here keeps the
  // 2 sites in lockstep if a future "also clear the streaming state" or
  // "also persist a session-created event" extension lands. The
  // useState setters are stable, so the `useCallback` deps array is
  // `[]`. Sister to the `closeModelEditor` / `closeFallbackModal` /
  // `closeAddCustom` / `closeSyncModal` 1- and 2-setter close-callback
  // extractions in session 196 (List 4) — same Rule of Two + page-local
  // useCallback shape. The success-then-activate edge (an existing
  // session is reused, not newly created) is the "no-op" branch of the
  // helper and is intentionally NOT migrated: `handleSend` only calls
  // this helper inside its `if (newSession)` branch.
  const prependAndActivateSession = useCallback((newSession: ChatSession) => {
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  }, []);

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
  // NOTE: the previous code used `useMemo` here, but that subtly changed
  // the auto-scroll effect's dependency stability (see session 94 for
  // the full analysis). Reverted to the original inline `find` so the
  // downstream `messages` `useMemo` re-fires on every render — matching
  // the pre-session-94 scroll behavior exactly. The remaining inline
  // `sessions.find` site (this line) is the canonical `activeSession`
  // derivation; the 2 other `sessions.find` call sites that used to
  // exist (the JSX empty-state title and `handleSend`'s `existing`
  // lookup) now reuse this `activeSession` value directly. Promoting
  // THIS line to a `useMemo` would be a behavior change (scroll effect
  // dependency stability), not a byte-equivalent rename.
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
        updateSession(activeSessionId, (s) => ({ ...s, model: nextModel }));
      }
    },
    [activeSessionId, updateSession],
  );

  // ── New chat (creates session immediately) ─────────────────
  const handleNewChat = useCallback(() => {
    const newSession = createEmptySession(model);
    prependAndActivateSession(newSession);
    setInput("");
    inputRef.current?.focus();
  }, [model, prependAndActivateSession]);

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
      // Filename slug via the shared `sanitiseFilename` helper (was an
      // inline `replace(/[^a-zA-Z0-9_-]/g, "_")` regex). The helper lives
      // in `@/lib/chat-utils` next to `sessionToJson` / `sessionToCsv` so
      // any future "export as Markdown / PDF" feature can reuse it.
      const safeTitle = sanitiseFilename(s.title);
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
    // for existing ones). The top-level `activeSession` (line 134) is
    // already the same `sessions.find` — reusing it is byte-equivalent
    // (the prior `activeSessionId ? find : undefined` ternary collapses
    // to `activeSession ?? undefined`, which is the same when activeSession
    // is already undefined for the null-id case).
    const existing = activeSession;
    const newSession = !existing ? createEmptySession(model) : undefined;
    const targetSessionId = existing?.id ?? newSession!.id;

    if (newSession) {
      prependAndActivateSession(newSession);
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
      updateSession(targetSessionId, (s) => ({ ...s, title: text.slice(0, 50) }));
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
  }, [input, activeSession, model, gatewayOnline, showToast, updateSession, updateSessionMessages, prependAndActivateSession]);

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
  // The button class is matched by name (event delegation — the
  // `renderMarkdown` helper injects the buttons via
  // `dangerouslySetInnerHTML`, so per-button React `onClick` props
  // aren't an option). The class string lives in the
  // `COPY_BTN_CLASS` constant in `@/lib/chat-utils` so a rename
  // in one file can't silently desync from the other (the prior
  // magic-string form was the source-pattern test at
  // `tests/unit/copy-btn-magic-string-source-pattern.test.ts`).
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains(COPY_BTN_CLASS)) {
        const code = target.getAttribute(COPY_BTN_DATA_ATTR) || "";
        navigator.clipboard.writeText(code).then(() => {
          showToast("Code copied", "success");
        });
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showToast]);

  // Only show sessions with messages in the sidebar
  const sessionList = useMemo(
    () => sessions.filter((s) => s.messages.length > 0).slice(0, CHAT_MAX_SESSIONS),
    [sessions],
  );

  const hasActiveSession = activeSession !== undefined;

  return {
    toastElement,
    // model dropdown
    model,
    handleModelChange,
    registryModelIds,
    modelLabels,
    modelsLoading,
    modelsError,
    // sessions
    sessionList,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    hasActiveSession,
    handleNewChat,
    handleDeleteSession,
    handleDownloadSession,
    // gateway banners
    gatewayOnline,
    gatewayAuthConfigured,
    agentDefaultModelSet,
    // messages + streaming
    messages,
    isStreaming,
    messagesEndRef,
    inputRef,
    input,
    setInput,
    handleKeyDown,
    handleSend,
    abortControllerRef,
  };
}
