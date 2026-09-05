// ═══════════════════════════════════════════════════════════════
// chat-utils — client helpers for the server-persisted agent chat.
//
// Three concerns:
//  1. Rendering/formatting (markdown, model names, download/export).
//  2. The /api/chat client (conversations + messages + stop + approval).
//  3. Run-event SSE consumption (agent mode) — pure classifiers/extractors
//     (unit-tested) plus an EventSource wrapper. Fast mode reuses the raw
//     gateway streamer (streamChatResponse).
// ═══════════════════════════════════════════════════════════════

import type {
  ChatConversation,
  ChatMessage,
  ApiMessage,
  ChatMode,
  ToolCall,
} from "@/types/chat";
import { messageFromError, safeApiCall, safeApiCallData } from "@/lib/api-fetch";
import { titleCase } from "@/lib/utils";

// ── Download / export helpers ───────────────────────────────────

/**
 * Sanitise a conversation title into a filename-safe slug.
 * Replaces any character that isn't `[A-Za-z0-9_-]` with an underscore.
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

export function conversationToJson(conversation: ChatConversation, messages: ChatMessage[]): string {
  return JSON.stringify(
    {
      id: conversation.id,
      title: conversation.title,
      model: conversation.model,
      profileName: conversation.profileName,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        reasoning: m.reasoning ?? null,
        toolCalls: m.toolCalls ?? null,
        status: m.status,
        createdAt: m.createdAt,
      })),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    },
    null,
    2,
  );
}

export function conversationToCsv(messages: ChatMessage[]): string {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [["Role", "Content", "Status", "Timestamp"].join(",")];
  for (const m of messages) {
    rows.push([escape(m.role), escape(m.content), escape(m.status), escape(m.createdAt)].join(","));
  }
  return rows.join("\n");
}

// ── Markdown rendering ──────────────────────────────────────────

export const COPY_BTN_CLASS = "copy-btn";
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
  let html = safe.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    `<div class="relative group"><div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">` +
      `<button class="${COPY_BTN_CLASS} text-xs font-mono text-ps-text-muted hover:text-ps-text-primary bg-gray-900/80 px-2 py-1 rounded border border-white/10" ${COPY_BTN_DATA_ATTR}="$2">Copy</button></div>` +
      '<pre class="bg-gray-900 border border-white/10 rounded-lg p-4 overflow-x-auto text-sm font-mono text-ps-text-primary leading-relaxed my-2"><code>$2</code></pre></div>',
  );
  html = html.replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-xs font-mono text-neon-cyan">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\n/g, "<br />");
  return html;
}

/** Format model ID into human-readable name. */
export function formatModelName(id: string): string {
  if (id === "hermes-agent") return "Agent Default";
  const parts = id.split("/").pop()?.split(/[-_]+/) || [];
  return parts.map((p) => titleCase(p)).join(" ");
}

// ── /api/chat client ────────────────────────────────────────────

/**
 * The result of reading one conversation's transcript.
 *
 * It used to be `… | null`, which cost the callers two different things. The
 * export handler could not tell "this row has no turns" from "the read failed",
 * so it fell back to the transcript already on screen and wrote another
 * conversation's words into a file named after this one (D43). The load effect
 * could not say anything at all, so a 500 left the previous conversation's
 * turns under the new title, silently (D49). `ok` plus a reason answers both.
 */
export interface ConversationLoad {
  ok: boolean;
  conversation?: ChatConversation;
  messages?: ChatMessage[];
  error?: string;
}

export async function fetchConversation(id: string): Promise<ConversationLoad> {
  const res = await safeApiCall<{ data?: { conversation: ChatConversation; messages: ChatMessage[] } }>(
    `/api/chat/${id}`,
  );
  if (!res.ok) return { ok: false, error: res.error ?? "Failed to load conversation" };
  const payload = res.data?.data;
  if (!payload) return { ok: false, error: "Conversation response was empty" };
  return { ok: true, conversation: payload.conversation, messages: payload.messages };
}

export async function createConversationApi(input: {
  title?: string;
  profileName?: string;
  model?: string;
}): Promise<ChatConversation | null> {
  const data = await safeApiCallData<{ conversation: ChatConversation }>("/api/chat", {
    method: "POST",
    body: input,
  });
  return data?.conversation ?? null;
}

export async function deleteConversationApi(id: string): Promise<{ ok: boolean; error?: string }> {
  return await safeApiCall(`/api/chat/${id}`, { method: "DELETE" });
}

export interface SendMessageResult {
  runId?: string;
  userMessageId: string;
  assistantMessageId: string;
}

export async function sendMessageApi(
  id: string,
  content: string,
  mode: ChatMode,
): Promise<{ ok: boolean; error?: string; result?: SendMessageResult }> {
  const res = await safeApiCall<{ data: SendMessageResult }>(`/api/chat/${id}/messages`, {
    method: "POST",
    body: { content, mode },
  });
  return { ok: res.ok, error: res.error, result: res.data?.data };
}

