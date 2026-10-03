import { NextResponse } from "next/server";

/** JSON alias for clients that expect an API-prefixed liveness URL. */
export function GET() {
  return NextResponse.json({ ok: true });
}
