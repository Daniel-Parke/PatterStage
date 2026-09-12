// profile-counts.ts: "how much is switched on for this profile?" The toolsets
// count answers from the database alone; the skills count also reads the agent's
// skills tree, because the Skills page merges the catalogue with the tree, and
// counting the catalogue alone described 78 usable skills as 4. Nothing here writes.

import { getProfile, hydratePlatformToolsetsForSlug } from "./profiles-repository";
import { unionToolsetsFromPlatforms } from "./toolset-unify";
import {
  listCatalogSkillKeys,
  resolveEffectiveDisabledSkills,
} from "./effective-disabled-skills";

/** Count the toolsets this profile enables, unioned across platforms. */
export function countProfileToolsets(slug: string): number {
  const hydrated = hydratePlatformToolsetsForSlug(slug === "default" ? "default" : slug);
  if (!hydrated) return 0;
  return unionToolsetsFromPlatforms(hydrated.toolsets).length;
}

/**
 * How many skills this profile may use: the SAME set the Skills page lists.
 * This used to subtract the denylist from `countSkills()`, the SQLite catalogue
 * row count, while GET /api/skills lists the catalogue UNION the agent's tree:
 * a card read "4 skills" beside a page listing 78, and since disk-only keys join
 * the denylist too, four toggles pinned it at "0 skills" with 74 still enabled.
 * Union minus effective denylist agrees by construction; for a batch use `createProfileSkillsCounter`.
 */
export function countProfileSkills(slug: string): number {
  return createProfileSkillsCounter()(slug);
}

/** The same count for a batch, holding the catalogue between profiles: it is
 * profile-INDEPENDENT (`skillsRootForProfile()` takes no argument), so P calls did
 * P identical walks of one tree. GET /api/agent/profiles and the Agents-page strip
 * both count here. Not memoised across calls: a toggled skill must move the next read. */
export function createProfileSkillsCounter(): (slug: string) => number {
  const catalogKeys = listCatalogSkillKeys();

  return (slug: string): number => {
    // Ahead of the denylist read: getDisabledSkills answers [] for a missing profile, crediting it everything.
    if (slug !== "default" && !getProfile(slug)) return 0;

    const disabled = resolveEffectiveDisabledSkills(slug, { catalogKeys });
    return catalogKeys.filter((key) => !disabled.has(key)).length;
  };
}
