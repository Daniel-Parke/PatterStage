/** @jest-environment node */

import { groupByCategory, titleCaseCategory } from "@/lib/skills-grouping";
import { categoryStateKey, groupCategories } from "@/lib/skills-page-helpers";
import type { Skill } from "@/types/console";

describe("groupByCategory", () => {
  it("groups skills with case-mismatched categories into a single bucket", () => {
    // The audit found 5 skills with this exact problem across creative/
    // and research/ subdirectories. Two case variants for "creative".
    const skills = [
      { name: "ascii-art", category: "creative" },
      { name: "excalidraw", category: "creative" },
      { name: "creative-ideation", category: "Creative" },
    ];
    const groups = groupByCategory(skills);

    expect(groups).toHaveLength(1);
    expect(groups[0][0]).toBe("creative");
    expect(groups[0][1]).toHaveLength(3);
  });

  it("keeps distinct categories (not just case variants) separate", () => {
    const skills = [
      { name: "arxiv", category: "Research" },
      { name: "blogwatcher", category: "research" },
      { name: "axolotl", category: "Fine-Tuning" },
    ];
    const groups = groupByCategory(skills);

    expect(groups).toHaveLength(2);
    // Sorted alphabetically by normalized key.
    //
    // T-0037 CORRECTED THIS EXPECTATION. It used to read "fine-tuning", which
    // was wrong rather than strict: the display has always rendered this
    // category as "Fine Tuning", so a key that keeps the hyphen describes a
    // word boundary the label does not have. The key is what "Fine-Tuning" and
    // "fine tuning" have to agree on, and the hyphenated form made them
    // disagree. Nothing was weakened here; the assertion was moved onto the
    // behaviour the display already had.
    expect(groups[0][0]).toBe("fine tuning");
    expect(titleCaseCategory("Fine-Tuning")).toBe("Fine Tuning");
    expect(groups[1][0]).toBe("research");
    expect(groups[0][1]).toHaveLength(1);
    expect(groups[1][1]).toHaveLength(2);
  });

  it("falls back to a default bucket for empty/whitespace categories", () => {
    const skills = [
      { name: "y", category: "" },
      { name: "z", category: "  " },
      { name: "ok", category: "GitHub" },
    ];
    const groups = groupByCategory(skills, "uncategorized");

    expect(groups).toHaveLength(2);
    const keys = groups.map(([k]) => k);
    expect(keys).toContain("github");
    expect(keys).toContain("uncategorized");
    const fallback = groups.find(([k]) => k === "uncategorized")!;
    expect(fallback[1]).toHaveLength(2);
  });

  it("uses a custom fallback when the default is changed", () => {
    const skills = [
      { name: "x", category: "" },
    ];
    const groups = groupByCategory(skills, "Other");
    expect(groups).toHaveLength(1);
    expect(groups[0][0]).toBe("other");
  });

  it("preserves the original items (does not transform or clone them)", () => {
    const skill = { name: "test", category: "Test", extra: 42 };
    const groups = groupByCategory([skill]);
    // Identity preserved (not just value equality).
    expect(groups[0][1][0]).toBe(skill);
  });

  it("returns an empty array for empty input", () => {
    expect(groupByCategory([])).toEqual([]);
  });

  it("sorts groups alphabetically by normalized key", () => {
    const skills = [
      { name: "a", category: "zulu" },
      { name: "b", category: "alpha" },
      { name: "c", category: "mike" },
    ];
    const groups = groupByCategory(skills);
    expect(groups.map(([k]) => k)).toEqual(["alpha", "mike", "zulu"]);
  });
});

describe("titleCaseCategory", () => {
  it("title-cases a single word", () => {
    expect(titleCaseCategory("creative")).toBe("Creative");
  });

  it("title-cases hyphenated words by treating hyphens as spaces", () => {
    expect(titleCaseCategory("code-review")).toBe("Code Review");
    expect(titleCaseCategory("fine-tuning")).toBe("Fine Tuning");
  });

  it("title-cases underscore-separated words", () => {
    expect(titleCaseCategory("ml_ops")).toBe("Ml Ops");
  });

  it("handles empty/null/undefined input", () => {
    expect(titleCaseCategory("")).toBe("");
    expect(titleCaseCategory(null)).toBe("");
    expect(titleCaseCategory(undefined)).toBe("");
  });

  it("preserves an already-title-cased string", () => {
    expect(titleCaseCategory("Github")).toBe("Github");
  });
});

// ── T-0037. The grouping key normalises exactly as far as the display ──────
//
// The key was raw.toLowerCase() while titleCaseCategory ALSO folded [-_]+ to
// spaces, so the key drew word boundaries the label did not: "Control Hub" and
// "control-hub" render one identical label and keyed to two buckets, which QA
// read as the same category listed twice. Since T-0032 the key is load-bearing,
// because collapse and paging state key off it through categoryStateKey, so a
// split bucket splits its state too.
//
// The invariant: titleCaseCategory(raw).toLowerCase() IS the grouping key, for
// every spelling. Same rendered label, same bucket, one state.

