/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform, and the modules under test do not all exist yet */

// ═══════════════════════════════════════════════════════════════
// Real-round oracle, group story-spend: a story says what it costs.
//
// THE DEFECT. Story generation calls a paid model and the Rec Room says
// nothing about it, before, during or after. The spend IS recorded: llm.ts
// writes a `runs` row through `createSpendRun` with `story_id` and
// `spend_source = 'story'`, and the console's Story Weaver row counts it. The
// number simply never reaches the page where the money is being spent.
//
// THE CONTRACT.
//   - `recordedSpendForStory(storyId)` answers what ONE story has cost, in the
//     same `SpendWindowSource` shape the console's per-source row uses.
//   - It is the SAME arithmetic, not a second one. This file pins the sum of
//     the per-story figures against the console's own Story Weaver row for the
//     same rows, because two money figures that disagree is a defect this
//     programme has already fixed once (T-0108, D104).
//   - A story nobody has spent on answers zero runs and $0.00 rather than
//     throwing or answering null, so the reader has something honest to draw
//     before the first chapter.
//   - The `spend` action on /api/stories hands that figure to the reader.
//
// The database is real. Nothing here is mocked except the db accessor itself.
// ═══════════════════════════════════════════════════════════════

import type DatabaseNs from "better-sqlite3";

import { openBaselineDb } from "../helpers/baseline-db";

type RealDb = DatabaseNs.Database;
let testDb: RealDb | null = null;

jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));

jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn() }));

import { createSpendRun } from "@/lib/runs/runs-repository";
import { recordedSpendSince } from "@/lib/spend/spend-window";

interface StorySpendModule {
  recordedSpendForStory: (storyId: string) => {
    source: string;
    label: string;
    runs: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number | null;
    recorded: boolean;
  };
}

/** Required lazily: the export is what this oracle is for, so a static import
 *  would be a typecheck error rather than the runtime red it should start as. */
function spendWindow(): StorySpendModule {
  return require("@/lib/spend/spend-window") as StorySpendModule;
}

interface SpendHandlerModule {
  handleStorySpend: (body: Record<string, unknown>) => Promise<{ status: number; json: () => Promise<unknown> }>;
}

function handlers(): SpendHandlerModule {
  return require("@/modules/rec-room/handlers/spend") as SpendHandlerModule;
}

/** The window every assertion below reads: long before any row was written. */
const EARLY = "2000-01-01 00:00:00";

