// ═══════════════════════════════════════════════════════════════
// skills-page-helpers.ts — pure derivations for the Skills Manager page
// ═══════════════════════════════════════════════════════════════
//
// Extracted from app/operations/skills/page.tsx so the optimistic-toggle
// resolution + search/grouping derivations are pure + unit-testable.

import { groupByCategory, titleCaseCategory } from "@/lib/skills-grouping";
import { filterByCaseInsensitiveSubstring } from "@/lib/list-search";
import type { Skill } from "@/types/hermes";

/**
 * The "effective" enabled state of a skill after applying any pending
 * optimistic toggle. Reads `pending[skill.name]` (the in-flight mutation)
 * and falls back to the supplied value (defaults to the server's
 * `skill.enabled`). The Inactive section passes `!skill.enabled` as the
 * fallback because that grid is the negation of the active state.
 */
export function effectiveSkillEnabled(
  skill: Skill,
  pending: Record<string, boolean>,
  fallback: boolean = skill.enabled,
): boolean {
  return pending[skill.name] ?? fallback;
}

/** Case-insensitive search over a skill's name + description. */
export function filterBySearch(skills: Skill[], search: string) {
  return filterByCaseInsensitiveSubstring(skills, search, [
    (s) => s.name,
    (s) => s.description,
  ]);
}

/**
 * Case-insensitive grouping into { category, skills } buckets, each sorted
 * by name. The display name is the title-cased first item's original case,
 * which keeps a polished label even when the underlying category values
 * vary in case (the "Creative" vs "creative" mismatch class of bug).
 */
export function groupCategories(skills: Skill[]) {
  return groupByCategory(skills, "Other").map(([key, items]) => ({
    category: titleCaseCategory(items[0].category) || titleCaseCategory(key),
    skills: items.sort((x, y) => x.name.localeCompare(y.name)),
  }));
}
