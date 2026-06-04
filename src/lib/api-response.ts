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

/**
 * Return a 201 Created with the given body. Use in route handlers
 * when a POST/PUT successfully created a new resource (session,
 * model, credential, fallback entry, …). Body is wrapped in
 * `{ data }` to match the rest of the success-response surface
 * (`{ data: { resource } }`), so the wire shape is identical to the
 * 200 GET path for the same resource.
 *
 * The 5 sites that previously did this inline
 * (models/route.ts:52, credentials/route.ts:56, sessions/route.ts:120,
 * models/fallbacks/route.ts:41, models/fallbacks/custom/route.ts:37)
 * collapsed to a single token `created(...)` per call. Rule of Three
 * (5 sites across 5 files) is well over the threshold; the factory
 * centralises the `{ data }` wrap so a future change (e.g. add a
 * `createdAt: new Date().toISOString()` field to every Created
 * response) lands in one place.
 *
 * Body shape: `{ data: T }`. Pass whatever the resource shape is —
 * `{ data: { session } }` for sessions, `{ data: { model } }` for
 * models, etc. The generic `T` preserves the caller's type
 * information through the helper.
 */
export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

/**
 * Return a 200 OK with the given body. Use in route handlers for the
 * common case of a successful read/write that did not create a new
 * resource (GET, PUT update, POST that updates existing state, sync
 * result, drift report, etc.). Body is wrapped in `{ data }` to match
 * the rest of the success-response surface — the same wire shape as
 * the 201 Created path, just without the resource-creation status.
 *
 * Sister of `created()` — both wrap the caller's payload in
 * `{ data }`, but `ok` is the 200 default and `created` is the
 * 201-Created sibling. Sister of `badRequest` / `notFound` /
 * `serverError` / `forbidden` / `conflict` / `methodNotAllowed` /
 * `payloadTooLarge` / `serviceUnavailable` — same module, same
 * factory pattern, same body-shape contract — but `ok` is the
 * success-side of the family while the rest are error-side.
 *
 * The 30+ sites in List 4 territory (config/route.ts, models/*,
 * agent/files/[key], agent/profiles/*, agent/personality) that
 * previously did this inline collapsed to a single token `ok(...)` per
 * call. The 30 sites span 18 files, well over the Rule-of-Three
 * threshold. The factory centralises the `{ data }` wrap so a future
 * change (e.g. add a `version: 1` field to every success response)
 * lands in one place.
 *
 * Byte-equivalent to the inline form: same `NextResponse.json({ data: T })`
 * call, same status 200, same body shape. The generic `T` preserves
 * the caller's type information through the helper — `ok({ model })`,
 * `ok({ drift })`, `ok({ success: true, ... })` all flow the resource
 * shape through without a cast.
 *
 * **Why this is a separate factory from `created()`**: the 200 vs 201
 * distinction is semantically meaningful for HTTP clients (cache
 * heuristics, idempotency expectations, "resource was created"
 * signals). A single `okOrCreated<T>(data, isNew)` would force the
 * caller to make the status decision; the separate factories let the
 * call site declare the intent (resource created → `created`, anything
 * else → `ok`).
 *
 * Body shape: `{ data: T }`. The `T` is the caller's resource shape —
 * `ok({ model })` → `{ data: { model } }`, `ok({ drift })` →
 * `{ data: { drift } }`, `ok({ fallbacks: chain })` →
 * `{ data: { fallbacks: chain } }`, `ok({ success: true, slug })` →
 * `{ data: { success: true, slug } }`, etc.
 *
 * @example
 *   // Inline form (pre-refactor):
 *   return NextResponse.json({ data: { model } });
 *
 *   // Factory form (post-refactor):
 *   return ok({ model });
 */
export function ok<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 200 });
}
