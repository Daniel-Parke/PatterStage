// api-response — the one 4xx/5xx response shape, status-locked per factory
// (badRequest=400, notFound=404, ...): no "any 4xx" overloads. Kept tiny and
// dependency-free; heavier shaping belongs in route helpers.

import { NextResponse } from "next/server";

export function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

export function notFound(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 404 });
}

/**
 * A 404 that also hands back what the caller needs to ask a better question.
 * A separate function, not an optional argument, so the decision shows at the
 * call site. /logs asked for a default log name and the bare 404 threw away
 * the list of logs that DO exist, so the page 404ed on every poll (T-0071).
 */
export function notFoundWith(error: string, data: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error, data }, { status: 404 });
}

export function forbidden(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 403 });
}

export function serverError(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 500 });
}

export function conflict(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 409 });
}

/** 405. The message should say WHY the verb is unsupported, not just "method not allowed". */
export function methodNotAllowed(error: string, allow?: readonly string[]): NextResponse {
  // RFC 9110: a 405 MUST carry Allow; every stub said it in prose and none in the header (T-0089).
  const headers = allow && allow.length > 0 ? { Allow: allow.join(", ") } : undefined;
  return NextResponse.json({ error }, { status: 405, headers });
}

export function payloadTooLarge(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 413 });
}

/** 503 for ad-hoc cases (missing migration, sync layer offline). Read-only mode
 *  answers from `src/proxy.ts` before a handler runs; the three host-side routes
 *  that also check for themselves pass `readOnlyMessage()`, which carries the
 *  env-var hint. */
export function serviceUnavailable(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 503 });
}

/** 201, wrapped in `{ data }` so the wire shape matches the 200 GET. */
export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

/** 200 in `{ data }`. Separate from `created()` because 200 vs 201 is meaningful to HTTP clients. */
export function ok<T>(data: T, extra?: Record<string, unknown>): NextResponse {
  // `extra` is a SIBLING of data, never merged in, so a route can carry a fact
  // about the response without polluting the payload.
  return NextResponse.json(extra ? { data, ...extra } : { data }, { status: 200 });
}

/**
 * A `{ ok, error? }` helper result as a 500. No logging, so it lives here
 * rather than with the catch-block shims in `@/lib/api/api-logger`. The parameter
 * is deliberately the narrow shape: a generic would widen the unions in
 * `apply-profile-or-root-patch.ts` and lose the `push-failed` discriminant.
 *
 * @param result - A `{ ok, error? }` discriminated result.
 * @param fallback - Static message used when `result.error` is nullish.
 * @returns A 500 NextResponse with `{ error: result.error ?? fallback }`.
 */
export function serverErrorFromHelperResult(
  result: { ok: boolean; error?: string | null },
  fallback: string,
): NextResponse {
  // `??`, deliberately: an empty-string error passes through verbatim; suppressing
  // it is the PRODUCER's job (HostScheduler.writeRaw, pushProfileOrRoot).
  return serverError(result.error ?? fallback);
}
