/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform, and chapter-title's new export is read through a loose require so this file loads before it exists */

// ═══════════════════════════════════════════════════════════════
// B14 oracle, group story-controls: the dead controls, the missing premise and
// the doubled heading (D90, D91, D92, and the reader heading the plan names).
// Contract sections 4.4, 4.5, 4.6 and 4.7.
//
// THE DEFECTS.
//   D90 EditChapterModal renders a six-band "Chapter Length" and a 2/3/4/5
//       "Chapters to Regenerate", and the reader posts both (page.tsx:187-188).
//       handleEditChapter destructures {storyId, chapterNumber, editPrompt}
//       (edit.ts:17) and reads neither, then invalidates EVERY downstream
//       chapter (edit.ts:61-63). Two controls that do nothing, and a blast
//       radius the one that does exist was meant to bound.
//   D91 ContinueStoryModal renders the same band and the reader posts
//       `wordCountRange` (page.tsx:219); handleContinue reads
//       {storyId, direction, count} (edit.ts:123). The chapters then generate
//       from `story.masterPrompt`, frozen at creation, so the length the
//       operator just chose cannot reach the model at all.
//   D92 StoryCard.tsx:47 and library/page.tsx:214 render `story.premise`;
//       rowToStory (story-repository.ts:47-63) never sets it -- the premise
//       lives at config.premise -- so both are dead branches.
//   +   chapterTitle falls back to exactly "Chapter N" (chapter-title.ts:26),
//       and ChapterReader renders "Chapter {n}: {title}" (ChapterReader.tsx:51),
//       so an un-retitled chapter reads "Chapter 1: Chapter 1".
//
// The database is a real in-memory better-sqlite3 on the baseline schema, so
// the repository, the handlers and the config round-trip are all real. Only
// callLLM is a double.
// ═══════════════════════════════════════════════════════════════

import { readFileSync } from "fs";
import { join } from "path";
import type DatabaseNs from "better-sqlite3";

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

const callLLMMock = jest.fn();
jest.mock("@/lib/llm", () => ({ callLLM: (...a: unknown[]) => callLLMMock(...a) }));

jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(() => ({ status: 500, body: { error: "boom" } })),
}));

jest.mock("next/server", () => ({
  NextResponse: class NextResponse {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      this.status = status;
      this.body = body;
    }
    async json() {
      return this.body;
    }
    static json(data: unknown, init?: ResponseInit) {
      return new NextResponse(init?.status ?? 200, data);
    }
  },
}));

import { handleEditChapter, handleContinue } from "@/modules/rec-room/handlers/edit";
import { createStory, getStory, listStories, type Story } from "@/modules/rec-room/lib/story-repository";

// ── pre-B14 shims ───────────────────────────────────────────────

/** `premise` is derived by rowToStory once the contract lands. */
const premiseOf = (s: Story | null): string | undefined =>
  (s as (Story & { premise?: string }) | null)?.premise;

/** The heading helper the contract adds to chapter-title.ts. */
function chapterHeading(): (n: number, t: string | undefined | null) => string {
  const mod = require("@/modules/rec-room/lib/chapter-title") as {
    chapterHeading?: (n: number, t: string | undefined | null) => string;
  };
  if (typeof mod.chapterHeading !== "function") {
    throw new Error("chapter-title exports no chapterHeading (contract 4.7)");
  }
  return mod.chapterHeading;
}

// ── fixtures ────────────────────────────────────────────────────

const MASTER = [
  "STORY CONFIGURATION:",
  "Title: A story",
  "Premise: salt and starlight",
  "Chapter Length: 1800-2500 words per chapter",
  "",
  "CHARACTERS:",
  "(none specified)",
].join("\n");

function seedStory(over: Partial<Parameters<typeof createStory>[0]> = {}): Story {
  return createStory({
    title: "A story",
    config: { premise: "salt and starlight", genre: "Sci-Fi" },
    masterPrompt: MASTER,
    storyArc: {
      storyArc: "A throughline",
      fixedPlotPoints: [],
      chapterOutlines: Array.from({ length: 6 }, (_, i) => ({
        number: i + 1,
        title: `Title ${i + 1}`,
        purpose: "Advance",
        keyBeats: [],
        emotionalTone: "Engaging",
      })),
    },
    chapters: Array.from({ length: 6 }, (_, i) => ({
      number: i + 1,
      title: `Title ${i + 1}`,
      status: "complete" as const,
      wordCount: 100,
    })),
    chapterContents: Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [String(i + 1), `Chapter ${i + 1} text.`]),
    ),
    status: "complete",
    ...over,
  });
}

/** Every user message callLLM was handed, in order. */
function userMessages(): string[] {
  return callLLMMock.mock.calls.map((c) => {
    const messages = c[0] as { role: string; content: string }[];
    return messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  });
}

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => RealDb)(":memory:");
  testDb.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  testDb.exec(
    readFileSync(join(process.cwd(), "src", "lib", "db", "migrations", "001_baseline.sql"), "utf-8"),
  );
  jest.clearAllMocks();
  callLLMMock.mockResolvedValue({ content: "Rewritten prose.", model: "m" });
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

// ═══════════════════════════════════════════════════════════════
// D90 — the Edit Chapter modal's two controls
// ═══════════════════════════════════════════════════════════════

