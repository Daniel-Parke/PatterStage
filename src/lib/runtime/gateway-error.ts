// ═══════════════════════════════════════════════════════════════
// runtime/gateway-error.ts — a failed fetch, said in operator
//
// Node's fetch throws `TypeError: fetch failed` and hides the only sentence
// worth reading one level down in `cause`. Every layer above HermesRuntime
// reads that through `messageFromError`, which joins the chain, so a chat turn
// against a stopped gateway reached SEVEN storage columns as
//
//     fetch failed: connect ECONNREFUSED 127.0.0.1:8652
//
// -- an address the operator never typed, no statement of what the address is,
// and no remedy. Worst of the seven is `missions.result`, where that string is
// presented as the outcome of the operator's work.
//
// This is the one place that turns it into a sentence. It lives beside the
// runtime because `ep.baseUrl` is the fact the message needs and the runtime
// is where that fact exists.
//
// NO `cause`. Deliberate, and the reason is `messageFromError` itself: it
// walks the chain and appends any link the outer message does not already
// quote, so attaching the original TypeError would re-append the exact noise
// this module exists to remove. The diagnosis is not discarded -- the transport
// CODE is carried in the message, which is the part that distinguishes
// "nothing is listening" from "that name does not resolve".
// ═══════════════════════════════════════════════════════════════

import { errorChain } from "@/lib/api-fetch";
import { RuntimeRequestError } from "./types";

/**
 * The gateway answered nothing. 503 rather than 404 or 429, both of which are
 * load-bearing elsewhere: `run-reconcile` treats 404 as "the backend lost this
 * run" and fails it (past T-0078's grace), and `submitWithBackoff` retries 429.
 * A gateway that is off is neither.
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
 * The transport code from anywhere in the cause chain, or null.
 *
 * Walks with `errorChain` rather than rolling a third copy of the same loop.
 * `api-fetch.ts` calls itself "the ONE cause walker" and records that a second
 * copy already survives in the memory module; a third one here would have made
 * that comment quietly false.
 *
 * Its non-Error-yields-an-EMPTY-chain property is exactly what is wanted: a
 * bare string is not evidence of a transport failure.
 */
function transportCode(err: unknown): string | null {
  for (const link of errorChain(err)) {
    const code = (link as NodeJS.ErrnoException).code;
    if (typeof code === "string" && TRANSPORT_CODES.includes(code)) return code;
    // undici does not always set `code` on the link that names the problem, so
    // fall back to the text. Anchored on the code TOKEN, not on loose words
    // like "network", to avoid claiming a transport failure over a phrase that
    // merely mentions one.
    const match = link.message.match(/\b(E[A-Z]{3,}|UND_ERR_[A-Z_]+)\b/);
    if (match && TRANSPORT_CODES.includes(match[1])) return match[1];
  }
  return null;
}

/**
 * Did the CALLER cancel this, rather than the gateway failing?
 *
 * The distinction is the whole reason this function takes a signal. `submitRun`
 * is handed the caller's AbortSignal and a cancelled mission aborts it
 * mid-flight; the rejected fetch that produces is indistinguishable, by shape,
 * from a transport failure. Reporting a deliberate cancel as "the gateway is
 * not responding" is the defect class T-0069 removed -- a decision rendered as
 * a crash -- so a caller abort is rethrown untouched and never mapped.
 *
 * THE SIGNAL IS THE WHOLE TEST, and the error's shape is not consulted at all.
 * That started narrower -- `AbortError` or `TimeoutError` by name -- and a
 * mutation sweep showed the narrow version missing the commonest case:
 * aborting a fetch that is already on the wire rejects with a RESET SOCKET, so
 * a cancelled mission was reported as "not responding (ECONNRESET)". Once we
 * have pulled the plug ourselves there is no gateway diagnosis worth giving,
 * whatever came back, so the aborted signal alone decides it.
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
 * Translate a rejected gateway fetch, or return `null` to leave it alone.
 *
 * `null` means "this is not mine": a caller abort, or an error that carries no
 * evidence of a transport failure. Rewriting those would replace a true message
 * with a guess.
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
