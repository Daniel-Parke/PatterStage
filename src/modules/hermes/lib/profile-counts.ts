// ═══════════════════════════════════════════════════════════════
// profile-counts.ts: "how much is switched on for this profile?"
//
// Split out of profile-sync.ts, where these two sat among the disk
// operations and read as if they walked the filesystem. They do not.
// Both answer from the DATABASE, and the distinction matters: the
// skills count is derived from the denylist (total minus disabled),
// so a skill present on disk but absent from the catalog does not
// inflate it, and a profile whose row is missing counts zero rather
// than falling back to the disk tree.
//
// Nothing here writes, and nothing here touches the agent's
// filesystem, which is why it is not part of the sync family at all.
// ═══════════════════════════════════════════════════════════════

import { getAgentRoot } from "@/lib/agent-root-repository";
import { listSkills } from "@/lib/skills-repository";
import { getProfile, hydratePlatformToolsetsForSlug } from "./profiles-repository";
import { unionToolsetsFromPlatforms } from "./toolset-unify";
import { disabledSkillsFromJson } from "./profile-config-builder";

/** Count enabled skills from DB denylist (not disk tree). */
export function countProfileToolsets(slug: string): number {
  const hydrated = hydratePlatformToolsetsForSlug(slug === "default" ? "default" : slug);
  if (!hydrated) return 0;
  return unionToolsetsFromPlatforms(hydrated.toolsets).length;
}

export function countProfileSkills(slug: string): number {
  const total = listSkills().length;
  if (slug === "default") {
    const row = getAgentRoot();
    return Math.max(0, total - disabledSkillsFromJson(row.disabledSkillsJson).length);
  }
  const profile = getProfile(slug);
  if (!profile) return 0;
  return Math.max(0, total - disabledSkillsFromJson(profile.disabledSkillsJson).length);
}
