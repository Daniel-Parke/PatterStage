// ═══════════════════════════════════════════════════════════════
// GatewayBanner — Connection-status banners for the chat page
// ═══════════════════════════════════════════════════════════════
//
// Four states are surfaced as full-width banners: gateway offline
// (red), gateway up but unauthenticated (orange), agent default model
// missing (orange), and gateway check still in-flight (muted spinner).
// All share the same outer card layout and only differ in colour, icon,
// title, and body content.
//
// WHICH of them show WHERE is not decided here -- see
// `gateway-banner-states.ts`, which the page reads. This file draws what
// it is told to draw.

"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

import type { GatewayBannerState } from "./gateway-banner-states";

type GatewayStatus = GatewayBannerState;

interface GatewayBannerProps {
  status: GatewayStatus;
  /**
   * The gateway that was actually probed, e.g. `http://127.0.0.1:8652`.
   *
   * This banner used to say "port 8642" as a literal, and said it while the
   * gateway was on 8652 -- sending the operator to check a port that was not
   * the one that was down (T-0080). `null` while the first probe is in flight,
   * and the copy then omits the address rather than inventing one.
   */
  gatewayUrl?: string | null;
}

/**
 * Inline emphasis tokens for body text. The body string is split on
 * `{code}…{/code}` segments; odd-indexed segments render as <code>.
 */
function renderBody(body: string) {
  const segments = body.split(/(\{code\}.*?\{\/code\})/g);
  return segments.map((segment, i) => {
    const isCode = segment.startsWith("{code}") && segment.endsWith("{/code}");
    if (!isCode) return <span key={i}>{segment}</span>;
    const text = segment.slice("{code}".length, -"{/code}".length);
    const tone = i === 1 ? "text-neon-cyan" : "text-ps-text-muted";
    return (
      <code key={i} className={tone}>
        {text}
      </code>
    );
  });
}

function copyFor(
  status: GatewayStatus,
  gatewayUrl: string | null,
): { tone: "red" | "orange" | "muted"; title: string; body: string } {
  if (status !== "offline") return COPY[status];
  // Naming the address is the whole point, so it goes in as a {code} token
  // rather than prose -- an operator copying it into a curl or a browser bar
  // should get exactly what PatterStage tried.
  //
  // It goes SECOND deliberately. `renderBody` emphasises the first code token
  // and mutes the rest, and across all three banners that first token is the
  // thing to act on: the key to set, the command to run. Leading with the
  // address would move the emphasis onto a fact and away from the remedy.
  const where = gatewayUrl ? ` PatterStage is looking for it at {code}${gatewayUrl}{/code}.` : "";
  return {
    tone: "red",
    title: "Gateway Offline",
    body:
      "The Hermes Gateway is not responding. " +
      `Start it with: {code}hermes gateway start{/code}.${where}`,
  };
}

const COPY: Record<
  GatewayStatus,
  { tone: "red" | "orange" | "muted"; title: string; body: string }
> = {
  offline: {
    tone: "red",
    title: "Gateway Offline",
    body:
      "The Hermes Gateway is not responding. " +
      "Start it with: {code}hermes gateway start{/code}",
  },
  "auth-missing": {
    tone: "orange",
    title: "Gateway up — PatterStage can't authenticate",
    body:
      "The gateway is reachable but rejected PatterStage's request (401). " +
      // design-lint-disable-next-line hermes-outside-adapter -- recovery instructions for a 401 the operator is looking at. Naming both files they must put the key in is the entire remedy; a banner that said "set it somewhere" would not be a banner.
      "Set {code}API_SERVER_KEY{/code} in {code}~/.hermes/.env{/code}, mirror it " +
      "into {code}~/patterstage/.env.local{/code}, and restart PatterStage.",
  },
  "model-missing": {
    tone: "orange",
    title: "Model not ready for chat",
    body:
      "Set an agent default under Config → Models, push to Hermes (or " +
      "Operations → Agents → Push Bob), or run {code}hermes model{/code}. " +
      // design-lint-disable-next-line hermes-outside-adapter -- this sentence exists to correct a specific operator misconception: that the chat dropdown label selects the inference model. Saying which file actually decides is what corrects it.
      "The gateway reads {code}~/.hermes/config.yaml{/code} model.default — " +
      "the chat dropdown label alone does not change inference.",
  },
  checking: {
    tone: "muted",
    title: "Checking gateway connection...",
    body: "",
  },
};

export default function GatewayBanner({ status, gatewayUrl = null }: GatewayBannerProps) {
  const copy = copyFor(status, gatewayUrl);

  if (copy.tone === "muted") {
    return (
      <div className="flex items-center gap-2 mb-4 justify-center">
        <Loader2 className="w-3 h-3 text-ps-text-muted animate-spin" />
        <span className="text-xs text-ps-text-muted">{copy.title}</span>
      </div>
    );
  }

  const accent =
    copy.tone === "red"
      ? "bg-neon-red/10 border-neon-red/20 text-neon-red"
      : "bg-neon-orange/10 border-neon-orange/20 text-neon-orange";

  return (
    <div
      className={`w-full max-w-md mx-auto mb-6 p-4 ${accent} border rounded-lg text-left`}
    >
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm font-semibold">{copy.title}</span>
      </div>
      <p className="text-xs text-ps-text-secondary">{renderBody(copy.body)}</p>
    </div>
  );
}
