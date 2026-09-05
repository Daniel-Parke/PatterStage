/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform */

// ═══════════════════════════════════════════════════════════════
// B14 sweep answer: three mutants the first pass left alive.
//
//   1. `createSpendRun` writes `story_id`. Every oracle so far MOCKED that
//      function, so a version that dropped the id and recorded an unattributable
//      row passed every one of them. This file drives the real SQL.
//   2. `recordSpend` writes NO row for an answer that reported zero tokens.
//      The `!response.usage` guard was covered; the zero-token guard beside it
//      was not, and a zero-token row is a real cost reported as free.
//   3. `callLLM` refuses a call whose signal is ALREADY aborted, and links a
//      later abort to the request it made. Both were covered only through the
//      page, where the page's own state made either behaviour look the same.
//
// The database is real; the provider is a double.
// ═══════════════════════════════════════════════════════════════

import type DatabaseNs from "better-sqlite3";

import { execBaselineSchema } from "../helpers/baseline-db";

type RealDb = DatabaseNs.Database;
let testDb: RealDb | null = null;

jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    getDb: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

import { createSpendRun } from "@/lib/runs-repository";

interface RawRun {
  id: string;
  story_id: string | null;
  spend_source: string;
  usage_json: string | null;
  status: string;
}

function runs(): RawRun[] {
  return testDb!.prepare("SELECT id, story_id, spend_source, usage_json, status FROM runs").all() as RawRun[];
}

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => RealDb)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  // The link is a real FK, so the story has to exist for the row to land.
  testDb.prepare("INSERT INTO stories (id, title) VALUES (?, ?)").run("S-1", "A story");
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

// ═══════════════════════════════════════════════════════════════
// (1) the row a story writes
// ═══════════════════════════════════════════════════════════════

describe("createSpendRun writes a row that says whose money it was", () => {
  it("carries the source and the story id", () => {
    createSpendRun({
      source: "story",
      storyId: "S-1",
      usage: { inputTokens: 900, outputTokens: 300, totalTokens: 1200 },
    });

    const [row] = runs();
    expect(row.spend_source).toBe("story");
    // Without this the row is real spend nobody can attribute: the console
    // would show the money and no story would own it.
    expect(row.story_id).toBe("S-1");
    expect(row.status).toBe("completed");
    expect(JSON.parse(row.usage_json!)).toEqual({ inputTokens: 900, outputTokens: 300, totalTokens: 1200 });
  });

  it("a source with no story leaves the link null rather than inventing one", () => {
    createSpendRun({ source: "agent", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } });
    expect(runs()[0].story_id).toBeNull();
  });

  it("never throws at the caller: a broken write is logged, not raised", () => {
    testDb!.exec("DROP TABLE runs");
    expect(() =>
      createSpendRun({ source: "story", storyId: "S-1", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }),
    ).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// (2) + (3) what callLLM records, and what it refuses
// ═══════════════════════════════════════════════════════════════

describe("callLLM", () => {
  const fetchMock = jest.fn();
  let callLLM: typeof import("@/lib/llm").callLLM;

  function answer(usage: unknown) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "words" } }], usage }),
      text: async () => "",
    };
  }

  beforeEach(() => {
    jest.resetModules();
    fetchMock.mockReset();
    (globalThis as { fetch?: unknown }).fetch = fetchMock;
    jest.doMock("@/lib/models-repository", () => ({
      getModelWithKey: () => ({
        id: "m-1",
        modelId: "test/model",
        provider: "openai",
        baseUrl: "https://example.invalid/v1",
        apiKey: "k",
        apiStyle: "openai",
      }),
      getDefaultModelForTask: () => null,
    }));
    // The gateway path is not what this file is about: a resolved direct model
    // means callLLM never reaches for one.
    callLLM = (require("@/lib/llm") as typeof import("@/lib/llm")).callLLM;
  });

  it("records nothing when the provider reported zero tokens", async () => {
    fetchMock.mockResolvedValue(answer({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }));

    await callLLM([{ role: "user", content: "hi" }], {
      modelId: "m-1",
      spend: { source: "story", storyId: "S-1" },
    });

    // A zero-token row is a real cost reported as free, which is the one thing
    // the spend doctrine forbids everywhere else.
    expect(runs()).toHaveLength(0);
  });

  it("records a row when the provider reported tokens", async () => {
    fetchMock.mockResolvedValue(answer({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }));

    await callLLM([{ role: "user", content: "hi" }], {
      modelId: "m-1",
      spend: { source: "story", storyId: "S-1" },
    });

    expect(runs()).toHaveLength(1);
    expect(runs()[0].story_id).toBe("S-1");
  });

  it("refuses a call whose signal is already aborted, before it makes one", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      callLLM([{ role: "user", content: "hi" }], { modelId: "m-1", signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });

    // Leaving this to fetch makes "stopped" depend on how far the request had
    // got, and on a provider that ignores the signal it means nothing at all.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(runs()).toHaveLength(0);
  });

  it("hands the request a signal that the caller's abort actually trips", async () => {
    const controller = new AbortController();
    let seen: AbortSignal | undefined;
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      seen = init.signal ?? undefined;
      return answer({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 });
    });

    await callLLM([{ role: "user", content: "hi" }], { modelId: "m-1", signal: controller.signal });

    expect(seen).toBeDefined();
    expect(seen!.aborted).toBe(false);
    controller.abort();
    // The link is what makes Stop stop the call rather than only the loop.
    expect(seen!.aborted).toBe(true);
  });
});
