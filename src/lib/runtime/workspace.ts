// ═══════════════════════════════════════════════════════════════
// runtime/workspace.ts — where the agent keeps its files, framework-neutrally
//
// The AgentRuntime port covers what the agent DOES (submit, poll, stop,
// approve). It says nothing about where the agent's install lives, and core
// needed that too: log tailing, config drift, env sync, memory size, the
// sessions root. So thirteen modules in src/lib called getActiveHermesPaths()
// directly, and PatterStage's "framework-agnostic" claim was false in a way a
// grep could prove (docs/adr/0005, "the hermes module").
//
// This is the missing half of the port: a small, neutral view of an agent
// workspace. Core depends on THIS; only this file knows the answer comes from
// Hermes today.
//
// Deliberately narrow. `HermesPathBundle` has 19 fields; core only ever needed
// five, and the other fourteen (profiles, skills, soul, cronJobs, hindsightConfig)
// are Hermes' own layout and belong to the hermes surfaces that already import
// it directly. A neutral interface that mirrored all nineteen would just be the
// Hermes bundle wearing a different name.
// ═══════════════════════════════════════════════════════════════

import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";

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
    memoryDb: paths.memoryDb,
  };
}
