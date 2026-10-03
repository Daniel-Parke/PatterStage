// ═══════════════════════════════════════════════════════════════
// agents/agent-skills-count.ts — how many skills an agent may use (CORE)
//
// The skills CATALOGUE is core's table. The SET one agent may use is not: it is
// that catalogue unioned with the skills sitting in the agent's own tree, minus
// the denylist its config declares, and both halves are a framework's file
// layout. So core asks for the number through the composition root rather than
// doing the arithmetic itself (ADR-0005), the same way it asks which agents
// exist (agents/roster.ts).
//
// The reason this exists at all: the Agents page renders the number twice, once
// on each profile card (through the module, from the route) and once on the
// performance strip (through /api/stats, from core). While core did its own sum
// the two disagreed on the same screen, by 4 against 78 on the install that
// found it. One function, asked from both sides.
// ═══════════════════════════════════════════════════════════════

import { SERVER_MODULES } from "@/lib/modules/server";

/**
 * A skills counter for a batch of agents, built once per read.
 *
 * Batch-shaped because the expensive half is the same for every agent: the
 * module walks one skills tree, and only the per-agent denylist differs. Asked
 * once per agent instead, a list of P agents paid for P identical walks.
 *
 * The first module that answers owns the agent population, which today is the
 * one framework module. A second would need a slug-to-module map rather than
 * this fold, and that is a decision for whoever adds it.
 *
 * Degrades to zero rather than throwing, matching roster.ts: an install with no
 * agent module, or one whose store is unreadable, must leave the rest of the
 * dashboard standing.
 */
export function createAgentSkillsCounter(): (slug: string) => number {
  for (const mod of SERVER_MODULES) {
    if (!mod.createAgentSkillsCounter) continue;
    try {
      const count = mod.createAgentSkillsCounter();
      return (slug: string) => {
        try {
          return count(slug);
        } catch {
          return 0;
        }
      };
    } catch {
      return () => 0;
    }
  }
  return () => 0;
}