beforeEach(() => {
  testDb = openBaselineDb();
  // recordedSpendSince reads research_runs too, and 019 is not part of the
  // squashed baseline. Only the four columns the spend read names are needed.
  testDb.exec(`
    CREATE TABLE research_runs (
      id                TEXT PRIMARY KEY,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      prompt_tokens     INTEGER,
      completion_tokens INTEGER,
      model_id          TEXT
    );
  `);
  // The story link is a real FK, so the rows have somewhere to point.
  testDb.prepare("INSERT INTO stories (id, title) VALUES (?, ?)").run("S-1", "Salt and starlight");
  testDb.prepare("INSERT INTO stories (id, title) VALUES (?, ?)").run("S-2", "Rust and rain");
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

/** Spend one call's worth of tokens against a story, the way llm.ts does. */
function spend(storyId: string | null, inputTokens: number, outputTokens: number): void {
  createSpendRun({
    source: storyId ? "story" : "agent",
    storyId,
    usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
  });
}

// ═══════════════════════════════════════════════════════════════
// (A) what one story cost
// ═══════════════════════════════════════════════════════════════

describe("recordedSpendForStory", () => {
  it("totals only the runs that belong to that story", () => {
    spend("S-1", 500_000, 100_000); // 0.5 + 0.3 at the conservative default rate
    spend("S-1", 300_000, 200_000); // 0.3 + 0.6
    spend("S-2", 100_000, 100_000);
    spend(null, 900_000, 900_000); // an agent run: not this story's money

    const s1 = spendWindow().recordedSpendForStory("S-1");
    expect(s1.runs).toBe(2);
    expect(s1.inputTokens).toBe(800_000);
    expect(s1.outputTokens).toBe(300_000);
    expect(s1.costUsd).toBeCloseTo(1.7, 6);
    expect(s1.recorded).toBe(true);
  });

  it("answers zero for a story nothing has been spent on, not null and not a throw", () => {
    const fresh = spendWindow().recordedSpendForStory("S-2");
    expect(fresh.runs).toBe(0);
    expect(fresh.costUsd).toBe(0);
    // False would mean "we do not know what this cost". Nothing was spent, and
    // that is a measurement, so the reader may state it as one.
    expect(fresh.recorded).toBe(true);
  });

  it("answers zero for a story id nobody has ever heard of", () => {
    expect(spendWindow().recordedSpendForStory("nope").runs).toBe(0);
  });

  it("skips a run whose usage JSON will not parse, exactly as the console does", () => {
    spend("S-1", 500_000, 100_000);
    testDb!
      .prepare(
        `INSERT INTO runs (id, story_id, spend_source, status, usage_json, submitted_at, updated_at)
         VALUES ('broken', 'S-1', 'story', 'completed', '{not json', datetime('now'), datetime('now'))`,
      )
      .run();

    const s1 = spendWindow().recordedSpendForStory("S-1");
    // Counted nowhere rather than guessed at: inventing a number here would be
    // the same lie as pricing an unrecorded run at zero.
    expect(s1.runs).toBe(1);
    expect(s1.costUsd).toBeCloseTo(0.8, 6);
  });
});

// ═══════════════════════════════════════════════════════════════
// (B) the reader's figure and the console's row are ONE number
// ═══════════════════════════════════════════════════════════════

describe("the per-story figure agrees with the spend console", () => {
  it("sums to exactly the Story Weaver row the console shows", () => {
    spend("S-1", 500_000, 100_000);
    spend("S-1", 300_000, 200_000);
    spend("S-2", 100_000, 100_000);
    spend(null, 900_000, 900_000);

    const consoleRow = recordedSpendSince(EARLY).sources.find((s) => s.source === "story")!;
    const perStory = ["S-1", "S-2"].map((id) => spendWindow().recordedSpendForStory(id));

    expect(perStory.reduce((n, s) => n + s.runs, 0)).toBe(consoleRow.runs);
    expect(perStory.reduce((n, s) => n + (s.costUsd ?? 0), 0)).toBeCloseTo(consoleRow.costUsd ?? 0, 10);
  });

  it("prices a story run the way the console prices it, with no model of its own", () => {
    spend("S-1", 1_000_000, 1_000_000);

    const consoleRow = recordedSpendSince(EARLY).sources.find((s) => s.source === "story")!;
    // A story run carries no model dimension (no mission to join), so both
    // reads land on model-cost's conservative default. Resolving the story's
    // configured model HERE and not there is how the two numbers would part.
    expect(spendWindow().recordedSpendForStory("S-1").costUsd).toBeCloseTo(consoleRow.costUsd ?? 0, 10);
  });
});

// ═══════════════════════════════════════════════════════════════
// (C) the reader can ask for it
// ═══════════════════════════════════════════════════════════════

describe("the spend action on /api/stories", () => {
  it("answers the figure for the story it was asked about", async () => {
    spend("S-1", 500_000, 100_000);

    const res = await handlers().handleStorySpend({ storyId: "S-1" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { spend: { runs: number; costUsd: number } } };
    expect(body.data.spend.runs).toBe(1);
    expect(body.data.spend.costUsd).toBeCloseTo(0.8, 6);
  });

  it("refuses a request with no story id", async () => {
    const res = await handlers().handleStorySpend({});
    expect(res.status).toBe(400);
  });

  it("says so when the story does not exist, rather than reporting a confident zero", async () => {
    const res = await handlers().handleStorySpend({ storyId: "ghost" });
    expect(res.status).toBe(404);
  });
});
