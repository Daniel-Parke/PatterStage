/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- hoisted singleton fixture */
// T-0189 independent oracle: display defaults are not stored-data repairs.
import { openBaselineDb, type RealDb } from "../helpers/baseline-db";

let testDb: RealDb | null = null;
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));

import {
  createStory, getStory, listStories, updateStory, deleteStory, reconcileStoriesOnBoot,
  type StoryChapter,
} from "@/modules/rec-room/lib/story-repository";

const complete: StoryChapter = { number: 1, title: "One", status: "complete", wordCount: 92, generatedAt: "2026-10-01T10:00:00Z", error: "Preserve prior nonwriting annotation" };
const writing = {
  number: 2, title: "Two", status: "writing" as const, wordCount: 17,
  generatedAt: "2026-10-01T11:00:00Z", error: "Replace prior writing error", extension: { outline: ["retain", "all"] },
};
const arc = { storyArc: "Homeward", fixedPlotPoints: [], chapterOutlines: [] };
const objectFields = [
  { column: "config", field: "config", fallback: {} },
  { column: "chapter_contents", field: "chapterContents", fallback: {} },
  { column: "story_arc", field: "storyArc", fallback: undefined },
] as const;
const invalidObjects = ["{broken", "null", "[]", '"text"', "17", "true"];
const invalidChapters = ["{broken", "null", "{}", '"text"', "17", "true"];

beforeEach(() => { testDb = openBaselineDb(); });
afterEach(() => { testDb?.close(); testDb = null; });

function seed(status: "active" | "generating" = "active") {
  return createStory({
    title: "Oracle story", config: { premise: "A safe return", genre: "fiction" },
    masterPrompt: "Retain the prompt", storyArc: arc,
    chapters: [complete], chapterContents: { "1": "Original prose" }, status,
  });
}
function put(id: string, column: string, raw: string): void {
  // Column names only come from the fixed oracle cases below.
  testDb!.prepare(`UPDATE stories SET ${column} = ? WHERE id = ?`).run(raw, id);
}
function rawRow(id: string): Record<string, unknown> {
  return testDb!.prepare("SELECT * FROM stories WHERE id = ?").get(id) as Record<string, unknown>;
}
function jsonColumns(id: string) {
  const row = rawRow(id);
  return { config: row.config, chapters: row.chapters, story_arc: row.story_arc, chapter_contents: row.chapter_contents };
}

describe("T-0189 story boundaries", () => {
  it("round-trips valid content and derives premise on both read boundaries", () => {
    const story = seed();
    expect(getStory(story.id)).toEqual(story);
    expect(listStories()).toEqual([story]);
    expect(story).toMatchObject({ premise: "A safe return", storyArc: arc, chapters: [complete], chapterContents: { "1": "Original prose" } });
    expect(JSON.parse(String(rawRow(story.id).config))).toEqual({ premise: "A safe return", genre: "fiction" });
  });
  it("excludes deleted rows from reads, updates and restart recovery", () => {
    const story = seed("generating");
    expect(deleteStory(story.id)).toBe(true);
    const before = rawRow(story.id);
    expect(getStory(story.id)).toBeNull();
    expect(listStories()).toEqual([]);
    expect(updateStory(story.id, { title: "Resurrected" })).toBeNull();
    expect(reconcileStoriesOnBoot()).toEqual({ failedStories: 0, failedChapters: 0 });
    expect(rawRow(story.id)).toEqual(before);
  });
  it.each(objectFields.flatMap((entry) => invalidObjects.map((raw) => ({ ...entry, raw }))))(
    "$field displays its safe default for $raw without writing raw bytes", ({ column, field, fallback, raw }) => {
      const story = seed();
      put(story.id, column, raw);
      const before = rawRow(story.id);
      expect(() => getStory(story.id)).not.toThrow();
      expect(getStory(story.id)?.[field]).toEqual(fallback);
      expect(listStories()[0]?.[field]).toEqual(fallback);
      expect(getStory(story.id)?.chapters).toEqual([complete]);
      if (field !== "config") expect(getStory(story.id)?.premise).toBe("A safe return");
      expect(rawRow(story.id)).toEqual(before);
    },
  );
  it.each(invalidChapters)("chapters display [] for unusable document %s without writing it", (raw) => {
    const story = seed();
    put(story.id, "chapters", raw);
    const before = rawRow(story.id);
    expect(getStory(story.id)?.chapters).toEqual([]);
    expect(listStories()[0]?.chapters).toEqual([]);
    expect(getStory(story.id)?.chapterContents).toEqual({ "1": "Original prose" });
    expect(rawRow(story.id)).toEqual(before);
  });
  it("reads a mixed chapter array safely and preserves its stored bytes", () => {
    const story = seed();
    put(story.id, "chapters", JSON.stringify([null, complete, 8, { status: "writing" }, writing]));
    const before = rawRow(story.id);
    expect(() => listStories()).not.toThrow();
    expect(getStory(story.id)?.chapters).toEqual(expect.arrayContaining([complete, writing]));
    expect(rawRow(story.id)).toEqual(before);
  });
  it("a title-only update preserves every damaged JSON field verbatim", () => {
    const story = seed();
    put(story.id, "config", "{damaged");
    put(story.id, "chapters", ' { "wrong": true } ');
    put(story.id, "chapter_contents", " null ");
    put(story.id, "story_arc", " [1,2] ");
    const before = jsonColumns(story.id);
    expect(() => updateStory(story.id, { title: "New title" })).not.toThrow();
    expect(rawRow(story.id).title).toBe("New title");
    expect(jsonColumns(story.id)).toEqual(before);
  });
  it.each([
    { column: "config", update: { config: { premise: "Repaired" } }, value: { premise: "Repaired" } },
    { column: "chapters", update: { chapters: [complete] }, value: [complete] },
    { column: "chapter_contents", update: { chapterContents: { "1": "Repaired" } }, value: { "1": "Repaired" } },
    { column: "story_arc", update: { storyArc: arc }, value: arc },
  ])("explicit repair serialises only requested $column", ({ column, update, value }) => {
    const story = seed();
    for (const key of ["config", "chapters", "chapter_contents", "story_arc"]) put(story.id, key, "{damaged");
    const before = jsonColumns(story.id);
    expect(() => updateStory(story.id, update)).not.toThrow();
    const after = jsonColumns(story.id);
    expect(JSON.parse(String(after[column as keyof typeof after]))).toEqual(value);
    for (const key of Object.keys(before) as (keyof typeof before)[]) {
      if (key !== column) expect(after[key]).toBe(before[key]);
    }
  });
});

