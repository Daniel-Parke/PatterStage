// ═══════════════════════════════════════════════════════════════
// gateway-banner-states — which connection banners the chat page shows
//
// Extracted from four nested JSX conditions in the chat page so the rule is
// something a test can read. It is a decision, not a rendering: it takes the
// probe results and the conversation state and returns the banners to draw,
// in order.
//
// THE RULE, and why it changed (P0-5). All four banners used to be gated behind
// an EMPTY chat, so the operator most likely to need one -- mid-conversation,
// having just watched a turn fail -- was the one who could not see it. The
// actionable "start it with" sentence was unreachable at exactly the moment it
// became actionable.
//
// The gate is not simply removed, because the four states are not one kind of
// thing. Two of them BLOCK the send: the gateway is off, or it refused our key.
// Those are facts about whether the product works right now, and they show
// wherever the operator is. The other two are advisory -- configuration
// guidance and a first-load spinner -- and a banner that appears above a
// working conversation every thirty seconds teaches the operator to ignore
// banners, including the two that matter.
// ═══════════════════════════════════════════════════════════════

export type GatewayBannerState = "offline" | "auth-missing" | "model-missing" | "checking";

export interface BannerInputs {
  /** Gateway reachable. `null` while the first probe is in flight. */
  gatewayOnline: boolean | null;
  /** Gateway answered but accepted our bearer key. `null` when unreachable. */
  gatewayAuthConfigured: boolean | null;
  /** Both the registry and the on-disk config name an agent default model. */
  agentDefaultModelSet: boolean | null;
  hasActiveConversation: boolean;
  messageCount: number;
}

export function bannerStatesFor(input: BannerInputs): GatewayBannerState[] {
  const {
    gatewayOnline,
    gatewayAuthConfigured,
    agentDefaultModelSet,
    hasActiveConversation,
    messageCount,
  } = input;

  const states: GatewayBannerState[] = [];

  // Blocking: shown wherever the operator is.
  //
  // These two are mutually exclusive by construction, and deliberately so.
  // `auth-missing` requires the gateway to have ANSWERED, which is the thing
  // `offline` denies. Showing both would be two contradictory readings of one
  // probe.
  if (gatewayOnline === false) states.push("offline");
  else if (gatewayOnline === true && gatewayAuthConfigured === false) states.push("auth-missing");

  // Advisory: only where there is room for it.
  const onEmptyChat = !hasActiveConversation && messageCount === 0;
  if (!onEmptyChat) return states;

  if (gatewayOnline !== false && gatewayAuthConfigured !== false && agentDefaultModelSet === false) {
    states.push("model-missing");
  }
  if (gatewayOnline === null) states.push("checking");
  return states;
}
