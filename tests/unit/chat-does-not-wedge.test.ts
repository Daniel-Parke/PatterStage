/**
 * @jest-environment node
 *
 * T-0052 acceptance oracle — a chat turn always reaches a terminal state.
 *
 * The live QA pass saw assistant rows with `status: "failed", error: null` and
 * one stuck at `"streaming"` for over fifteen seconds showing "No response". It
 * guessed the cause was environmental. Half right: the trigger is usually a
 * gateway that returned nothing, but the reason it looks like a silent failure
 * and never heals is app code, in three places.
 *
 * 1. THE REASON IS DISPLAYED AND NEVER SAVED. `useChatSend` finalises fast mode
 *    with `{ content, status }` and omits `error`, although `finalizeMessageApi`
 *    accepts it and the PATCH route persists it. Agent mode gets this right.
 *    So the UI shows "No response" until you reload, and then shows nothing.
 *
 * 2. FAST-MODE ROWS WEDGE FOREVER. `reconcilePendingChatMessages` skips any row
 *    with no `runId`, and fast mode never has one. There is no timer and no boot
 *    sweep. Deep Research got `failStuckResearchRuns` for exactly this shape;
 *    chat got nothing, so a tab closed mid-stream leaves a row `streaming` for
 *    the life of the database.
 *
 * 3. `undefined` MEANS "LEAVE UNCHANGED" in both writers, so a failed run
 *    carrying a null error can never populate the message's error column, which
 *    compounds (1) into the same visible symptom.
 *
 * A row whose run has been pruned is the same wedge by a different route: the
 * reconciler looks the run up, finds nothing, and moves on forever.
 */

import { join } from "path";

import type DatabaseNs from "better-sqlite3";

type RealDb = DatabaseNs.Database;

let testDb: RealDb | null = null;

jest.mock("@/lib/db", () => ({
  getDb: () => testDb!,
  ensureDb: () => undefined,
  uuid: () => `id-${Math.random().toString(36).slice(2)}`,
  now: () => new Date().toISOString(),
  inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
}));

// `better-sqlite3` is itself mapped to a stub in jest.config.js, so importing it
// normally here yields a no-op driver that silently swallows every write. The
// repository tests in this repo all reach past the mapper for the real driver;
// this one has to as well, or the assertions run against nothing.
const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;

import {
  createConversation,
  createMessage,
  failStuckChatMessages,
  getMessage,
  getMessages,
} from "@/lib/chat-repository";

/** Minimal schema: the two chat tables plus the runs table the sweep consults. */
beforeAll(() => {
  testDb = new Database(":memory:");
  testDb.exec(`
    CREATE TABLE chat_conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Chat',
      session_id TEXT,
      profile_name TEXT,
      model TEXT,
      previous_response_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE chat_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      reasoning TEXT,
      tool_calls_json TEXT,
      run_id TEXT,
      status TEXT NOT NULL DEFAULT 'complete',
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE runs (id TEXT PRIMARY KEY, status TEXT);
  `);
});

afterAll(() => {
  testDb?.close();
});

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

let conversationId = "";
beforeEach(() => {
  testDb!.exec("DELETE FROM chat_messages; DELETE FROM chat_conversations; DELETE FROM runs;");
  conversationId = createConversation({ title: "t" }).id;
});

/** An assistant row in a non-terminal state, planted at a chosen age. */
function planted(opts: { status: string; minutesAgo: number; runId?: string | null }) {
  const id = `m-${Math.random().toString(36).slice(2)}`;
  testDb!
    .prepare(
      `INSERT INTO chat_messages (id, conversation_id, role, status, run_id, created_at, updated_at)
       VALUES (?, ?, 'assistant', ?, ?, ?, ?)`,
    )
    .run(id, conversationId, opts.status, opts.runId ?? null, ago(opts.minutesAgo), ago(opts.minutesAgo));
  return id;
}

describe("a fast-mode turn that never finished is eventually failed", () => {
  it("sweeps a streaming row with no run behind it", () => {
    const id = planted({ status: "streaming", minutesAgo: 60 });
    expect(failStuckChatMessages()).toBe(1);
    const m = getMessage(id);
    expect(m?.status).toBe("failed");
    expect(m?.error).toBeTruthy();
  });

  it("sweeps a pending row the same way", () => {
    const id = planted({ status: "pending", minutesAgo: 60 });
    failStuckChatMessages();
    expect(getMessage(id)?.status).toBe("failed");
  });

  it("says WHY, so a reload does not show a failure with no reason", () => {
    const id = planted({ status: "streaming", minutesAgo: 60 });
    failStuckChatMessages();
    expect(getMessage(id)?.error).toMatch(/interrupted|did not finish/i);
  });

  it("leaves a RECENT row alone, because it may still be streaming", () => {
    const id = planted({ status: "streaming", minutesAgo: 1 });
    expect(failStuckChatMessages()).toBe(0);
    expect(getMessage(id)?.status).toBe("streaming");
  });

  it("never touches a row that already reached a terminal state", () => {
    const id = planted({ status: "complete", minutesAgo: 999 });
    failStuckChatMessages();
    expect(getMessage(id)?.status).toBe("complete");
  });
});

describe("a run-backed turn belongs to the reconciler, not the sweep", () => {
  it("leaves an old row alone while its run still exists", () => {
    // Even a long-running agent turn is the reconciler's business: it can see
    // the run and fold its result on. Sweeping it here would race that.
    testDb!.prepare("INSERT INTO runs (id, status) VALUES ('r1','started')").run();
    const id = planted({ status: "streaming", minutesAgo: 600, runId: "r1" });
    expect(failStuckChatMessages()).toBe(0);
    expect(getMessage(id)?.status).toBe("streaming");
  });

  it("DOES sweep a row whose run has been pruned away", () => {
    // The same permanent wedge by a different route: the reconciler looks the
    // run up, finds nothing, and moves on. Forever.
    const id = planted({ status: "streaming", minutesAgo: 600, runId: "gone" });
    expect(failStuckChatMessages()).toBe(1);
    expect(getMessage(id)?.status).toBe("failed");
  });
});

describe("the sweep is bounded and honest about what it did", () => {
  it("returns the number it changed", () => {
    planted({ status: "streaming", minutesAgo: 60 });
    planted({ status: "pending", minutesAgo: 60 });
    planted({ status: "streaming", minutesAgo: 1 });
    expect(failStuckChatMessages()).toBe(2);
  });

  it("is idempotent: a second pass changes nothing", () => {
    planted({ status: "streaming", minutesAgo: 60 });
    expect(failStuckChatMessages()).toBe(1);
    expect(failStuckChatMessages()).toBe(0);
  });

  it("takes its deadline from the caller", () => {
    planted({ status: "streaming", minutesAgo: 10 });
    expect(failStuckChatMessages(30)).toBe(0);
    expect(failStuckChatMessages(5)).toBe(1);
  });

  it("leaves other conversations' rows alone when they are healthy", () => {
    const good = createMessage({
      conversationId,
      role: "assistant",
      content: "done",
      status: "complete",
    });
    planted({ status: "streaming", minutesAgo: 60 });
    failStuckChatMessages();
    expect(getMessage(good.id)?.status).toBe("complete");
    expect(getMessages(conversationId).length).toBe(2);
  });
});
