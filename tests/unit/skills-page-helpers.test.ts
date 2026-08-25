/** @jest-environment node */
// Pure derivations extracted from the Skills Manager page
// (lib/skills-page-helpers.ts).

import {
  categoryStateKey,
  clampPage,
  effectiveSkillEnabled,
  filterBySearch,
  groupCategories,
  pageCount,
  pageRangeLabel,
  pageSlice,
} from "@/lib/skills-page-helpers";
import type { Skill } from "@/types/console";

const skill = (over: Partial<Skill> = {}): Skill =>
  ({
    name: "apple-notes",
    description: "Manage Apple Notes",
    category: "apple",
    enabled: true,
    ...over,
  }) as Skill;

describe("effectiveSkillEnabled", () => {
  it("returns the pending optimistic value when present", () => {
    expect(effectiveSkillEnabled(skill({ enabled: true }), { "apple-notes": false })).toBe(
      false,
    );
  });
  it("falls back to skill.enabled by default", () => {
    expect(effectiveSkillEnabled(skill({ enabled: true }), {})).toBe(true);
  });
  it("honours an explicit fallback (Inactive section negation)", () => {
    expect(effectiveSkillEnabled(skill({ enabled: false }), {}, true)).toBe(true);
  });
});

describe("filterBySearch", () => {
  const skills = [
    skill({ name: "apple-notes", description: "notes" }),
    skill({ name: "github-pr", description: "pull requests" }),
  ];
  it("matches name case-insensitively", () => {
    expect(filterBySearch(skills, "APPLE").map((s) => s.name)).toEqual(["apple-notes"]);
  });
  it("matches description", () => {
    expect(filterBySearch(skills, "pull").map((s) => s.name)).toEqual(["github-pr"]);
  });
  it("empty search returns all", () => {
    expect(filterBySearch(skills, "")).toHaveLength(2);
  });
});

describe("groupCategories", () => {
  it("groups case-insensitively and sorts skills by name", () => {
    const groups = groupCategories([
      skill({ name: "z-skill", category: "Creative" }),
      skill({ name: "a-skill", category: "creative" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].skills.map((s) => s.name)).toEqual(["a-skill", "z-skill"]);
    expect(groups[0].category).toBe("Creative");
  });

  // T-0032. The display label is title-cased for the eye; the collapse and
  // paging maps key off `key`, which is the case-normalised grouping key. The
  // page used to seed its collapse map with the API's raw category strings and
  // then look state up by the display label, so no lookup ever hit and every
  // category rendered open. One key, produced by the grouping itself, is what
  // stops that recurring.
  it("carries a case-normalised state key alongside the display label", () => {
    const groups = groupCategories([
      skill({ name: "a-skill", category: "Creative" }),
      skill({ name: "b-skill", category: "creative" }),
    ]);
    expect(groups[0].key).toBe("creative");
    expect(groups[0].category).toBe("Creative");
  });

  it("buckets a missing category under Other rather than dropping the skill", () => {
    const groups = groupCategories([skill({ name: "orphan", category: "" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("other");
    expect(groups[0].skills.map((s) => s.name)).toEqual(["orphan"]);
  });
});

// ── Paging (T-0032) ────────────────────────────────────────────────────────
// The window that keeps DOM node count off the catalogue size.

// The default window size, read out of the module rather than restated, so
// these tests still describe the real page if the number ever moves.
const PAGE = pageSlice(
  Array.from({ length: 1000 }, (_, i) => i),
  0,
).length;

describe("pageCount", () => {
  it("is 1 for an empty list, so a pager never reports page 1 of 0", () => {
    expect(pageCount(0)).toBe(1);
  });
  it("is 1 while the list fits the window", () => {
    expect(pageCount(PAGE)).toBe(1);
  });
  it("rounds up on the overflow", () => {
    expect(pageCount(PAGE + 1)).toBe(2);
    expect(pageCount(60, 24)).toBe(3);
  });
});

describe("clampPage", () => {
  it("clamps below zero", () => {
    expect(clampPage(-3, 60, 24)).toBe(0);
  });
  it("clamps past the last page", () => {
    expect(clampPage(9, 60, 24)).toBe(2);
  });
  it("leaves an in-range page alone", () => {
    expect(clampPage(1, 60, 24)).toBe(1);
  });
  // The shrink case: a search narrows a 60-row category to 5 rows while the
  // user sits on page 3. Without the clamp the window slices past the end and
  // the user stares at an empty list that has results in it.
  it("pulls a stale page back into range when the list shrinks", () => {
    expect(clampPage(2, 5, 24)).toBe(0);
  });
});

describe("pageSlice", () => {
  const items = Array.from({ length: 60 }, (_, i) => i);

  it("returns the window for the page", () => {
    expect(pageSlice(items, 1, 24)).toEqual(items.slice(24, 48));
  });
  it("clamps a page past the end rather than returning nothing", () => {
    expect(pageSlice(items, 99, 24)).toEqual(items.slice(48));
  });
  it("covers every item exactly once across all pages", () => {
    const seen: number[] = [];
    for (let p = 0; p < pageCount(items.length, 24); p++) {
      seen.push(...pageSlice(items, p, 24));
    }
    expect(seen).toEqual(items);
  });
});

describe("pageRangeLabel", () => {
  it("reads as a human range", () => {
    expect(pageRangeLabel(60, 0, 24)).toBe("1-24 of 60");
    expect(pageRangeLabel(60, 2, 24)).toBe("49-60 of 60");
  });
  it("says nothing misleading about an empty list", () => {
    expect(pageRangeLabel(0, 0, 24)).toBe("0 of 0");
  });
});

describe("categoryStateKey", () => {
  // "Other" exists in both the Active and the Inactive section. One shared key
  // would make expanding it in one section expand it in the other, and page 3
  // of one would become page 3 of the other.
  it("scopes a category key to its section", () => {
    expect(categoryStateKey("active", "other")).not.toBe(
      categoryStateKey("inactive", "other"),
    );
  });
  it("is stable for the same section and category", () => {
    expect(categoryStateKey("active", "other")).toBe(categoryStateKey("active", "other"));
  });
});
