import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/api/auth-token";
import { createBrowserSession, SessionCredentialChangedError } from "@/lib/auth/session-store";
import { bodyToken, credentialBody, exactBrowserOrigin, requireFreshOperatorToken } from "@/lib/auth/request-auth";
import { sessionCookieOptions } from "@/lib/auth/public-origin";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = exactBrowserOrigin(request);
  if (origin instanceof NextResponse) return origin;
  const fields = await credentialBody(request);
  if (fields instanceof NextResponse) return fields;
  const suppliedToken = bodyToken(fields);
  const refusal = requireFreshOperatorToken(request, suppliedToken);
  if (refusal) return refusal;

  let session;
  try { session = createBrowserSession(suppliedToken!); }
  catch (error) {
    if (error instanceof SessionCredentialChangedError) {
      return NextResponse.json({ error: "Invalid operator credential." }, { status: 401 });
    }
    return NextResponse.json({ error: "Browser sessions are unavailable." }, { status: 503 });
  }

  const response = NextResponse.redirect(new URL("/agent/settings", origin), 303);
  response.cookies.set(SESSION_COOKIE, session.secret,
    sessionCookieOptions(origin, Math.floor((session.expiresAtMs - Date.now()) / 1000)));
  return response;
}
