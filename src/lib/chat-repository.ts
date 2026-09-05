// ═══════════════════════════════════════════════════════════════
// chat-repository.ts — CRUD for server-persisted agent-chat conversations
//
// Replaces the old localStorage-only chat. A `chat_conversations` row is one
// thread, mapped to a Hermes session (`session_id`) for agent memory/continuity;
// `chat_messages` holds the turns. An assistant turn is linked to the Control
// Hub run that produced it (`run_id`) so the live run-event stream and
// getRun() finalisation can reconcile it. See 013_chat.sql.
// ═══════════════════════════════════════════════════════════════

import { getDb, inTransaction, now, uuid } from "./db";
import { buildUpdate } from "./db/build-update";

/** Placeholder title a conversation gets until its first user message names it. */
export const DEFAULT_CONVERSATION_TITLE = "New Chat";

/**
 * Derive a short, distinguishable conversation title from the first user
 * message (first non-empty line, markdown heading marker stripped, ~48 chars).
 */
export function deriveConversationTitle(content: string): string {
  const firstLine = content.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  const cleaned = firstLine.replace(/^#+\s*/, "");
  if (!cleaned) return DEFAULT_CONVERSATION_TITLE;
  return cleaned.length > 48 ? `${cleaned.slice(0, 48)}…` : cleaned;
}

export type ChatRole = "user" | "assistant" | "system";
/** pending → streaming → complete | failed | cancelled (validated here, not in SQL). */
export type ChatMessageStatus = "pending" | "streaming" | "complete" | "failed" | "cancelled";

export interface ToolCallRecord {
  name: string;
  status: "invoked" | "completed" | "failed" | "approval_required";
  arguments?: unknown;
  result?: unknown;
}

export interface ChatConversation {
  id: string;
  title: string;
  sessionId: string | null;
  profileName: string | null;
  model: string | null;
  previousResponseId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  reasoning: string | null;
  toolCalls: ToolCallRecord[] | null;
  runId: string | null;
  status: ChatMessageStatus;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatConversationWithMessages extends ChatConversation {
  messages: ChatMessage[];
}

// ── Row shapes ───────────────────────────────────────────────

interface ConversationRow {
  id: string;
  title: string;
  session_id: string | null;
  profile_name: string | null;
  model: string | null;
  previous_response_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  reasoning: string | null;
  tool_calls_json: string | null;
  run_id: string | null;
  status: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}

function parseToolCalls(raw: string | null): ToolCallRecord[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ToolCallRecord[]) : null;
  } catch {
    return null;
  }
}

