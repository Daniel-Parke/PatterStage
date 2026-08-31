// ═══════════════════════════════════════════════════════════════
// /api/healthz — alias of /api/health (unauthenticated liveness).
// Same contract, zero state disclosure: { ok: true }, nothing more.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: true });
}