describe("T-0189 restart recovery", () => {
  it.each(invalidChapters)("preserves unusable raw chapter document %s", (raw) => {
    const story = seed();
    put(story.id, "chapters", raw);
    const before = rawRow(story.id);
    expect(() => reconcileStoriesOnBoot()).not.toThrow();
    expect(rawRow(story.id)).toEqual(before);
  });
  it("changes only valid writing chapters while retaining invalid elements and metadata", () => {
    const story = seed();
    const invalid = [
      null, 4, "chapter", {}, { ...writing, number: "2" },
      { ...writing, title: 7 }, { ...writing, wordCount: "17" },
      { ...writing, number: null }, { ...writing, status: "unknown" },
    ];
    const chapters = [complete, ...invalid, writing, { number: 3, title: "Three", status: "pending", wordCount: 0 }];
    put(story.id, "chapters", JSON.stringify(chapters));
    const before = jsonColumns(story.id);
    expect(() => reconcileStoriesOnBoot()).not.toThrow();
    const stored = JSON.parse(String(rawRow(story.id).chapters)) as Record<string, unknown>[];
    expect(stored).toHaveLength(chapters.length);
    expect(stored.slice(0, -2)).toEqual(chapters.slice(0, -2));
    expect(stored.at(-1)).toEqual(chapters.at(-1));
    expect(stored.at(-2)).toEqual({ ...writing, status: "failed", error: expect.stringMatching(/restart|interrupted/i) });
    expect(jsonColumns(story.id)).toEqual({ ...before, chapters: rawRow(story.id).chapters });
    expect(reconcileStoriesOnBoot()).toEqual({ failedStories: 0, failedChapters: 0 });
  });
  it("does not rewrite whitespace or invalid writing elements when no usable writing chapter exists", () => {
    const story = seed();
    const raw = ' [ null, {"status":"writing"}, {"number":1e309,"title":"Bad","status":"writing","wordCount":0}, {"number":1,"title":"Bad","status":"writing","wordCount":1e309} ] ';
    put(story.id, "chapters", raw);
    const before = rawRow(story.id);
    expect(() => reconcileStoriesOnBoot()).not.toThrow();
    expect(rawRow(story.id)).toEqual(before);
  });
  it("marks generating status failed without repairing its unusable chapter document", () => {
    const story = seed("generating");
    put(story.id, "chapters", "{broken");
    const before = jsonColumns(story.id);
    expect(() => reconcileStoriesOnBoot()).not.toThrow();
    expect(rawRow(story.id)).toMatchObject({ status: "failed", generation_error: expect.stringMatching(/restart|interrupted/i) });
    expect(jsonColumns(story.id)).toEqual(before);
  });
  it.each([1, 2])("rolls back initial status and all chapters when SQLite aborts after %i earlier writes", (earlierWrites) => {
    const generating = seed("generating");
    const active = seed();
    put(active.id, "chapters", JSON.stringify([writing]));
    const another = seed();
    put(another.id, "chapters", JSON.stringify([writing]));
    const before = testDb!.prepare("SELECT * FROM stories ORDER BY id").all();
    // Abort the later write whichever row the sweep visits first. RAISE(ABORT)
    // rolls back one statement only; retaining the first write exposes a missing transaction.
    testDb!.exec(`CREATE TRIGGER oracle_recovery_failure BEFORE UPDATE ON stories
      WHEN (SELECT COUNT(*) FROM stories WHERE status = 'failed' OR chapters LIKE '%"status":"failed"%') >= ${earlierWrites}
      BEGIN SELECT RAISE(ABORT, 'oracle recovery failure'); END;`);
    let failure: unknown;
    try { reconcileStoriesOnBoot(); } catch (error) { failure = error; }
    expect(testDb!.prepare("SELECT * FROM stories ORDER BY id").all()).toEqual(before);
    // Either a thrown failure or a rollback result is permitted, never a partial success.
    if (failure) expect(String(failure)).toContain("oracle recovery failure");
    expect(rawRow(generating.id).status).toBe("generating");
    testDb!.exec("DROP TRIGGER oracle_recovery_failure");
    expect(reconcileStoriesOnBoot()).toEqual({ failedStories: 1, failedChapters: 2 });
  });
});