/** Persist the final (or streaming) state of an assistant message. Fire-and-forget. */
export async function finalizeMessageApi(
  conversationId: string,
  messageId: string,
  patch: {
    content?: string;
    reasoning?: string | null;
    toolCalls?: ToolCall[] | null;
    status?: ChatMessage["status"];
    error?: string | null;
  },
): Promise<void> {
  await safeApiCall(`/api/chat/${conversationId}/messages/${messageId}`, {
    method: "PATCH",
    body: patch,
  });
}

export async function stopRunApi(
  conversationId: string,
  runId?: string,
): Promise<{ ok: boolean; error?: string }> {
  return await safeApiCall(`/api/chat/${conversationId}/stop`, {
    method: "POST",
    body: runId ? { runId } : {},
  });
}

export async function resolveApprovalApi(
  conversationId: string,
  runId: string,
  approved: boolean,
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  return await safeApiCall(`/api/chat/${conversationId}/approval`, {
    method: "POST",
    body: { runId, approved, note },
  });
}

// ── Run-event SSE (agent mode) ──────────────────────────────────

/**
 * Named SSE events the run-event proxy (/api/runs/[id]/events) emits.
 *
 * "error" is NOT on this list and must never be added back. EventSource fires
 * a built-in event of that exact type when the transport drops, so subscribing
 * to it means the handler below runs on a plain Event with no `data`:
 * `JSON.parse(undefined)` throws, the payload reads as empty, and a dropped
 * socket renders as a run that failed for no stated reason. Worse, it ran
 * BEFORE `es.onerror`, latching the terminal state and making the reconcile
 * path in useAgentRunStream unreachable. The proxy sends the run's own failure
 * as "run.error" for this reason.
 */
const RUN_SSE_EVENT_NAMES = [
  "open",
  "message.delta",
  "reasoning.available",
  "reasoning.delta",
  "run.completed",
  "run.failed",
  "run.cancelled",
  "response.created",
  "response.output_text.delta",
  "response.completed",
  "tool.invoked",
  "tool.completed",
  "tool.failed",
  "tool.approval_required",
  "done",
  "run.error",
];

export type RunEventKind =
  | "delta"
  | "reasoning"
  | "tool"
  | "completed"
  | "failed"
  | "cancelled"
  | "open"
  | "done"
  | "ignore";

/** Bucket a raw SSE event name into how the chat client should treat it. */
export function classifyRunEvent(type: string): RunEventKind {
  if (type === "message.delta" || type === "response.output_text.delta") return "delta";
  if (type.startsWith("reasoning")) return "reasoning";
  if (type.startsWith("tool")) return "tool";
  if (type === "run.completed" || type === "response.completed") return "completed";
  // "error" is deliberately absent: that name belongs to EventSource's own
  // transport-failure event, and reading it as a run failure turns every
  // dropped socket into a fabricated one. The proxy sends "run.error".
  if (type === "run.failed" || type === "run.error") return "failed";
  if (type === "run.cancelled") return "cancelled";
  if (type === "done") return "done";
  if (type === "open") return "open";
  return "ignore";
}

function asObj(data: unknown): Record<string, unknown> | null {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}
function firstString(o: Record<string, unknown> | null, keys: string[]): string {
  if (!o) return "";
  for (const k of keys) if (typeof o[k] === "string") return o[k] as string;
  return "";
}

export function extractDelta(data: unknown): string {
  if (typeof data === "string") return data;
  return firstString(asObj(data), ["delta", "text", "content", "output_text"]);
}
export function extractReasoning(data: unknown): string {
  if (typeof data === "string") return data;
  return firstString(asObj(data), ["reasoning", "delta", "text", "content", "summary"]);
}
export function extractCompletedOutput(data: unknown): string {
  if (typeof data === "string") return data;
  return firstString(asObj(data), ["output", "text", "content", "output_text"]);
}
export function extractRunError(data: unknown): string {
  if (typeof data === "string") return data;
  return firstString(asObj(data), ["error", "message", "detail"]) || "run failed";
}

/**
 * Does this payload report its own failure, whatever the event is called?
 *
 * A backend is free to close a tool call with `tool.completed` and put the bad
 * news in the body: "completed" is a statement about the call finishing, not
 * about it working. Deriving the chip from the event NAME alone is how a run
 * that died against a stopped gateway still showed "skill_view done" and
 * "terminal done" above the failure, which reads as three facts agreeing when
 * only one of them was true.
 *
 * Kept narrow on purpose: an explicit negative flag or a non-empty error field,
 * at the top level or one level down inside a `result` envelope. Over-matching
 * here would paint working tools red, which is the same lie pointing the other
 * way.
 */
