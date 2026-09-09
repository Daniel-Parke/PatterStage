// runtime/workspace.ts — where the agent keeps its files, framework-neutrally.
//
// The AgentRuntime port covers what the agent DOES, not where its install
// lives, so thirteen core modules called getActiveHermesPaths() and the
// "framework-agnostic" claim was false (ADR-0005, "the hermes module"). Core
// depends on THIS; only this file knows the answer is Hermes today. Narrow on
// purpose: seven of the bundle's 19 fields, the rest being Hermes' own layout.
// `sessions` and `backups` joined in Phase 7 (T-0014) for the transcript and
// config routes; `skills` did not, a skills tree being an authoring layout
// with no neutrality to borrow, and that route says so in a pragma.

import { getActiveHermesPaths } from "@/modules/hermes/lib/agent-runtime";

export interface AgentWorkspace {
  root: string;
  logs: string;
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

/** The active agent's workspace, via the Hermes paths today. When a second
 *  framework lands, this is the one function that consults the registry. */
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
