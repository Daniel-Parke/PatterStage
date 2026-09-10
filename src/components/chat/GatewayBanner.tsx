// ═══════════════════════════════════════════════════════════════
// GatewayBanner — Connection-status banners for the chat page
// ═══════════════════════════════════════════════════════════════
//
// Four states are surfaced as full-width banners: gateway offline
// (red), gateway up but unauthenticated (orange), no model ready
// (orange), and gateway check still in-flight (muted spinner).
// All share the same outer card layout and only differ in colour, icon,
// title, body content, and whether they carry an action.
//
// WHICH of them show WHERE is not decided here -- see
// `gateway-banner-states.ts`, which the page reads. This file draws what
// it is told to draw.

"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

import LinkButton from "@/components/ui/LinkButton";
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
  /**
   * For `model-missing`: the sentence the server resolved about THIS install
   * (src/lib/models/model-readiness.ts). A model chosen but not sent to the
   * agent and no model at all are different problems, and the banner used to
   * describe neither: it listed three ways to set a model, one of which named
   * a section this product does not have. `null` falls back to the general
   * sentence.
   */
  modelDetail?: string | null;
}

/** Where the one remedy goes. The Models screen in the rail, not a guess. */
const MODELS_HREF = "/agent/models";

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
  modelDetail: string | null,
): { tone: "red" | "orange" | "muted"; title: string; body: string } {
  if (status === "model-missing" && modelDetail) {
    return { ...COPY["model-missing"], body: modelDetail };
  }
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
  // Novice register (chat is a novice screen): no file paths, no commands, no
  // sections that have to be found. What happened, then one button.
  "model-missing": {
    tone: "orange",
    title: "No model is ready yet",
    body: "The agent has no model to answer with, so a message will not get a reply.",
  },
  checking: {
    tone: "muted",
    title: "Checking gateway connection...",
    body: "",
  },
};

export default function GatewayBanner({
  status,
  gatewayUrl = null,
  modelDetail = null,
}: GatewayBannerProps) {
  const copy = copyFor(status, gatewayUrl, modelDetail);

  if (copy.tone === "muted") {
    return (
      <div className="flex items-center gap-2 mb-4 justify-center">
        <Loader2 className="w-3 h-3 text-ps-text-muted animate-spin" />
        <span className="text-body text-ps-text-muted">{copy.title}</span>
      </div>
    );
  }

  const accent =
    copy.tone === "red"
      ? "bg-neon-red/10 border-neon-red/20 text-neon-red"
      : "bg-neon-orange/10 border-neon-orange/20 text-neon-orange";

  return (
    // A standing state is a banner: full width at the top of the transcript,
    // announced. It rendered as a centred card 60% of the column wide,
    // floating between the header and the first message, and at 390 wider
    // than the column (the review of 2026-09-08, T-0132). Red is an alert,
    // because the next message cannot go anywhere; orange is advisory.
    <div
      role={copy.tone === "red" ? "alert" : "status"}
      className={`mb-4 flex w-full items-start gap-3 rounded-ps-lg border px-4 py-3 text-left ${accent}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <span className="text-body font-semibold">{copy.title}</span>
        <p className="text-body text-ps-text-secondary">{renderBody(copy.body)}</p>
        {/* One action, and one that exists. The remedy for every model state is
            the same screen, so the banner takes the operator there rather than
            describing three routes and leaving them to pick. */}
        {status === "model-missing" && (
          <LinkButton href={MODELS_HREF} variant="primary" color="orange" size="sm" className="mt-2">
            Open models
          </LinkButton>
        )}
      </div>
    </div>
  );
}