function payloadReportsError(o: Record<string, unknown> | null, depth = 0): boolean {
  if (!o) return false;
  if (o.ok === false || o.success === false) return true;
  if (typeof o.status === "string" && /^(error|failed|failure)$/i.test(o.status.trim())) return true;
  for (const key of ["error", "errorMessage", "error_message"]) {
    const value = o[key];
    if (value === true) return true;
    if (typeof value === "string" && value.trim()) return true;
    if (value && typeof value === "object") return true;
  }
  if (depth === 0) return payloadReportsError(asObj(o.result), depth + 1);
  return false;
}

/** Parse a `tool.*` SSE event into a ToolCall card. */
export function parseToolEvent(type: string, data: unknown): ToolCall {
  const o = asObj(data);
  const name = firstString(o, ["name", "tool", "tool_name"]) || "tool";
  const named: ToolCall["status"] = type.includes("approval")
    ? "approval_required"
    : type.endsWith("completed")
      ? "completed"
      : type.endsWith("failed")
        ? "failed"
        : "invoked";
  // The payload outranks the name, except for an approval request, which is a
  // question rather than an outcome.
  const status: ToolCall["status"] =
    named !== "approval_required" && payloadReportsError(o) ? "failed" : named;
  const tc: ToolCall = { name, status };
  if (o && "arguments" in o) tc.arguments = o.arguments;
  if (o && "result" in o) tc.result = o.result;
  return tc;
}

/**
 * Settle the tool rows of a run that ended in failure.
 *
 * `finalize("failed")` used to persist the accumulator untouched, so a row the
 * stream left as `invoked` kept its spinner and its "running" chip for as long
 * as the transcript stayed open, on a turn that had already been dead for
 * minutes. The call did not complete and now never will, which is what
 * `failed` says. A row that genuinely completed is left alone: reframing it
 * would be a second lie in place of the first.
 *
 * Returns the same array when nothing needed settling, so an unchanged list
 * cannot trigger a pointless re-render.
 */
export function reframeToolsForFailedRun(tools: ToolCall[]): ToolCall[] {
  if (!tools.some((t) => t.status === "invoked" || t.status === "approval_required")) return tools;
  return tools.map((t) =>
    t.status === "invoked" || t.status === "approval_required"
      ? { ...t, status: "failed" as const }
      : t,
  );
}

/**
 * Merge a streamed tool event into the running list: update the matching
 * in-flight entry (same name, still invoked/awaiting-approval) in place, else
 * append. Keeps a single card per tool call as it progresses invoked→completed.
 */
export function mergeToolCall(list: ToolCall[], tc: ToolCall): ToolCall[] {
  const idx = list.findIndex(
    (t) => t.name === tc.name && (t.status === "invoked" || t.status === "approval_required"),
  );
  if (idx >= 0) {
    const copy = [...list];
    copy[idx] = { ...copy[idx], ...tc };
    return copy;
  }
  return [...list, tc];
}

export type RunEventCallback = (type: string, data: unknown) => void;

/**
 * Open the run-event SSE stream and forward every known event to `onEvent`.
 * Returns the EventSource so the caller can `.close()` on terminal/unmount.
 * (EventSource — not fetch — to match useRunProgress and get auto-parsing of
 * the proxy's `event:`/`data:` framing.)
 */
export function openRunEventStream(runId: string, onEvent: RunEventCallback): EventSource {
  const es = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);
  const wrap = (type: string) => (e: MessageEvent) => {
    let data: unknown = e.data;
    try {
      data = JSON.parse(e.data);
    } catch {
      /* keep the raw string */
    }
    onEvent(type, data);
  };
  for (const type of RUN_SSE_EVENT_NAMES) {
    es.addEventListener(type, wrap(type) as EventListener);
  }
  return es;
}

// ── Fast mode: raw gateway streaming ────────────────────────────

/** Build the OpenAI-style message array for the raw gateway (fast mode). */
export function toApiMessages(messages: ChatMessage[], newText: string): ApiMessage[] {
  return [
    ...messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: newText },
  ];
}

type DeltaHandler = (delta: string) => void;

/** Read an OpenAI-style SSE chat stream and call onDelta for each content chunk. */
async function readChatStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onDelta: DeltaHandler,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
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
          if (delta) onDelta(delta);
        } catch {
          /* skip malformed chunk */
        }
      }
    }
  }
}

/**
 * Fast mode: stream a raw model reply from the gateway proxy. Returns true on
 * success. Errors are surfaced via onError (callers persist + show them).
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
      body: JSON.stringify({ messages: apiMessages, model: sendModel, stream: true }),
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
    if (err instanceof DOMException && err.name === "AbortError") return false;
    onError(messageFromError(err, "Chat failed"));
    return false;
  }
}
