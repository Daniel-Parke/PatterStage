---
summary: The Chat page, its Agent and Fast modes, and how a turn becomes a real agent run
type: guide
tags: [product, chat]
compiled_from: normalised
---

# PatterStage: Agent Chat

The Chat page (`/orchestration/chat`) is a real conversation with your Hermes
agent: it runs over the same agent runtime as Missions, so the assistant can use
tools, remembers the conversation (via a Hermes session), and streams its work
live. This replaces the older localStorage-only chat that proxied raw model
completions.

## Two modes

- **Agent** (default): each turn is a real agent **run** submitted through the
  runtime (`runtime.submitRun`). The agent has tools and memory; reasoning, tool
  calls, and the reply stream live into the bubble; tool gates can pause for your
  approval.
- **Fast:** a raw model completion straight from the gateway
  (`/api/orchestration/chat`). No tools, no run, just a quick answer. The turn
  is still persisted to the conversation so history stays unified.

Toggle modes in the chat header. The model selector is shown in Fast mode (Agent
mode uses the active profile's model).

## Persistence (schema v13)

Conversations are server-side, not localStorage:

- **`chat_conversations`**: one row per thread, mapped to a Hermes **session**
  (`session_id`) for memory continuity; stores `profile_name`, `model`, and
  `previous_response_id` (multi-turn).
- **`chat_messages`**: user/assistant turns. An assistant turn is linked to the
  PatterStage **run** that produced it (`run_id`) and carries `reasoning`,
  `tool_calls_json`, and a `status` (`pending → streaming → complete | failed |
  cancelled`).

Migration: `013_chat.sql` + `apply-chat-migration.ts`, wired into
`runMigrations()` (see [MIGRATION.md](./MIGRATION.md)). Repository:
`src/lib/chat-repository.ts`.

**Retention (v32, [ADR-0009](../org/decisions/ADR-0009-retention-for-the-readings-tables.md)).**
Conversations have a declared window of **365 days of inactivity**, and the unit
is the whole conversation, never the individual turn: a transcript that starts in
the middle is worse than either keeping it or dropping it, so one recent turn
keeps every older turn with it. The prune ships **disabled** on every install and
is a command an operator runs by hand (`npm run db:retention`). Nothing in the
Chat surface deletes a message on a timer.

## Request flow (Agent mode)

1. `POST /api/chat` → create a conversation + a Hermes session
   (`runtime.createSession`).
2. `POST /api/chat/[id]/messages` → persist the user message, then
   `dispatchChatTurn` mirrors `dispatchMissionRun`: `createRun` →
   `runtime.submitRun({ input, sessionId, previousResponseId, profileName })` →
   `attachBackendRun`. Returns the **PatterStage run id**.
3. The client opens **`GET /api/runs/[runId]/events`** (the shared SSE proxy) and
   renders events: `message.delta` → reply, `reasoning.*` → a collapsible
   "Reasoning" panel, `tool.*` → tool-call cards, `tool.approval_required` → an
   approve/deny gate, `run.completed` → finalize.
4. On completion the client persists the final turn via
   `PATCH /api/chat/[id]/messages/[messageId]`.

`POST /api/chat/[id]/stop` cancels the active run; `POST /api/chat/[id]/approval`
forwards a tool-approval decision (`runtime.resolveApproval`).

## Robustness

- **The empty bubble is driven by `status`, not by "content is empty".** A
  completed-but-empty, failed, or cancelled turn renders an explicit terminal
  state rather than a placeholder. An assistant row still `pending`/`streaming`
  with no content renders the literal "Thinking…", so the guarantee that it is
  never permanent rests entirely on something moving that row to a terminal
  status. In **Agent** mode two mechanisms do; in **Fast** mode only the third
  does, and only after 30 minutes.
- **Self-healing (Agent mode).** `GET /api/chat/[id]` reconciles any assistant
  turn still `pending`/`streaming` whose underlying run has reached a terminal
  state (e.g. the client disconnected mid-stream): it copies the run's output
  onto the message (`reconcilePendingChatMessages`). The background RunSync
  writes the run row; the load path folds it onto the message. This can only
  heal a turn that **has** a run: the loop skips every message with a null
  `run_id`.
- **The Fast-mode gap.** `appendFastTurn` inserts the assistant row as
  `streaming` with no `run_id`, and only the client's finalize `PATCH` moves it
  off. Close the tab mid-stream and the row stays `streaming`. Pressing Stop
  does not rescue it either, because `POST /api/chat/[id]/stop` only considers
  assistant turns that carry a `runId` and otherwise answers
  `{ stopped: false, reason: "no active run" }`. There is nothing for it to
  cancel.
- **Boot sweep (T-0052).** On startup, `failStuckChatMessages()` fails any
  assistant turn still `pending`/`streaming` after 30 minutes **whose run is
  NULL or has been pruned**, with a reason the bubble can show. That covers both
  wedges: the Fast-mode turn that never had a run, and the agent turn whose run
  was pruned out from under the reconciler. A row whose run still exists is
  deliberately left alone at any age, because sweeping it would race a live
  agent turn that is simply taking its time. That one belongs to the reconciler.

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
