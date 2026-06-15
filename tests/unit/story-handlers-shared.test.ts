/** @jest-environment node */
// Pure helpers extracted from the stories route (story-handlers/shared.ts).

import {
  validateChapterOutput,
  getChapterCount,
  safeArc,
  buildMasterPrompt,
} from "@/lib/story-handlers/shared";

describe("getChapterCount", () => {
  it.each([
    ["short", 3],
    ["medium", 6],
    ["long", 10],
    ["epic", 6],
    ["", 6],
  ])("%s → %d", (length, n) => {
    expect(getChapterCount(length)).toBe(n);
  });
});

describe("validateChapterOutput", () => {
  it("strips a meta prefix", () => {
    expect(validateChapterOutput("Sure! The rain fell on the city.")).toBe(
      "The rain fell on the city.",
    );
  });
  it("strips ===CHAPTER N=== / ===ARC=== markers", () => {
    expect(validateChapterOutput("===CHAPTER 2===\nThe story begins.")).toBe("The story begins.");
    expect(validateChapterOutput("===ARC===The plan.")).toBe("The plan.");
  });
  it("leaves clean prose untouched", () => {
    expect(validateChapterOutput("  The wind howled.  ")).toBe("The wind howled.");
  });
});

describe("safeArc", () => {
  const flat = { storyArc: "x", fixedPlotPoints: [], chapterOutlines: [] };

  it("returns a flat StoryArc as-is", () => {
    expect(safeArc(flat)).toEqual(flat);
  });
  it("unwraps a nested { storyArc: <real arc> } wrapper", () => {
    const inner = { storyArc: "x", fixedPlotPoints: [{}], chapterOutlines: [{}] };
    expect(safeArc({ storyArc: inner })).toEqual(inner);
  });
  it("parses a JSON-string arc", () => {
    expect(safeArc(JSON.stringify(flat))).toEqual(flat);
  });
  it("returns undefined for junk / null / non-arc", () => {
    expect(safeArc("not json")).toBeUndefined();
    expect(safeArc(null)).toBeUndefined();
    expect(safeArc({ nope: true })).toBeUndefined();
  });
});

describe("buildMasterPrompt", () => {
  it("includes the premise + formatted character profiles", () => {
    const p = buildMasterPrompt({
      premise: "A quest for the lost map",
      title: "Q",
      characters: [{ name: "Ada", role: "hero", description: "brave", personality: "stubborn" }],
    });
    expect(p).toContain("Premise: A quest for the lost map");
    expect(p).toContain("- Ada (hero): brave");
    expect(p).toContain("Personality: stubborn");
  });
  it("handles no characters", () => {
    expect(buildMasterPrompt({ premise: "x" })).toContain("(none specified)");
  });
});
