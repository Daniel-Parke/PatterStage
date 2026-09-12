// ═══════════════════════════════════════════════════════════════
// /api/health — unauthenticated liveness probe.
//
// The ONE public endpoint (see the PUBLIC_PATHS allow-list in src/proxy.ts).
// It exists so the deploy runner and container health checks can tell "the
// server is up" without holding the access token, and it therefore reports
// nothing about the system: no counts, no paths, no config state. Anything
// that describes real state belongs on /api/status, which requires auth.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: true });
}
