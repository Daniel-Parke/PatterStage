/** @jest-environment node */

import { groupByCategory, titleCaseCategory } from "@/lib/skills-grouping";

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
    expect(groups[0][0]).toBe("fine-tuning");
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
