# Control Hub — Agent Chat

The Chat page (`/orchestration/chat`) is a real conversation with your Hermes
agent: it runs over the same agent runtime as Missions, so the assistant can use
tools, remembers the conversation (via a Hermes session), and streams its work
live. This replaces the older localStorage-only chat that proxied raw model
completions.

## Two modes

- **Agent** (default) — each turn is a real agent **run** submitted through the
  runtime (`runtime.submitRun`). The agent has tools and memory; reasoning, tool
  calls, and the reply stream live into the bubble; tool gates can pause for your
  approval.
- **Fast** — a raw model completion straight from the gateway
  (`/api/orchestration/chat`). No tools, no run — just a quick answer. The turn
  is still persisted to the conversation so history stays unified.

Toggle modes in the chat header. The model selector is shown in Fast mode (Agent
mode uses the active profile's model).

## Persistence (schema v13)

Conversations are server-side, not localStorage:

- **`chat_conversations`** — one row per thread, mapped to a Hermes **session**
  (`session_id`) for memory continuity; stores `profile_name`, `model`, and
  `previous_response_id` (multi-turn).
- **`chat_messages`** — user/assistant turns. An assistant turn is linked to the
  Control Hub **run** that produced it (`run_id`) and carries `reasoning`,
  `tool_calls_json`, and a `status` (`pending → streaming → complete | failed |
  cancelled`).

Migration: `013_chat.sql` + `apply-chat-migration.ts`, wired into
`runMigrations()` (see [MIGRATION.md](./MIGRATION.md)). Repository:
`src/lib/chat-repository.ts`.

## Request flow (Agent mode)

1. `POST /api/chat` → create a conversation + a Hermes session
   (`runtime.createSession`).
2. `POST /api/chat/[id]/messages` → persist the user message, then
   `dispatchChatTurn` mirrors `dispatchMissionRun`: `createRun` →
   `runtime.submitRun({ input, sessionId, previousResponseId, profileName })` →
   `attachBackendRun`. Returns the **Control Hub run id**.
3. The client opens **`GET /api/runs/[runId]/events`** (the shared SSE proxy) and
   renders events: `message.delta` → reply, `reasoning.*` → a collapsible
   "Reasoning" panel, `tool.*` → tool-call cards, `tool.approval_required` → an
   approve/deny gate, `run.completed` → finalize.
4. On completion the client persists the final turn via
   `PATCH /api/chat/[id]/messages/[messageId]`.

`POST /api/chat/[id]/stop` cancels the active run; `POST /api/chat/[id]/approval`
forwards a tool-approval decision (`runtime.resolveApproval`).

## Robustness

- **No stuck "Thinking…".** The bubble's empty state is driven by message
  `status`, not "content is empty" — a completed-but-empty, failed, or cancelled
  run shows an explicit terminal state, never a permanent placeholder.
- **Self-healing.** `GET /api/chat/[id]` reconciles any assistant turn still
  `pending`/`streaming` whose underlying run has reached a terminal state
  (e.g. the client disconnected mid-stream): it copies the run's output onto the
  message (`reconcilePendingChatMessages`). The background RunSync writes the run
  row; the load path folds it onto the message.

## Analytics

Each turn records a `chat.message_sent` event (category `chat`), so chat shows up
in Insights alongside missions, schedules, and stories.

## Verification

The agent-chat flow is covered end-to-end by the real-Hermes gate
(`npm run test:e2e-hermes`, section 9 of the full-stack smoke): create
conversation → send an agent turn → reconcile the run → assert the assistant turn
finalizes from the run output, plus `chat.message_sent` analytics and cascade
delete. Unit tests cover the dispatch (`chat-dispatch.test.ts`), the repository
(`chat-repository.test.ts`), the v13 migration (`chat-migration.test.ts`), and
the run-event parsing helpers (`chat-run-events.test.ts`).
