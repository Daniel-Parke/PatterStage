// gateway-banner-states — which connection banners the chat page shows: a
// decision, not a rendering, so a test can read the rule.
//
// THE RULE (P0-5). All four banners were gated behind an EMPTY chat, so the
// operator who had just watched a turn fail could not see the "start it with"
// sentence. Two banners BLOCK the send (gateway off, key refused) and show
// wherever the operator is; two are advisory (configuration guidance, a
// first-load spinner) and stay on the empty chat, because a banner over a
// working conversation teaches the operator to ignore the two that matter.

export type GatewayBannerState = "offline" | "auth-missing" | "model-missing" | "checking";

export interface BannerInputs {
  /** Gateway reachable. `null` while the first probe is in flight. */
  gatewayOnline: boolean | null;
  /** Gateway answered but accepted our bearer key. `null` when unreachable. */
  gatewayAuthConfigured: boolean | null;
  /**
   * From the one readiness answer the server resolves (model-readiness.ts),
   * never re-derived: an AND of registry and config file here accused a working
   * install of having no model. `null` while unknown draws no banner.
   */
  modelReady: boolean | null;
  hasActiveConversation: boolean;
  messageCount: number;
}

export function bannerStatesFor(input: BannerInputs): GatewayBannerState[] {
  const {
    gatewayOnline,
    gatewayAuthConfigured,
    modelReady,
    hasActiveConversation,
    messageCount,
  } = input;

  const states: GatewayBannerState[] = [];

  // Blocking: shown wherever the operator is. Mutually exclusive by
  // construction: `auth-missing` requires the gateway to have ANSWERED.
  if (gatewayOnline === false) states.push("offline");
  else if (gatewayOnline === true && gatewayAuthConfigured === false) states.push("auth-missing");

  // Advisory: only where there is room for it.
  const onEmptyChat = !hasActiveConversation && messageCount === 0;
  if (!onEmptyChat) return states;

  if (gatewayOnline !== false && gatewayAuthConfigured !== false && modelReady === false) {
    states.push("model-missing");
  }
  if (gatewayOnline === null) states.push("checking");
  return states;
}
