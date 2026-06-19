/** @jest-environment node */
// Pure derivations extracted from the Skills Manager page
// (lib/skills-page-helpers.ts).

import {
  effectiveSkillEnabled,
  filterBySearch,
  groupCategories,
} from "@/lib/skills-page-helpers";
import type { Skill } from "@/types/hermes";

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
});
