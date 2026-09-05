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
// Deliberately narrow. `HermesPathBundle` has 19 fields; core needs seven, and
// the other twelve (profiles, skills, soul, cronJobs, hindsightConfig) are
// Hermes' own layout and belong to the hermes surfaces that already import it
// directly. A neutral interface that mirrored all nineteen would just be the
// Hermes bundle wearing a different name.
//
// Five became seven in Phase 7 (T-0014), when the two API routes still calling
// getActiveHermesPaths() for a directory came through here instead. Neither
// addition is a new idea; each finishes an answer this port was already giving
// half of:
//
//   sessions  GET /api/sessions/[id] reads transcripts out of the agent's
//             state DB through state-db.ts already. `sessions` is the same
//             question asked of the filesystem, for transcripts written
//             before that DB existed.
//   backups   PUT /api/config writes the file this port hands out as
//             `config`, and backs it up first. A write path without its
//             backup path is half a port, so the route was reaching around
//             the seam for the other half.
//
// `skills` deliberately did NOT join them, though the skills route was in the
// same sweep. A skills tree is an authoring layout, Hermes-shaped in a way a
// transcript or backup directory is not, so that route says so in a pragma
// rather than borrowing this file's neutrality for a path that has none.
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
  /** Directory the agent keeps timestamped copies of overwritten files in. */
  backups: string;
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
    backups: paths.backups,
    sessions: paths.sessions,
    memoryDb: paths.memoryDb,
  };
}
