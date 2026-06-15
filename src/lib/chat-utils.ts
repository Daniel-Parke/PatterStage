// ═══════════════════════════════════════════════════════════════
// Chat Utilities — Extracted from monolithic chat page
// ═══════════════════════════════════════════════════════════════

import type { ChatSession, ChatMessage, ApiMessage } from "@/types/chat";
import { CHAT_STORAGE_KEY, CHAT_MAX_SESSIONS } from "@/types/chat";
import { messageFromError } from "@/lib/api-fetch";
import { titleCase } from "@/lib/utils";

// ── localStorage helpers ───────────────────────────────────────

export function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, CHAT_MAX_SESSIONS);
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sessions.slice(0, CHAT_MAX_SESSIONS)));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

// ── ID generation (module-internal) ─────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function generateMessageId(): string {
  return generateId("msg");
}

function generateSessionId(): string {
  return generateId("session");
}

// ── Download helpers ────────────────────────────────────────────

/**
 * Sanitise a session title into a filename-safe slug.
 *
 * Replaces any character that isn't `[A-Za-z0-9_-]` with an underscore.
 * Centralised so the regex lives in one place — the only call site
 * (chat page `handleDownloadSession`) used to inline it, and any
 * future "download session as Markdown" or "export PDF" feature will
 * need the exact same shape.
 */
export function sanitiseFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function sessionToJson(session: ChatSession): string {
  return JSON.stringify(
    {
      id: session.id,
      title: session.title,
      model: session.model,
      messages: session.messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp).toISOString(),
      })),
      created_at: new Date(session.created_at).toISOString(),
      updated_at: new Date(session.updated_at).toISOString(),
    },
    null,
    2,
  );
}

export function sessionToCsv(session: ChatSession): string {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [["Role", "Content", "Timestamp"].join(",")];
  for (const m of session.messages) {
    rows.push(
      [escape(m.role), escape(m.content), escape(new Date(m.timestamp).toISOString())].join(","),
    );
  }
  return rows.join("\n");
}

// ── HTML/Markdown helpers ───────────────────────────────────────

/**
 * CSS class the chat page's global click handler matches against to
 * identify the per-code-block "Copy" button that `renderMarkdown`
 * injects. Exported so the chat page can import the same string
 * instead of hard-coding a second copy of the magic literal (the
 * prior `if (target.classList.contains("copy-btn"))` was a magic
 * string coupled to `renderMarkdown`'s template — a one-character
 * rename in one file would silently break the click handler in
 * the other). Keep in sync with the class string on line 134.
 */
export const COPY_BTN_CLASS = "copy-btn";

/**
 * Data attribute the chat page's click handler reads to recover the
 * raw code-block content (the `renderMarkdown` template interpolates
 * the code into both the button's `data-code` attribute AND the
 * `<code>` element — the click handler reads the attribute to avoid
 * having to re-decode the displayed text). Same export pattern as
 * `COPY_BTN_CLASS`: a single source of truth shared by the producer
 * (`renderMarkdown`) and the consumer (the click handler in
 * `src/app/orchestration/chat/page.tsx`).
 */
export const COPY_BTN_DATA_ATTR = "data-code";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Simple markdown-like rendering for chat responses.
 * Handles code blocks (with copy button), inline code, bold, italic, and line breaks.
 */
export function renderMarkdown(text: string): string {
  const safe = escapeHtml(text);

  // Code blocks (must come before inline code). The button class
  // string comes from the `COPY_BTN_CLASS` constant — keep the two
  // sites in sync via the source-pattern test at
  // `tests/unit/copy-btn-magic-string-source-pattern.test.ts`.
  let html = safe.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    `<div class="relative group"><div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">` +
    `<button class="${COPY_BTN_CLASS} text-[10px] font-mono text-white/40 hover:text-white/80 bg-gray-900/80 px-2 py-1 rounded border border-white/10" ${COPY_BTN_DATA_ATTR}="$2">Copy</button></div>` +
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

/** Format model ID into human-readable name. */
export function formatModelName(id: string): string {
  if (id === "hermes-agent") return "Agent Default";
  const parts = id.split("/").pop()?.split(/[-_]+/) || [];
  return parts.map((p) => titleCase(p)).join(" ");
}

// ── Factory helpers ─────────────────────────────────────────────

export function createEmptySession(model: string): ChatSession {
  const id = generateSessionId();
  return {
    id,
    title: "New Chat",
    messages: [],
    model,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

export function createUserMessage(content: string): ChatMessage {
  return {
    id: generateMessageId(),
    role: "user",
    content,
    timestamp: Date.now(),
  };
}

export function createAssistantMessage(content = ""): ChatMessage {
  return {
    id: generateMessageId(),
    role: "assistant",
    content,
    timestamp: Date.now(),
  };
}

// ── API message helpers ─────────────────────────────────────────

export function toApiMessages(messages: ChatMessage[], newText: string): ApiMessage[] {
  return [
    ...messages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: newText },
  ];
}

// ── Chat stream reader ──────────────────────────────────────────

export type DeltaHandler = (delta: string) => void;

/**
 * Read an SSE chat stream and call onDelta for each content chunk.
 * Returns when the stream is exhausted or aborted.
 */
export async function readChatStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onDelta: DeltaHandler,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || "";
          if (delta) {
            onDelta(delta);
          }
        } catch (e) {
          // Skip malformed JSON chunks
          if (typeof data === "string") {
            console.warn("[chat] Skipped malformed SSE chunk:", data.slice(0, 120), e);
          }
        }
      }
    }
  }
}

// ── Streaming chat API call ────────────────────────────────────

/**
 * Send a chat request to the Hermes Gateway via the CH API proxy.
 * Streams the response via onDelta callback. Returns true on success.
 */
export async function streamChatResponse(
  apiMessages: ApiMessage[],
  sendModel: string,
  controller: AbortController,
  onDelta: (delta: string) => void,
  onError: (msg: string) => void,
): Promise<boolean> {
  try {
    const res = await fetch("/api/orchestration/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: apiMessages,
        model: sendModel,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      onError(err.error || "Chat request failed");
      return false;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onError("No response stream available");
      return false;
    }

    await readChatStream(reader, onDelta);
    return true;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return false;
    }
    onError(messageFromError(err, "Chat failed"));
    return false;
  }
}
