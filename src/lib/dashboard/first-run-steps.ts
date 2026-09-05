// ═══════════════════════════════════════════════════════════════
// first-run-steps.ts — what a brand-new install still has to do
// ═══════════════════════════════════════════════════════════════
//
// The dashboard on a fresh install is a wall of zeros: no processes, no
// sessions, no missions, no memory, and a hardcoded green ONLINE badge next to
// an agent that is not installed. Every widget is technically correct and the
// screen says nothing about what to do first, which is where a stranger's first
// install dies.
//
// The rule this encodes: an empty install should read as a checklist, not as a
// broken one. The derivation lives here rather than in the panel so it can be
// tested without rendering React, matching dashboard-error-dedup.ts and
// dashboard-model-subtitle.ts alongside it.

/** Where an operator without an agent installed has to go. Matches README. */
export const AGENT_INSTALL_DOCS =
  "https://hermes-agent.nousresearch.com/docs/getting-started/installation";

export interface FirstRunFacts {
  /** Display name of the active agent framework, e.g. "Hermes". */
  frameworkName: string;
  /**
   * Whether that framework is actually installed and configured on this
   * machine. False on a PatterStage install that has never had an agent.
   */
  frameworkAvailable: boolean;
  /**
   * A gateway is configured and answered the health probe (T-0092). With no
   * local install this is where the work runs, and the copy has to say so
   * instead of "nothing will run".
   */
  gatewayReachable?: boolean;
  gatewayUrl?: string | null;
  /**
   * A model the agent can call is configured (config.yaml's default or the
   * registry's agent slot). The step the checklist used to omit, and the one
   * whose absence made "Dispatch your first mission" fail before it started
   * (T-0099, D110).
   */
  modelConfigured?: boolean;
  sessionCount: number;
  missionCount: number;
}

export interface FirstRunStep {
  id: "agent" | "model" | "mission" | "sessions";
  title: string;
  /** One sentence. The panel is a signpost, not documentation. */
  detail: string;
  href: string;
  /** True when href leaves the app (agent install docs). */
  external: boolean;
  done: boolean;
}

/**
 * Show the checklist while the install has produced nothing at all, and keep
 * showing it for as long as there is no agent to dispatch to. Once a mission or
 * a session exists AND the agent is configured, the operator is past first run
 * and the panel gets out of the way for good.
 */
export function shouldShowFirstRun(facts: FirstRunFacts): boolean {
  // A reachable gateway is a usable agent: the checklist behaves as it does
  // for a local install and hides once something has run (T-0092).
  const usable = facts.frameworkAvailable || facts.gatewayReachable === true;
  if (!usable) return true;
  return facts.sessionCount === 0 && facts.missionCount === 0;
}

/**
 * Settle a new reading of the facts against the previous one.
 *
 * The gateway is probed every fifteen seconds and a single failed probe used to
 * flip the headline from "runs through a gateway" to "is not installed on this
 * machine" and back (T-0099, D57). A gateway that has answered once is a
 * gateway this install has; it stays reachable for the checklist's purposes,
 * and its address is kept when the next reading has none. Nothing else is
 * latched: counts, the framework and the model follow the newest reading.
 */
export function settleFirstRunFacts(prev: FirstRunFacts | null, next: FirstRunFacts): FirstRunFacts {
  if (!prev) return next;
  const reachable = next.gatewayReachable === true || prev.gatewayReachable === true;
  if (!reachable) return next;
  return {
    ...next,
    gatewayReachable: true,
    gatewayUrl: next.gatewayUrl ?? prev.gatewayUrl ?? null,
  };
}

/** The checklist, in the order the steps actually have to happen. */
export function firstRunSteps(facts: FirstRunFacts): FirstRunStep[] {
  const agent = facts.frameworkName || "your agent";
  const remote = !facts.frameworkAvailable && facts.gatewayReachable === true;
  return [
    {
      id: "agent",
      title: facts.frameworkAvailable
        ? `${agent} is installed`
        : remote
          ? `${agent} runs through a gateway`
          : `Install ${agent}`,
      detail: facts.frameworkAvailable
        ? `PatterStage found a configured ${agent} install on this machine.`
        : remote
          ? `No local ${agent} install, but a gateway at ${facts.gatewayUrl ?? "the configured address"} is configured and reachable; missions will run there.`
          : `PatterStage is the control plane; ${agent} is the agent that does the work, and nothing can be dispatched until it is installed on this machine.`,
      href: AGENT_INSTALL_DOCS,
      external: true,
      done: facts.frameworkAvailable || remote,
    },
    {
      id: "model",
      title: facts.modelConfigured === true ? "A model is configured" : "Give your agent a model",
      detail:
        facts.modelConfigured === true
          ? "The agent has a model to call. Change it or add more on the Models page."
          : "Pick the model the agent calls and the key it uses; without one, the first mission fails before it starts.",
      href: "/agent/models",
      external: false,
      done: facts.modelConfigured === true,
    },
    {
      id: "mission",
      title: facts.missionCount > 0 ? "First mission dispatched" : "Dispatch your first mission",
      detail:
        facts.missionCount > 0
          ? "Missions are how you give the agent work. Compose, schedule and cancel them here."
          : "Pick one of the bundled templates, review the prompt it fills in, and send it.",
      href: "/work/missions",
      external: false,
      done: facts.missionCount > 0,
    },
    {
      id: "sessions",
      title: facts.sessionCount > 0 ? "Transcripts are arriving" : "Read what the agent did",
      detail:
        facts.sessionCount > 0
          ? "Every run leaves a transcript you can read back."
          : "Once a run finishes, its full transcript shows up in the session browser.",
      href: "/results/sessions",
      external: false,
      done: facts.sessionCount > 0,
    },
  ];
}
