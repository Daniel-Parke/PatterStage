/** @jest-environment node */
// Pure helpers extracted from the stories route (story-handlers/shared.ts).

import {
  validateChapterOutput,
  getChapterCount,
  safeArc,
  buildMasterPrompt,
  buildChapterPrompt,
  focusArcForChapter,
} from "@/modules/rec-room/handlers/shared";
import type { StoryArc, ChapterOutline } from "@/modules/rec-room/types";

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

  // toMatchObject since T-0087: safeArc now guarantees the outline shape the
  // chapter prompt reads (keyBeats et al.), so an arc comes back with what it
  // had plus what it owed. These pin unwrap/parse, not byte identity.
  it("returns a flat StoryArc with what it had", () => {
    expect(safeArc(flat)).toMatchObject(flat);
  });
  it("unwraps a nested { storyArc: <real arc> } wrapper", () => {
    const inner = { storyArc: "x", fixedPlotPoints: [{}], chapterOutlines: [{}] };
    expect(safeArc({ storyArc: inner })).toMatchObject({ storyArc: "x", fixedPlotPoints: [{}] });
    expect(safeArc({ storyArc: inner })!.chapterOutlines[0].keyBeats).toEqual([]);
  });
  it("parses a JSON-string arc", () => {
    expect(safeArc(JSON.stringify(flat))).toMatchObject(flat);
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

describe("focusArcForChapter", () => {
  const arc = {
    storyArc: "A tense rescue",
    fixedPlotPoints: [
      { chapter: 3, event: "the bridge collapses", setup: "rope frays" },
      { chapter: 5, event: "the betrayal is revealed" },
      { chapter: 2, event: "they enter the valley" },
    ],
    characterArcs: [{ name: "Ada", startingState: "naive", journey: "learns to lead", endingState: "commander" }],
    worldRules: ["magic costs memory"],
    themes: ["sacrifice"],
    chapterOutlines: [],
  } as unknown as StoryArc;

  it("surfaces ONLY this chapter's fixed plot points as mandatory", () => {
    const text = focusArcForChapter(arc, 3, 6);
    expect(text).toContain("FIXED PLOT POINTS THAT MUST OCCUR IN THIS CHAPTER:");
    expect(text).toContain("the bridge collapses (setup: rope frays)");
    // The chapter-5 point is NOT in the mandatory section (it's upcoming).
    const mandatorySection = text.slice(
      text.indexOf("MUST OCCUR IN THIS CHAPTER:"),
      text.indexOf("UPCOMING"),
    );
    expect(mandatorySection).not.toContain("the betrayal is revealed");
  });

  it("lists upcoming points as foreshadow-only", () => {
    const text = focusArcForChapter(arc, 3, 6);
    expect(text).toContain("UPCOMING (foreshadow only");
    expect(text).toContain("[Ch 5] the betrayal is revealed");
  });

  it("notes how far through each character arc should be by this chapter", () => {
    const text = focusArcForChapter(arc, 3, 6);
    expect(text).toContain("by chapter 3 of 6, ~50% through");
    expect(text).toContain("Ada: learns to lead (start: naive → end: commander)");
  });

  it("states there are no mandated points when none target this chapter", () => {
    expect(focusArcForChapter(arc, 4, 6)).toContain("none mandated");
  });
});

describe("buildChapterPrompt", () => {
  const arc = {
    storyArc: "A tense rescue",
    fixedPlotPoints: [{ chapter: 3, event: "the bridge collapses" }],
    characterArcs: [],
    worldRules: [],
    themes: [],
    chapterOutlines: [],
  } as unknown as StoryArc;
  const outline: ChapterOutline = {
    number: 3,
    title: "The Descent",
    purpose: "Rising action",
    keyBeats: ["enter the cave", "find the map"],
    emotionalTone: "Tense",
  };

  it("interpolates the chapter number (regression: was a literal ${outline.number})", () => {
    const p = buildChapterPrompt("MASTER", arc, "summary so far", [], outline, 6);
    expect(p).toContain("Write Chapter 3 now. Return ONLY prose.");
    expect(p).not.toContain("${outline.number}");
  });

  it("includes the focused arc, summary, recent chapters, outline, and checklist", () => {
    const p = buildChapterPrompt(
      "MASTER",
      arc,
      "summary so far",
      [
        { number: 1, content: "chapter one text" },
        { number: 2, content: "chapter two text" },
      ],
      outline,
      6,
    );
    expect(p).toContain("===STORY ARC (focused for this chapter)===");
    expect(p).toContain("===NARRATIVE SO FAR===");
    expect(p).toContain("===RECENT CHAPTERS");
    expect(p).toContain("--- Chapter 1 ---");
    expect(p).toContain("--- Chapter 2 ---");
    expect(p).toContain("Key Beats: enter the cave; find the map");
    expect(p).toContain("===CHECKLIST (verify before you finish)===");
    // The chapter's mandated fixed point is surfaced in the focused arc.
    expect(p).toContain("the bridge collapses");
  });
});
