// ═══════════════════════════════════════════════════════════════
// agents/roster.ts — the neutral view of which agents exist (CORE)
//
// `agent_profiles` belongs to the hermes module (owner ruling, 2026-07-25, and
// ADR-0005 rule 2: a module owns its own tables). Every content column of that
// table mirrors a Hermes file: config_yaml, soul_md, agents_md, user_md,
// memory_md, disabled_skills, platform_toolsets.
//
// But core still has one honest question to ask about agents: WHICH ONES EXIST,
// so the `commission` verb can resolve what the operator typed into a canonical
// identifier. That question is framework-neutral, and its answer needs exactly
// two fields. This is the whole seam.
//
// Deliberately NOT a re-export of AgentProfileRow. That row has 17 fields, most
// of them a vendor's file contents; handing it to core would be the module's
// table wearing a neutral name, which is the mistake ADR-0005 exists to stop.
// ═══════════════════════════════════════════════════════════════

import { SERVER_MODULES } from "@/lib/modules/server";

/** An agent core can dispatch work to. */
export interface AgentRosterEntry {
  /** Canonical identifier, stable across renames of the display name. */
  slug: string;
  /** What the operator sees. Falls back to the slug when unset. */
  displayName: string;
}

/**
 * Every agent every module knows about.
 *
 * Returns [] rather than throwing when no module supplies a roster: an operator
 * with no agent installed should see an empty picker, not a crash.
 */
export function listAgentRoster(): AgentRosterEntry[] {
  return SERVER_MODULES.flatMap((m) => {
    try {
      return m.listAgentRoster?.() ?? [];
    } catch {
      // A module whose store is unreadable must not take the dispatch path down
      // with it. The caller falls back to the raw key the operator supplied.
      return [];
    }
  });
}

/**
 * Resolve whatever the operator typed (a slug OR a display name) to a canonical
 * slug.
 *
 * Returns `key` unchanged when nothing matches, which preserves the behaviour
 * dispatch relied on: an unknown profile is passed through to the runtime rather
 * than rejected here, so the error surfaces from the thing that actually knows
 * the profile does not exist.
 */
export function resolveAgentSlug(key: string): string {
  if (key === "default") return "default";
  const roster = listAgentRoster();
  const match = roster.find((a) => a.slug === key || a.displayName === key);
  return match?.slug ?? key;
}
