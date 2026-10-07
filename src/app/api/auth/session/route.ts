import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/api/auth-token";
import { revokeCurrentSession } from "@/lib/auth/session-store";

export function DELETE(request: NextRequest): NextResponse {
  const secret = request.cookies.get(SESSION_COOKIE)?.value;
  try { if (secret) revokeCurrentSession(secret); }
  catch {
    const response = NextResponse.json({ error: "Browser sessions are unavailable. Session revocation was not confirmed." }, { status: 503 });
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }
  const response = NextResponse.json({ signedOut: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
