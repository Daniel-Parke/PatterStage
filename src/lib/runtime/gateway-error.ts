// runtime/gateway-error.ts — a failed fetch, said in operator.
//
// Node's fetch hides the reason in `cause`, and `messageFromError` joins the
// chain, so a stopped gateway reached SEVEN storage columns as
// "fetch failed: connect ECONNREFUSED 127.0.0.1:8652", worst of them
// `missions.result`. This is the one place that turns it into a sentence; it
// lives beside the runtime because `ep.baseUrl` is the fact the message needs.
//
// NO `cause`, deliberately: `messageFromError` appends any link the outer
// message does not quote, so attaching the original would re-append the noise.
// The transport CODE is carried in the message instead.

import { errorChain } from "@/lib/api/api-fetch";
import { RuntimeRequestError } from "./types";

/**
 * 503, not 404 or 429, both load-bearing elsewhere: `run-reconcile` fails a run
 * on 404 (past T-0078's grace) and `submitWithBackoff` retries 429.
 */
const UNREACHABLE_STATUS = 503;

/** We gave up waiting. Distinct from unreachable: something may well be there. */
const TIMEOUT_STATUS = 504;

const TRANSPORT_CODES = [
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
];

/**
 * The transport code from anywhere in the cause chain, or null. Walks with
 * `errorChain` rather than a third copy of the loop; its non-Error-yields-
 * empty property is wanted, since a bare string is not evidence of a failure.
 */
function transportCode(err: unknown): string | null {
  for (const link of errorChain(err)) {
    const code = (link as NodeJS.ErrnoException).code;
    if (typeof code === "string" && TRANSPORT_CODES.includes(code)) return code;
    // undici does not always set `code` on the link that names the problem;
    // fall back to the text, anchored on the code TOKEN, not loose words.
    const match = link.message.match(/\b(E[A-Z]{3,}|UND_ERR_[A-Z_]+)\b/);
    if (match && TRANSPORT_CODES.includes(match[1])) return match[1];
  }
  return null;
}

/**
 * Did the CALLER cancel this? `submitRun` is handed the caller's AbortSignal,
 * and a cancelled mission's rejected fetch is indistinguishable by shape from
 * a transport failure; reporting it as "not responding" is the defect class
 * T-0069 removed, so a caller abort is never mapped. THE SIGNAL IS THE WHOLE
 * TEST: matching `AbortError`/`TimeoutError` by name missed the commonest
 * case, an abort mid-wire rejecting with a RESET SOCKET.
 */
function callerCancelled(callerSignal?: AbortSignal): boolean {
  return callerSignal?.aborted === true;
}

function isOurTimeout(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "TimeoutError" || /aborted due to timeout/i.test(err.message);
}

export interface GatewayFailureContext {
  /** The gateway this call was addressed to, e.g. `http://127.0.0.1:8652`. */
  baseUrl: string;
  /** Our own deadline for this call, when one applied. */
  timeoutMs?: number;
  /** The caller's cancellation signal, when it supplied one. */
  callerSignal?: AbortSignal;
}

/**
 * Translate a rejected gateway fetch, or `null` for "not mine": a caller abort
 * or an error with no transport evidence, which rewriting would turn into a guess.
 */
export function describeGatewayFailure(
  err: unknown,
  ctx: GatewayFailureContext,
): RuntimeRequestError | null {
  if (callerCancelled(ctx.callerSignal)) return null;

  if (isOurTimeout(err)) {
    const seconds = ctx.timeoutMs ? Math.round(ctx.timeoutMs / 1000) : null;
    const waited = seconds === null ? "" : ` within ${seconds}s`;
    return new RuntimeRequestError(
      `Hermes gateway at ${ctx.baseUrl} did not answer${waited}. ` +
        `It may be starting up, or busy. Set HERMES_GATEWAY_URL if the gateway is elsewhere.`,
      TIMEOUT_STATUS,
    );
  }

  const code = transportCode(err);
  if (!code) return null;

  return new RuntimeRequestError(
    `Hermes gateway at ${ctx.baseUrl} is not responding (${code}). ` +
      // design-lint-disable-next-line hermes-outside-adapter -- this file IS the Hermes adapter's error surface, and the remedy is the one docs/reference/runtime-architecture.md prescribes. A message that said "start the backend" would not be a remedy.
      `Start it with: hermes gateway start — or set HERMES_GATEWAY_URL if it listens elsewhere.`,
    UNREACHABLE_STATUS,
  );
}
