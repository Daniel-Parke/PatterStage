// ═══════════════════════════════════════════════════════════════
// first-run-steps.ts — what the dashboard latched about a first run
// ═══════════════════════════════════════════════════════════════
//
// The four-step checklist and FirstRunPanel went with the quests (T-0111, B17).
// Two things stayed, with callers outside the checklist: AGENT_INSTALL_DOCS,
// which AgentSetupNotice sends an operator with no agent to, and
// settleFirstRunFacts, the gateway latch: one failed probe of the
// fifteen-second gateway poll used to flip the dashboard's agent badge from
// "runs through a gateway" to "not installed" and back (T-0099, D57). The
// filename is kept because renaming it would churn every importer for no behaviour.

/** Where an operator without an agent installed has to go. Matches README. */
export const AGENT_INSTALL_DOCS =
  "https://hermes-agent.nousresearch.com/docs/getting-started/installation";

export interface FirstRunFacts {
  /** Display name of the active agent framework, e.g. "Hermes". */
  frameworkName: string;
  /** Whether that framework is installed and configured on this machine. */
  frameworkAvailable: boolean;
  /**
   * A gateway is configured and answered the health probe (T-0092): with no
   * local install this is where the work runs, and the badge has to say so.
   */
  gatewayReachable?: boolean;
  gatewayUrl?: string | null;
  /**
   * A model the agent can call is configured. Not latched, and read by the
   * dashboard rather than by this module (T-0099, D110).
   */
  modelConfigured?: boolean;
  sessionCount: number;
  missionCount: number;
}

/**
 * A gateway that has answered once stays reachable, and its address is kept
 * when the next reading has none. Nothing else is latched: counts, framework
 * and model follow the newest reading, because the operator can change those.
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
