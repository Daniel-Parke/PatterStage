// ═══════════════════════════════════════════════════════════════
// Chat Types — Shared between chat page and chat-related components
// ═══════════════════════════════════════════════════════════════

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  created_at: number;
  updated_at: number;
}

/** Message shape accepted by the /api/orchestration/chat endpoint */
export interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

export const CHAT_STORAGE_KEY = "ch_sessions";
export const CHAT_DEFAULT_MODEL = "hermes-agent";
export const CHAT_MAX_SESSIONS = 50;
