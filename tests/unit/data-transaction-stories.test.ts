/** @jest-environment node */
/* hoisted singleton fixture */
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
    expect(getStory(story.id)?.chapters).toEqual([complete, writing]);
    expect(listStories()[0]?.chapters).toEqual([complete, writing]);
    expect(rawRow(story.id)).toEqual(before);
  });
  it("omits unusable chapter content values from display while preserving strings and raw storage", () => {
    const story = seed();
    const raw = ' {"1":"Original prose","2":null,"3":17,"4":true,"5":[],"6":{},"7":"","8":"  ","9":"Later prose"} ';
    put(story.id, "chapter_contents", raw);
    const before = rawRow(story.id);
    const expected = { "1": "Original prose", "7": "", "8": "  ", "9": "Later prose" };
    expect(getStory(story.id)?.chapterContents).toEqual(expected);
    expect(listStories()[0]?.chapterContents).toEqual(expected);
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
  it.each([' {"status":"writing"} ', ' "writing" ', '{"status":"writing",broken'])
    ("preserves wrong-shaped or malformed writing document %s after the SQL prefilter selects it", (raw) => {
      const story = seed();
      put(story.id, "chapters", raw);
      const before = rawRow(story.id);
      expect(() => reconcileStoriesOnBoot()).not.toThrow();
      expect(reconcileStoriesOnBoot()).toEqual({ failedStories: 0, failedChapters: 0 });
      expect(rawRow(story.id)).toEqual(before);
    });
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
    let threw = false;
    let result: ReturnType<typeof reconcileStoriesOnBoot> | undefined;
    try { result = reconcileStoriesOnBoot(); } catch (error) { failure = error; threw = true; }
    expect(testDb!.prepare("SELECT * FROM stories ORDER BY id").all()).toEqual(before);
    // Either a thrown failure or a rollback result is permitted, never a partial success.
    if (failure) expect(String(failure)).toContain("oracle recovery failure");
    if (threw) expect(String(failure)).toContain("oracle recovery failure");
    else expect(result).toEqual({ failedStories: 0, failedChapters: 0 });
    expect(rawRow(generating.id).status).toBe("generating");
    testDb!.exec("DROP TRIGGER oracle_recovery_failure");
    expect(reconcileStoriesOnBoot()).toEqual({ failedStories: 1, failedChapters: 2 });
  });
});

// Amendment 2026-10-02, Planck 01a0fd1f-516a-7323-af9c-0682d6bbbe6c:
// Strengthen exact display filtering, writing-prefilter recovery and rollback reporting.
// Authorised by committed T-0189-oracle-amendment.md; original freeze retained.

