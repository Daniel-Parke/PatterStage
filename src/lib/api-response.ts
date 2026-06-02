// ══════════════════════════════════════════════════════════════════════════════
// api-response — small NextResponse factory helpers
// ══════════════════════════════════════════════════════════════════════════════
//
// Most Control Hub API routes validate their inputs at the top of the
// handler and bail out with a 4xx + a single error message. The
// `return NextResponse.json({ error: msg }, { status: 400 })` pattern
// appeared 18+ times across just List 1 (sessions, memory/hindsight,
// admin/sessions) — a `badRequest(msg)` factory collapses 1-line
// returns to 1-token returns and centralises the response shape so a
// future change (e.g. wrapping the body in `{ data: null, error: msg }`
// for client-side consistency) lands in one place.
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
