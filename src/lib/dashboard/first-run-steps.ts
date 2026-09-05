// ═══════════════════════════════════════════════════════════════
// first-run-steps.ts — what the dashboard latched about a first run
// ═══════════════════════════════════════════════════════════════
//
// This file used to derive a four-step checklist for a brand-new install, and
// FirstRunPanel rendered it. The quests replaced both (T-0111, B17): they are
// the same checklist, thirty-two steps long instead of four, proved by events
// the server already records rather than by four facts the dashboard happened
// to have in hand, and they keep answering "what now?" long after a first
// mission has run. The steps, the panel and `shouldShowFirstRun` went with it.
//
// Two things stayed, and both have callers outside the checklist:
//
//   - AGENT_INSTALL_DOCS, which AgentSetupNotice sends an operator with no
//     agent installed to;
//   - settleFirstRunFacts, the gateway latch. The gateway is probed every
//     fifteen seconds and one failed probe used to flip the dashboard's agent
//     badge from "runs through a gateway" to "not installed" and back
//     (T-0099, D57). That is the defect this function closes, and it is why
//     it did not go with the panel it was written for.
//
// The filename is now a slight lie and is kept anyway: renaming it would churn
// every importer for no behaviour, and the header says what is actually here.

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
   * local install this is where the work runs, and the badge has to say so
   * instead of "nothing will run".
   */
  gatewayReachable?: boolean;
  gatewayUrl?: string | null;
  /**
   * A model the agent can call is configured (config.yaml's default or the
   * registry's agent slot). Not latched, and read by the dashboard rather than
   * by this module (T-0099, D110).
   */
  modelConfigured?: boolean;
  sessionCount: number;
  missionCount: number;
}

/**
 * Settle a new reading of the facts against the previous one.
 *
 * A gateway that has answered once is a gateway this install has; it stays
 * reachable, and its address is kept when the next reading has none. Nothing
 * else is latched: counts, the framework and the model follow the newest
 * reading, because those are states the operator can actually change and a
 * latch would go on reporting the old one.
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