// Amendment 2026-10-02, Averroes 01a0fd41-d8a8-7df1-861b-b12aa52122e6:
// Add mixed recovery numeric-preservation witness; retain every earlier test unchanged.
// Authorised by committed T-0189-oracle-amendment.md; previous freezes retained.
describe("T-0189 restart recovery numeric preservation", () => {
  // JSON strings are consumed first so digits inside strings are not numeric tokens.
  const numericLexemes = (document: string) => Array.from(
    document.matchAll(/"(?:\\.|[^"\\])*"|(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/g),
  ).flatMap((match) => match[1] === undefined ? [] : [match[1]]);

  it("recovers a valid writing chapter without nulling or rounding unrelated mixed-array numeric lexemes", () => {
    const story = seed();
    // Write JSON text directly: JSON.stringify would already lose these values.
    const raw = `[
      {"number":1e309,"title":"Invalid positive number","status":"writing","wordCount":0},
      {"number":5,"title":"Invalid negative count","status":"writing","wordCount":-1e309},
      1e309,
      -1e309,
      {"number":2,"title":"Recover this chapter","status":"writing","wordCount":17,
       "error":"Replace this writing error","generatedAt":"2026-10-01T11:00:00Z",
       "extension":{"positive":1e309,"negative":-1e309,"largeInteger":9007199254740993,
                    "finiteExponent":1.25e+2,"negativeZero":-0,"nested":[1e309,9007199254740997],
                    "text":"Retain literal 1e309 and escaped \\"9007199254740993\\" as text"}},
      {"number":3,"title":"Untouched complete chapter","status":"complete","wordCount":92,
       "error":"Keep this nonwriting annotation",
       "extension":{"positive":1e309,"negative":-1e309,"largeInteger":9007199254740995}}
    ]`;
    const expected = JSON.parse(raw) as unknown[];
    expected[4] = {
      ...(expected[4] as Record<string, unknown>),
      status: "failed",
      error: expect.stringMatching(/restart|interrupted/i),
    };
    put(story.id, "chapters", raw);
    const before = jsonColumns(story.id);

    expect(reconcileStoriesOnBoot()).toEqual({ failedStories: 0, failedChapters: 1 });
    const stored = String(rawRow(story.id).chapters);
    expect(jsonColumns(story.id)).toEqual({ ...before, chapters: stored });
    expect(rawRow(story.id).status).toBe("active");
    expect({ chapters: JSON.parse(stored), numericLexemes: numericLexemes(stored) }).toEqual({
      chapters: expected,
      numericLexemes: numericLexemes(raw),
    });
  });

  it("changes only effective last status and error values while retaining escaped keys and string contents", () => {
    const story = seed();
    const raw = String.raw` [
      { "number" : 2, "title" : "Escaped keys", "wordCount" : 17,
        "status" : "writing", "status" : "pending", "sta\u0074us" : "writing",
        "error" : "Retain earlier error", "err\u006fr" : "Replace effective error",
        "\u0065xtension" : {"status":"writing","error":"Retain nested error",
          "text":"Literal \"status\":\"writing\", braces } ], backslash \\, unicode \u0031e309",
          "nested":[{"large":9007199254740993,"overflow":-1e309}]} },
      { "number" : 3, "title" : "Effective complete", "wordCount" : 92,
        "status" : "writing", "sta\u0074us" : "complete",
        "error" : "Keep earlier complete error", "err\u006fr" : "Keep effective complete error" }
    ] `;
    const expected = JSON.parse(raw) as Record<string, unknown>[];
    put(story.id, "chapters", raw);
    expect(reconcileStoriesOnBoot()).toEqual({ failedStories: 0, failedChapters: 1 });
    const stored = String(rawRow(story.id).chapters);
    const recovered = JSON.parse(stored) as Record<string, unknown>[];
    expect(recovered[0].error).toEqual(expect.stringMatching(/restart|interrupted/i));
    expected[0] = { ...expected[0], status: "failed", error: recovered[0].error };
    const expectedRaw = raw
      .replace(String.raw`"sta\u0074us" : "writing"`, String.raw`"sta\u0074us" : "failed"`)
      .replace(String.raw`"err\u006fr" : "Replace effective error"`, String.raw`"err\u006fr" : ${JSON.stringify(recovered[0].error)}`);
    expect({ chapters: recovered, raw: stored }).toEqual({ chapters: expected, raw: expectedRaw });
  });

  it("recovers multiple writing chapters including missing error while retaining raw extras and repeat stability", () => {
    const story = seed();
    const untouched = String.raw`{ "number":3, "title":"Untouched", "status":"complete", "wordCount":92, "extra":9007199254740995 }`;
    const firstExtras = String.raw`"extension" : { "nested" : [1e309, -1e309, 9007199254740993], "text" : "Keep \"error\" and \"status\"" }`;
    const secondExtras = String.raw`"other" : { "amount" : 1.2300e+2, "negativeZero" : -0, "nested" : {"error":"Keep nested error"} }`;
    const raw = `[
      { "number":1, "title":"Missing error", "status":"writing", "wordCount":0, ${firstExtras} },
      { "number":2, "title":"Existing error", "status":"writing", "wordCount":17, "error":"Replace second error", ${secondExtras} },
      ${untouched}
    ]`;
    const expected = JSON.parse(raw) as Record<string, unknown>[];
    expected[0] = { ...expected[0], status: "failed", error: expect.stringMatching(/restart|interrupted/i) };
    expected[1] = { ...expected[1], status: "failed", error: expect.stringMatching(/restart|interrupted/i) };
    put(story.id, "chapters", raw);
    const before = jsonColumns(story.id);
    expect(reconcileStoriesOnBoot()).toEqual({ failedStories: 0, failedChapters: 2 });
    const stored = String(rawRow(story.id).chapters);
    expect(jsonColumns(story.id)).toEqual({ ...before, chapters: stored });
    const recoveredRow = rawRow(story.id);
    expect(reconcileStoriesOnBoot()).toEqual({ failedStories: 0, failedChapters: 0 });
    expect(rawRow(story.id)).toEqual(recoveredRow);
    expect({
      chapters: JSON.parse(stored),
      numericLexemes: numericLexemes(stored),
      unchangedRaw: [firstExtras, secondExtras, untouched].map((fragment) => stored.includes(fragment)),
    }).toEqual({
      chapters: expected,
      numericLexemes: numericLexemes(raw),
      unchangedRaw: [true, true, true],
    });
  });
});

