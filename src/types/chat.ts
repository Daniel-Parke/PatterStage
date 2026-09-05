// ═══════════════════════════════════════════════════════════════
// Chat Types — server-persisted agent conversations.
//
// The chat surface is backed by the server (chat-repository, 013_chat.sql),
// not localStorage. These shapes mirror the JSON the /api/chat routes return
// (camelCase). An assistant turn streams its reply from the run-event SSE
// (/api/runs/[runId]/events) in "agent" mode, or from the raw gateway in
// "fast" mode.
// ═══════════════════════════════════════════════════════════════

type ChatRole = "user" | "assistant" | "system";

/** pending → streaming → complete | failed | cancelled. */
type ChatMessageStatus = "pending" | "streaming" | "complete" | "failed" | "cancelled";

/** "agent" = real run (tools + memory); "fast" = raw model completion. */
export type ChatMode = "agent" | "fast";

export interface ToolCall {
  name: string;
  status: "invoked" | "completed" | "failed" | "approval_required";
  arguments?: unknown;
  result?: unknown;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  reasoning?: string | null;
  toolCalls?: ToolCall[] | null;
  /** PatterStage run id backing an assistant turn (agent mode); null in fast mode. */
  runId?: string | null;
  status: ChatMessageStatus;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
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

/** Message shape accepted by the raw /api/orchestration/chat endpoint (fast mode). */
export interface ApiMessage {
  role: ChatRole;
  content: string;
}

export const CHAT_DEFAULT_MODEL = "hermes-agent";
export const CHAT_DEFAULT_MODE: ChatMode = "agent";
