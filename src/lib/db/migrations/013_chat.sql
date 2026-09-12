-- ============================================================
-- 013_chat.sql — agent-chat persistence (server-side conversations)
--
-- Replaces the old localStorage-only chat with server-persisted
-- conversations, each mapped to a Hermes session (for agent memory /
-- multi-turn continuity). One `chat_conversations` row per thread;
-- `chat_messages` holds the user/assistant turns. An assistant turn is
-- linked to the PatterStage run that produced it (`run_id`) so the live
-- run-event stream and getRun() finalisation can reconcile it.
--
-- `role`/`status` are validated in TypeScript (chat-repository), NOT via
-- SQL CHECK, so newer code can introduce a status without a migration.
-- Idempotent: safe to run repeatedly on an existing database.
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_conversations (
  id                   TEXT PRIMARY KEY,
  title                TEXT NOT NULL DEFAULT 'New Chat',
  session_id           TEXT,
  profile_name         TEXT,
  model                TEXT,
  previous_response_id TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  reasoning       TEXT,
  tool_calls_json TEXT,
  run_id          TEXT,
  status          TEXT NOT NULL DEFAULT 'complete',
  error           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
  ON chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_run
  ON chat_messages(run_id) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated
  ON chat_conversations(updated_at);
