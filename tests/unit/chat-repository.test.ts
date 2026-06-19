/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @jest-environment node
 *
 * Tests for the agent-chat persistence repository (src/lib/chat-repository.ts),
 * driven against a real in-memory SQLite DB seeded with the baseline schema +
 * the v13 chat migration. `@/lib/db` is mocked so the repo's `db()` calls hit
 * the test DB; `inTransaction` is stubbed to run the callback directly.
 */
import type Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";

import type * as ChatRepo from "@/lib/chat-repository";

const migrationsDir = join(__dirname, "..", "..", "src", "lib", "db", "migrations");
const baselineSql = readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8");
const chatSql = readFileSync(join(migrationsDir, "013_chat.sql"), "utf-8");

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

interface TestDatabase {
  db: Database.Database;
  close: () => void;
}

function makeTestDatabase(): TestDatabase {
  const RealDatabase = loadRealBetterSqlite3();
  const db = new (RealDatabase as unknown as new (path: string) => Database.Database)(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(baselineSql);
  db.exec(chatSql);
  return { db, close: () => db.close() };
}

describe("chat-repository", () => {
  let tdb: TestDatabase;
  let repo: typeof ChatRepo;

  beforeEach(() => {
    tdb = makeTestDatabase();
    jest.resetModules();
    jest.doMock("@/lib/db", () => {
      const actual = jest.requireActual("@/lib/db");
      return {
        ...actual,
        db: () => tdb.db,
        inTransaction: (fn: () => unknown) => fn(),
      };
    });
    repo = require("@/lib/chat-repository") as typeof ChatRepo;
  });

  afterEach(() => {
    tdb.close();
    jest.resetModules();
    jest.dontMock("@/lib/db");
  });

  it("creates a conversation with defaults and round-trips it", () => {
    const c = repo.createConversation({ profileName: "bob", model: "gpt" });
    expect(c).toMatchObject({ title: "New Chat", profileName: "bob", model: "gpt" });
    expect(c.id).toBeTruthy();
    expect(repo.getConversation(c.id)?.id).toBe(c.id);
  });

  it("appends messages in order and loads them with the conversation", () => {
    const c = repo.createConversation({ title: "Thread" });
    repo.createMessage({ conversationId: c.id, role: "user", content: "hello" });
    repo.createMessage({ conversationId: c.id, role: "assistant", content: "", status: "pending" });

    const loaded = repo.getConversationWithMessages(c.id);
    expect(loaded?.messages).toHaveLength(2);
    expect(loaded?.messages[0]).toMatchObject({ role: "user", content: "hello" });
    expect(loaded?.messages[1]).toMatchObject({ role: "assistant", status: "pending" });
  });

  it("updates an assistant message (streaming content + reasoning + tool calls + status)", () => {
    const c = repo.createConversation();
    const m = repo.createMessage({
      conversationId: c.id,
      role: "assistant",
      runId: "run-1",
      status: "streaming",
    });

    repo.updateMessage(m.id, {
      content: "final answer",
      reasoning: "thought about it",
      toolCalls: [{ name: "search", status: "completed", result: { hits: 3 } }],
      status: "complete",
    });

    const updated = repo.getMessage(m.id);
    expect(updated).toMatchObject({ content: "final answer", reasoning: "thought about it", status: "complete" });
    expect(updated?.toolCalls).toEqual([{ name: "search", status: "completed", result: { hits: 3 } }]);
  });

  it("finds an assistant message by its run id", () => {
    const c = repo.createConversation();
    repo.createMessage({ conversationId: c.id, role: "assistant", runId: "run-xyz", status: "pending" });
    expect(repo.getMessageByRunId("run-xyz")?.runId).toBe("run-xyz");
    expect(repo.getMessageByRunId("nope")).toBeNull();
  });

  it("lists conversations most-recently-updated first", () => {
    const a = repo.createConversation({ title: "A" });
    const b = repo.createConversation({ title: "B" });
    // Stamp distinct updated_at values (createConversation calls land within the
    // same millisecond, so wall-clock ordering would tie and be non-deterministic).
    // `a` is the more recently touched conversation and must sort first.
    tdb.db.prepare("UPDATE chat_conversations SET updated_at = ? WHERE id = ?").run("2026-01-01T00:00:01.000Z", a.id);
    tdb.db.prepare("UPDATE chat_conversations SET updated_at = ? WHERE id = ?").run("2026-01-01T00:00:00.000Z", b.id);

    const ids = repo.listConversations().map((c) => c.id);
    expect(ids[0]).toBe(a.id);
    expect(ids[1]).toBe(b.id);
  });

  it("deletes a conversation and cascades its messages", () => {
    const c = repo.createConversation();
    repo.createMessage({ conversationId: c.id, role: "user", content: "x" });
    expect(repo.deleteConversation(c.id)).toBe(true);
    expect(repo.getConversation(c.id)).toBeNull();
    expect(repo.getMessages(c.id)).toHaveLength(0);
  });

  it("persists session + previousResponseId for multi-turn continuity", () => {
    const c = repo.createConversation({ sessionId: "sess-1" });
    repo.updateConversation(c.id, { previousResponseId: "resp-1", title: "Renamed" });
    const updated = repo.getConversation(c.id);
    expect(updated).toMatchObject({ sessionId: "sess-1", previousResponseId: "resp-1", title: "Renamed" });
  });
});
