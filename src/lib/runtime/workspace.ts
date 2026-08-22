// ═══════════════════════════════════════════════════════════════
// runtime/workspace.ts — where the agent keeps its files, framework-neutrally
//
// The AgentRuntime port covers what the agent DOES (submit, poll, stop,
// approve). It says nothing about where the agent's install lives, and core
// needed that too: log tailing, config drift, env sync, memory size, the
// sessions root. So thirteen modules in src/lib called getActiveHermesPaths()
// directly, and PatterStage's "framework-agnostic" claim was false in a way a
// grep could prove (org/decisions/ADR-0005, "the hermes module").
//
// This is the missing half of the port: a small, neutral view of an agent
// workspace. Core depends on THIS; only this file knows the answer comes from
// Hermes today.
//
// Deliberately narrow. `HermesPathBundle` has 19 fields; core needs six, and
// the other thirteen (profiles, skills, soul, cronJobs, hindsightConfig) are
// Hermes' own layout and belong to the hermes surfaces that already import it
// directly. A neutral interface that mirrored all nineteen would just be the
// Hermes bundle wearing a different name.
//
// Five became six in Phase 7 (T-0014), when GET /api/sessions/[id] stopped
// calling getActiveHermesPaths() and came through here instead. `sessions`
// answers a question this port was already half-answering: it reads transcripts
// out of the agent's state DB in state-db.ts, and `sessions` is the same
// question asked of the filesystem, for transcripts written before that DB
// existed.
//
// `skills` deliberately did NOT join it, though the skills route was in the
// same sweep. A skills tree is an authoring layout, Hermes-shaped in a way a
// transcript directory is not, so that route says so in a pragma rather than
// borrowing this file's neutrality for a path that has none.
// ═══════════════════════════════════════════════════════════════

import { getActiveHermesPaths } from "@/modules/hermes/lib/agent-runtime";

/** The parts of an agent's on-disk workspace that PatterStage core cares about. */
export interface AgentWorkspace {
  /** Root of the agent's data directory. */
  root: string;
  /** Directory the agent writes logs into. */
  logs: string;
  /** Main configuration file. */
  config: string;
  /** Environment file holding provider credentials. */
  env: string;
  /** Directory the agent writes session transcripts into. */
  sessions: string;
  /** Local long-term-memory store. */
  memoryDb: string;
}

/**
 * The active agent's workspace.
 *
 * Resolves through the Hermes paths today. When a second framework lands, this
 * is the one function that consults the framework registry, and nothing above
 * it changes.
 */
export function getAgentWorkspace(): AgentWorkspace {
  const paths = getActiveHermesPaths();
  return {
    root: paths.root,
    logs: paths.logs,
    config: paths.config,
    env: paths.env,
    sessions: paths.sessions,
    memoryDb: paths.memoryDb,
  };
}
