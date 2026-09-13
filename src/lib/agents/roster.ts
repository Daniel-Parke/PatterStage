// agents/roster.ts — the neutral view of which agents exist (CORE).
// `agent_profiles` belongs to the hermes module (owner ruling, 2026-07-25, and
// ADR-0005 rule 2: a module owns its own tables), its content columns mirroring
// Hermes files. Core still asks WHICH agents exist, so `commission` can resolve
// what the operator typed to a canonical identifier: two fields, the whole seam.
// Deliberately NOT a re-export of AgentProfileRow: 17 fields of vendor file
// contents under a neutral name is the mistake ADR-0005 exists to stop.

import { SERVER_MODULES } from "@/lib/modules/server";

/** An agent core can dispatch work to. */
export interface AgentRosterEntry {
  /** Canonical identifier, stable across renames of the display name. */
  slug: string;
  /** What the operator sees. Falls back to the slug when unset. */
  displayName: string;
}

/** Every agent every module knows about. [] rather than a throw when no module
 * supplies a roster: no agent installed is an empty picker, not a crash. */
export function listAgentRoster(): AgentRosterEntry[] {
  return SERVER_MODULES.flatMap((m) => {
    try {
      return m.listAgentRoster?.() ?? [];
    } catch {
      // An unreadable module store must not take dispatch down; the caller falls back to the raw key.
      return [];
    }
  });
}

/** A slug OR a display name to a canonical slug; `key` unchanged when nothing
 * matches, so an unknown profile is rejected by the runtime that knows it, not here. */
export function resolveAgentSlug(key: string): string {
  if (key === "default") return "default";
  const roster = listAgentRoster();
  const match = roster.find((a) => a.slug === key || a.displayName === key);
  return match?.slug ?? key;
}
