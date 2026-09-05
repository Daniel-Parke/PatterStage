// ═══════════════════════════════════════════════════════════════
// skills-known.ts — does the agent have this skill at all?
// ═══════════════════════════════════════════════════════════════
//
// GET /api/skills merges the SQLite catalogue with a scan of the agent's
// skills directory, so a skill that is on disk and not yet imported appears in
// the list like any other. The toggle route asked only the catalogue and
// answered "Skill not in catalog", so the operator clicked a control on a row
// the product had just shown them and was told the thing did not exist
// (T-0103, D82).
//
// This lives under modules/ rather than lib/ because knowing where an agent
// keeps its skills is adapter knowledge, and ADR-0005 forbids core importing
// a module.

import { getSkill } from "@/lib/skills-repository";
import { scanDiskSkillsCatalog } from "./profile-discovery";

/** True when the catalogue holds the skill, or the agent's disk does. */
export function skillIsKnown(name: string): boolean {
  if (getSkill(name)) return true;
  try {
    return scanDiskSkillsCatalog().some((s) => s.skillKey === name);
  } catch {
    // A missing or unreadable skills directory is not a reason to refuse a
    // catalogue skill; getSkill above already answered for that case.
    return false;
  }
}