describe("edit-chapter honours the chapter length it was sent", () => {
  it("puts the chosen band's word range in the prompt", async () => {
    const story = seedStory();
    await handleEditChapter({
      storyId: story.id,
      chapterNumber: 2,
      editPrompt: "make it darker",
      wordCountRange: "epic",
      count: 2,
    });

    // "epic" is 3500-5000 in the one word-range table (handlers/shared.ts:112),
    // and it is stated as a target rather than left to be inferred from the
    // master prompt's own (stale) Chapter Length line.
    expect(userMessages()[0]).toMatch(/Target length: 3500-5000 words/);
  });

  it("uses the standard band when the caller sends none", async () => {
    const story = seedStory();
    await handleEditChapter({ storyId: story.id, chapterNumber: 2, editPrompt: "darker" });
    expect(userMessages()[0]).toMatch(/Target length: 1800-2500 words/);
  });
});

describe("edit-chapter bounds what it invalidates", () => {
  it("regenerating 3 chapters leaves chapters 5 and 6 alone", async () => {
    const story = seedStory();
    await handleEditChapter({
      storyId: story.id,
      chapterNumber: 2,
      editPrompt: "darker",
      wordCountRange: "standard",
      count: 3,
    });

    const after = getStory(story.id)!;
    const byNumber = Object.fromEntries(after.chapters.map((c) => [c.number, c.status]));
    expect(byNumber).toEqual({
      1: "complete",
      2: "complete",
      3: "pending",
      4: "pending",
      5: "complete",
      6: "complete",
    });
  });

  it("a count larger than what is left does not reach past the last chapter", async () => {
    const story = seedStory();
    await handleEditChapter({
      storyId: story.id,
      chapterNumber: 5,
      editPrompt: "darker",
      count: 5,
    });

    const after = getStory(story.id)!;
    expect(after.chapters.map((c) => c.status)).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
      "complete",
      "pending",
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════
// D91 — the Continue modal's control
// ═══════════════════════════════════════════════════════════════

describe("continue honours the chapter length it was sent", () => {
  it("rewrites the master prompt's Chapter Length line and persists it", async () => {
    const story = seedStory();
    callLLMMock.mockResolvedValue({ content: "[]", model: "m" });

    await handleContinue({
      storyId: story.id,
      direction: "further out",
      count: 2,
      wordCountRange: "short",
    });

    const after = getStory(story.id)!;
    // The master prompt is what every later chapter is generated from, so the
    // length has to land THERE, not only in this one call.
    expect(after.masterPrompt).toMatch(/^Chapter Length: 800-1200 words per chapter$/m);
    expect(after.masterPrompt).not.toMatch(/1800-2500/);
    // Everything else about the prompt survives.
    expect(after.masterPrompt).toMatch(/Premise: salt and starlight/);
  });

  it("leaves the master prompt alone when no band was chosen", async () => {
    const story = seedStory();
    callLLMMock.mockResolvedValue({ content: "[]", model: "m" });

    await handleContinue({ storyId: story.id, direction: "further out", count: 2 });

    expect(getStory(story.id)!.masterPrompt).toBe(MASTER);
  });
});

// ═══════════════════════════════════════════════════════════════
// D92 — the premise on the wire
// ═══════════════════════════════════════════════════════════════

describe("a story carries its premise where the cards read it", () => {
  it("getStory derives premise from config", () => {
    const story = seedStory();
    expect(premiseOf(getStory(story.id))).toBe("salt and starlight");
  });

  it("listStories does too, which is what StoryCard and the library row render", () => {
    seedStory();
    const listed = listStories();
    expect(listed).toHaveLength(1);
    expect(premiseOf(listed[0])).toBe("salt and starlight");
  });

  it("a config with no premise leaves it undefined rather than inventing one", () => {
    const story = createStory({ title: "Bare", config: {}, chapters: [] });
    expect(premiseOf(getStory(story.id))).toBeUndefined();
  });

  it("the derived field is never written back into the row", () => {
    const story = seedStory();
    const raw = testDb!.prepare("SELECT config FROM stories WHERE id = ?").get(story.id) as {
      config: string;
    };
    expect(Object.keys(JSON.parse(raw.config))).toEqual(["premise", "genre"]);
  });
});

// ═══════════════════════════════════════════════════════════════
// the doubled heading
// ═══════════════════════════════════════════════════════════════

describe("chapterHeading never says the chapter's number twice", () => {
  it("drops the colon when the title IS the fallback name", () => {
    expect(chapterHeading()(1, "Chapter 1")).toBe("Chapter 1");
    expect(chapterHeading()(12, "chapter 12")).toBe("Chapter 12");
  });

  it("keeps a real title", () => {
    expect(chapterHeading()(2, "Salt and Starlight")).toBe("Chapter 2: Salt and Starlight");
  });

  it("falls back to the number when there is no title at all", () => {
    expect(chapterHeading()(3, "")).toBe("Chapter 3");
    expect(chapterHeading()(3, "   ")).toBe("Chapter 3");
    expect(chapterHeading()(3, undefined)).toBe("Chapter 3");
  });

  it("does not confuse one chapter's name for another's", () => {
    expect(chapterHeading()(4, "Chapter 9")).toBe("Chapter 4: Chapter 9");
  });
});