function rowToConversation(row: ConversationRow | undefined): ChatConversation | null {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    sessionId: row.session_id,
    profileName: row.profile_name,
    model: row.model,
    previousResponseId: row.previous_response_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMessage(row: MessageRow | undefined): ChatMessage | null {
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as ChatRole,
    content: row.content,
    reasoning: row.reasoning,
    toolCalls: parseToolCalls(row.tool_calls_json),
    runId: row.run_id,
    status: row.status as ChatMessageStatus,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Conversations ────────────────────────────────────────────

export interface CreateConversationInput {
  id?: string;
  title?: string;
  sessionId?: string | null;
  profileName?: string | null;
  model?: string | null;
  previousResponseId?: string | null;
}

export function createConversation(input: CreateConversationInput = {}): ChatConversation {
  const id = input.id ?? uuid();
  const ts = now();
  getDb()
    .prepare(
      `INSERT INTO chat_conversations
         (id, title, session_id, profile_name, model, previous_response_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.title ?? DEFAULT_CONVERSATION_TITLE,
      input.sessionId ?? null,
      input.profileName ?? null,
      input.model ?? null,
      input.previousResponseId ?? null,
      ts,
      ts,
    );
  return getConversation(id)!;
}

export function getConversation(id: string): ChatConversation | null {
  const row = getDb()
    .prepare("SELECT * FROM chat_conversations WHERE id = ?")
    .get(id) as ConversationRow | undefined;
  return rowToConversation(row);
}

/** Conversations, most-recently-updated first. */
export function listConversations(limit = 100): ChatConversation[] {
  const rows = getDb()
    .prepare("SELECT * FROM chat_conversations ORDER BY updated_at DESC LIMIT ?")
    .all(limit) as ConversationRow[];
  return rows.map(rowToConversation).filter((c): c is ChatConversation => c !== null);
}

export function getConversationWithMessages(id: string): ChatConversationWithMessages | null {
  const conversation = getConversation(id);
  if (!conversation) return null;
  return { ...conversation, messages: getMessages(id) };
}

export function updateConversation(
  id: string,
  updates: {
    title?: string;
    sessionId?: string | null;
    model?: string | null;
    previousResponseId?: string | null;
  },
): ChatConversation | null {
  const { sql, values } = buildUpdate(
    {
      title: updates.title,
      session_id: updates.sessionId === undefined ? undefined : updates.sessionId,
      model: updates.model === undefined ? undefined : updates.model,
      previous_response_id:
        updates.previousResponseId === undefined ? undefined : updates.previousResponseId,
    },
    { now: now() },
  );
  inTransaction(() => {
    getDb().prepare(`UPDATE chat_conversations SET ${sql} WHERE id = ?`).run(...values, id);
  });
  return getConversation(id);
}

export function deleteConversation(id: string): boolean {
  // chat_messages cascade via the FK ON DELETE CASCADE.
  const result = getDb().prepare("DELETE FROM chat_conversations WHERE id = ?").run(id);
  return result.changes > 0;
}

// ── Messages ─────────────────────────────────────────────────

export interface CreateMessageInput {
  id?: string;
  conversationId: string;
  role: ChatRole;
  content?: string;
  runId?: string | null;
  status?: ChatMessageStatus;
}

export function createMessage(input: CreateMessageInput): ChatMessage {
  const id = input.id ?? uuid();
  const ts = now();
  getDb()
    .prepare(
      `INSERT INTO chat_messages
         (id, conversation_id, role, content, run_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.conversationId,
      input.role,
      input.content ?? "",
      input.runId ?? null,
      input.status ?? "complete",
      ts,
      ts,
    );
  // Touch the parent conversation so the sidebar re-sorts.
  getDb()
    .prepare("UPDATE chat_conversations SET updated_at = ? WHERE id = ?")
    .run(ts, input.conversationId);
  // Auto-title an untitled conversation from its first user message, so the
  // sidebar shows something distinguishable instead of a row of "New Chat".
  if (input.role === "user" && (input.content ?? "").trim().length > 0) {
    const convo = getConversation(input.conversationId);
    if (convo && convo.title === DEFAULT_CONVERSATION_TITLE) {
      updateConversation(input.conversationId, { title: deriveConversationTitle(input.content!) });
    }
  }
  return getMessage(id)!;
}

export function getMessage(id: string): ChatMessage | null {
  const row = getDb()
    .prepare("SELECT * FROM chat_messages WHERE id = ?")
    .get(id) as MessageRow | undefined;
  return rowToMessage(row);
}

export function getMessageByRunId(runId: string): ChatMessage | null {
  const row = getDb()
    .prepare("SELECT * FROM chat_messages WHERE run_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(runId) as MessageRow | undefined;
  return rowToMessage(row);
}

export function getMessages(conversationId: string): ChatMessage[] {
  const rows = getDb()
    .prepare("SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC")
    .all(conversationId) as MessageRow[];
  return rows.map(rowToMessage).filter((m): m is ChatMessage => m !== null);
}

export function updateMessage(
  id: string,
  updates: {
    content?: string;
    reasoning?: string | null;
    toolCalls?: ToolCallRecord[] | null;
    runId?: string | null;
    status?: ChatMessageStatus;
    error?: string | null;
  },
): ChatMessage | null {
  const { sql, values } = buildUpdate(
    {
      content: updates.content,
      reasoning: updates.reasoning === undefined ? undefined : updates.reasoning,
      tool_calls_json:
        updates.toolCalls === undefined
          ? undefined
          : updates.toolCalls === null
            ? null
            : JSON.stringify(updates.toolCalls),
      run_id: updates.runId === undefined ? undefined : updates.runId,
      status: updates.status,
      error: updates.error === undefined ? undefined : updates.error,
    },
    { now: now() },
  );
  inTransaction(() => {
    getDb().prepare(`UPDATE chat_messages SET ${sql} WHERE id = ?`).run(...values, id);
  });
  return getMessage(id);
}

/**
 * Watchdog: fail assistant turns that can never reach a terminal state.
 *
 * Chat had no equivalent of `failStuckResearchRuns`, and it needed one for the
 * same reason. `reconcilePendingChatMessages` heals a turn by looking up its
 * run, so it can only heal turns that HAVE one:
 *
 *   · A fast-mode turn never has a run (`useChatSend` sets `runId: null`), so a
 *     tab closed mid-stream left a row `streaming` for the life of the database.
 *   · A turn whose run has since been pruned is the same wedge by a different
 *     route: the lookup finds nothing and the loop moves on, forever.
 *
 * Both are swept here. A row whose run STILL EXISTS is deliberately left alone
 * however old it is, because that one belongs to the reconciler and sweeping it
 * would race a live agent turn that is simply taking its time (T-0052).
 *
 * Returns the count failed, so the boot log can say what it did.
 */
export function failStuckChatMessages(maxMinutes = 30): number {
  const cutoff = new Date(Date.now() - maxMinutes * 60_000).toISOString();
  const res = getDb()
    .prepare(
      `UPDATE chat_messages
          SET status = 'failed', error = ?, updated_at = ?
        WHERE role = 'assistant'
          AND status IN ('pending', 'streaming')
          AND created_at < ?
          AND (
            run_id IS NULL
            OR NOT EXISTS (SELECT 1 FROM runs WHERE runs.id = chat_messages.run_id)
          )`,
    )
    .run(
      "This reply was interrupted and did not finish. The server restarted, or the tab closed mid-stream.",
      now(),
      cutoff,
    );
  return res.changes;
}