// Amendment 2026-10-02, Averroes: escaped status values must reach recovery.
// Authorised by the final reviewer addition; all earlier red evidence retained.
describe("T-0189 escaped restart recovery selection", () => {
  it("recovers escaped status keys and values while preserving raw data, excluded rows and repeat stability", () => {
    const story = seed();
    const raw = String.raw` [
      { "number":1, "title":"One", "status":"wr\u0069ting", "wordCount":17,
        "error":"Replace one", "extra":{"large":9007199254740993,"overflow":1e309,
          "text":"Keep escaped quotes \" and unicode \u0061"} },
      { "number":2, "title":"Two", "sta\u0074us":"wr\u0069ting", "wordCount":0,
        "err\u006fr":"Replace two", "extra":{"negative":-1e309,"amount":1.2300e+2} }
    ] `;
    put(story.id, "chapters", raw);
    const before = jsonColumns(story.id);
    const malformed = seed();
    put(malformed.id, "chapters", String.raw` [ {"status":"wr\u0069ting",broken ] `);
    const nonwriting = seed();
    put(nonwriting.id, "chapters", String.raw` [ {"number":3,"title":"Complete","status":"com\u0070lete","wordCount":92,"extra":{"status":"wr\u0069ting","large":9007199254740995}} ] `);
    const deleted = seed();
    put(deleted.id, "chapters", raw);
    expect(deleteStory(deleted.id)).toBe(true);
    const excluded = [malformed.id, nonwriting.id, deleted.id];
    const excludedBefore = excluded.map(rawRow);

    const result = reconcileStoriesOnBoot();
    expect(excluded.map(rawRow)).toEqual(excludedBefore);
    expect(result).toEqual({ failedStories: 0, failedChapters: 2 });
    const stored = String(rawRow(story.id).chapters);
    const recovered = JSON.parse(stored) as Record<string, unknown>[];
    expect(recovered.map((chapter) => ({ status: chapter.status, error: chapter.error }))).toEqual([
      { status: "failed", error: expect.stringMatching(/restart|interrupted/i) },
      { status: "failed", error: expect.stringMatching(/restart|interrupted/i) },
    ]);
    const expectedRaw = raw
      .replace(String.raw`"status":"wr\u0069ting"`, '"status":"failed"')
      .replace(String.raw`"sta\u0074us":"wr\u0069ting"`, String.raw`"sta\u0074us":"failed"`)
      .replace('"error":"Replace one"', `"error":${JSON.stringify(recovered[0].error)}`)
      .replace(String.raw`"err\u006fr":"Replace two"`, String.raw`"err\u006fr":${JSON.stringify(recovered[1].error)}`);
    expect(stored).toBe(expectedRaw);
    expect(jsonColumns(story.id)).toEqual({ ...before, chapters: stored });
    expect(rawRow(story.id).status).toBe("active");
    const allRecoveredRows = [story.id, ...excluded].map(rawRow);
    expect(reconcileStoriesOnBoot()).toEqual({ failedStories: 0, failedChapters: 0 });
    expect([story.id, ...excluded].map(rawRow)).toEqual(allRecoveredRows);
  });
});