describe("groupByCategory: parity with the display (T-0037)", () => {
  it("merges every spelling that renders the same label into one bucket", () => {
    const skills = [
      { name: "a", category: "Control Hub" },
      { name: "b", category: "control-hub" },
      { name: "c", category: "control_hub" },
      { name: "d", category: "CONTROL  HUB" },
    ];
    const groups = groupByCategory(skills);

    expect(groups).toHaveLength(1);
    expect(groups[0][0]).toBe("control hub");
    expect(groups[0][1]).toHaveLength(4);

    // The premise of the merge, stated exactly. All FOUR now render one
    // identical label. This assertion used to end
    // `expect(titleCaseCategory("CONTROL  HUB")).toBe("CONTROL HUB")`, with a
    // comment explaining that titleCaseCategory raises the first letter of each
    // word and leaves the rest alone.
    //
    // That was an accurate description of a defect, pinned as if it were a
    // design. Four spellings shared a bucket while rendering two different
    // labels, and skills-page-helpers takes a bucket's heading from its FIRST
    // member, so the heading depended on catalogue order. Corrected in place
    // under T-0053, not deleted: the merge this test protects is unchanged, and
    // what changes is that the premise it states is now true of all four rather
    // than three.
    expect(new Set(skills.map((s) => titleCaseCategory(s.category)))).toEqual(
      new Set(["Control Hub"]),
    );
    expect(titleCaseCategory("CONTROL  HUB")).toBe("Control Hub");
  });

  it("keys exactly what the display renders, for every spelling", () => {
    const spellings = [
      "Control Hub",
      "control-hub",
      "control_hub",
      "CONTROL  HUB",
      "Fine-Tuning",
      "fine tuning",
      "ml_ops",
      "creative",
      "Research",
      "GitHub",
    ];
    for (const raw of spellings) {
      const [[key]] = groupByCategory([{ name: "x", category: raw }]);
      expect(key).toBe(titleCaseCategory(raw).toLowerCase());
    }
  });

  it("normalises the fallback bucket the same way", () => {
    const groups = groupByCategory([{ name: "x", category: "" }], "No-Category");
    expect(groups).toHaveLength(1);
    expect(groups[0][0]).toBe("no category");
  });

  // THE DELIBERATE LIMIT, pinned so any change to it is a decision and not a
  // drift. A separator-free spelling renders a DIFFERENT label ("Controlhub",
  // not "Control Hub"), so it keeps its own bucket: the key normalises as far
  // as the display does and no further. Merging it would put two different
  // labels in one bucket, and the header label would then depend on whichever
  // row the catalogue happened to return first.
  it("leaves a spelling that renders differently in its own bucket", () => {
    const groups = groupByCategory([
      { name: "a", category: "Control Hub" },
      { name: "b", category: "controlhub" },
    ]);
    expect(groups.map(([k]) => k)).toEqual(["control hub", "controlhub"]);
    expect(titleCaseCategory("controlhub")).toBe("Controlhub");
  });
});

describe("a merged bucket carries ONE collapse state (T-0037 over T-0032)", () => {
  const asSkill = (over: Partial<Skill>): Skill =>
    ({ name: "x", description: "", category: "", enabled: true, ...over }) as Skill;

  it("produces one group, one state key, for two spellings of one label", () => {
    const groups = groupCategories([
      asSkill({ name: "a-skill", category: "Control Hub" }),
      asSkill({ name: "b-skill", category: "control-hub" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("control hub");
    expect(groups[0].category).toBe("Control Hub");
    expect(groups[0].skills.map((s) => s.name)).toEqual(["a-skill", "b-skill"]);

    const stateKeys = groups.map((g) => categoryStateKey("active", g.key));
    expect(stateKeys).toEqual(["active::control hub"]);
    expect(new Set(stateKeys).size).toBe(1);
  });

  it("labels the merged bucket the same way whichever spelling arrives first", () => {
    const forwards = groupCategories([
      asSkill({ name: "a-skill", category: "Control Hub" }),
      asSkill({ name: "b-skill", category: "control-hub" }),
    ]);
    const backwards = groupCategories([
      asSkill({ name: "b-skill", category: "control-hub" }),
      asSkill({ name: "a-skill", category: "Control Hub" }),
    ]);
    expect(backwards[0].category).toBe(forwards[0].category);
    expect(backwards[0].key).toBe(forwards[0].key);
  });

  it("still scopes one key apart across the two sections", () => {
    expect(categoryStateKey("active", "control hub")).not.toBe(
      categoryStateKey("inactive", "control hub"),
    );
  });
});
