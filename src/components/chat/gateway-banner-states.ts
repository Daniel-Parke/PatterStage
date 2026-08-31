// ═══════════════════════════════════════════════════════════════
// gateway-banner-states — which connection banners the chat page shows
//
// Extracted from four nested JSX conditions in the chat page so the rule is
// something a test can read. It is a decision, not a rendering: it takes the
// probe results and the conversation state and returns the banners to draw,
// in order.
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

  const onEmptyChat = !hasActiveConversation && messageCount === 0;
  if (!onEmptyChat) return [];

  const states: GatewayBannerState[] = [];
  if (gatewayOnline === false) states.push("offline");
  if (gatewayOnline === true && gatewayAuthConfigured === false) states.push("auth-missing");
  if (gatewayOnline !== false && gatewayAuthConfigured !== false && agentDefaultModelSet === false) {
    states.push("model-missing");
  }
  if (gatewayOnline === null) states.push("checking");
  return states;
}
