// ══════════════════════════════════════════════════════════════════════════════
// api-response — small NextResponse factory helpers
// ══════════════════════════════════════════════════════════════════════════════
//
// Most Control Hub API routes validate their inputs at the top of the
// handler and bail out with a 4xx + a single error message. The
// `return NextResponse.json({ error: msg }, { status: <code> })` pattern
// appeared 50+ times across just List 4 (models, config, agent/files,
// agent/profiles, seed, credentials) — a family of status-code factory
// helpers collapses 1-line returns to 1-token returns and centralises
// the response shape so a future change (e.g. wrapping the body in
// `{ data: null, error: msg }` for client-side consistency) lands in
// one place.
//
// Status-code discipline: each factory is status-code-locked
// (badRequest=400, notFound=404, serverError=500). Don't add overloads
// for "any 4xx" or "any 5xx" — pick the named factory that matches.
//
// Keep this module tiny and dependency-free. Heavier response-shaping
// belongs in route-specific helpers (e.g. sessions-api-guard.ts), not
// here.
// ══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

/**
 * Return a 400 Bad Request with the given error message. Use in route
 * handlers when a required input is missing or malformed.
 */
export function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

/**
 * Return a 404 Not Found with the given error message. Use in route
 * handlers when a lookup for a resource (profile, model, fallback
 * entry, session, etc.) returns no result. Sibling of `badRequest` —
 * same body shape, different status code.
 */
export function notFound(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 404 });
}

/**
 * Return a 403 Forbidden with the given error message. Use in route
 * handlers when a request is well-formed but the caller is not allowed
 * to access the resource (e.g. PUT to a non-writable config section,
 * or a credential category operation gated by a permission check).
 * Sibling of `badRequest` and `notFound` — same body shape, different
 * status code.
 */
export function forbidden(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 403 });
}

/**
 * Return a 500 Internal Server Error with the given error message.
 * Use in route handlers when an unexpected failure occurs (DB error,
 * filesystem error, sync push failure, etc.). Sibling of `badRequest`
 * and `notFound` — same body shape, different status code.
 */
export function serverError(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 500 });
}

/**
 * Return a 409 Conflict with the given error message. Use in route
 * handlers when a write would collide with existing state (duplicate
 * profile slug, unique-key violation, etc.). Sibling of the rest of
 * the factory quartet — same body shape, different status code.
 */
export function conflict(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 409 });
}

/**
 * Return a 405 Method Not Allowed with the given error message. Use
 * in route handlers that don't implement a particular HTTP verb (e.g.
 * DELETE on a resource where it isn't supported). The error message
 * should explain WHY the verb isn't supported, not just "method not
 * allowed" — e.g. "Tool registry mutations are disabled. Configure
 * Hermes runtime toolsets on Operations → Tools." Sibling of the rest
 * of the factory set — same body shape, different status code.
 *
 * (Previously inline at 3 sites; promoted in session 76 when the
 * Rule of Three was finally met.)
 */
export function methodNotAllowed(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 405 });
}

/**
 * Return a 413 Payload Too Large with the given error message. Use
 * in route handlers when the request body or attached file exceeds
 * an upstream size cap (e.g. session transcript file > maxBytes).
 * Sibling of the rest of the factory set — same body shape, different
 * status code.
 */
export function payloadTooLarge(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 413 });
}

/**
 * Return a 503 Service Unavailable with the given error message. Use
 * in route handlers when a downstream service (DB, sync layer,
 * migration state) is in a state that doesn't allow the request, OR
 * when the Control Hub is in read-only mode and the request is a
 * write. Sibling of the rest of the factory set — same body shape,
 * different status code.
 *
 * Note: the read-only-mode case is usually handled by
 * `requireNotReadOnly(context?)` in `@/lib/api-auth` so the canonical
 * message can include the env-var hint. `serviceUnavailable()` is
 * for ad-hoc 503 cases (e.g. missing migration, sync layer offline).
 */
export function serviceUnavailable(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 503 });
}
