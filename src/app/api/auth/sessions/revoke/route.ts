import { NextResponse, type NextRequest } from "next/server";

import { revokeBrowserSession } from "@/lib/auth/session-store";
import { bearerToken, bodyToken, credentialBody, requireFreshOperatorToken } from "@/lib/auth/request-auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const fields = await credentialBody(request);
  if (fields instanceof NextResponse) return fields;
  const refusal = requireFreshOperatorToken(request, bearerToken(request) ?? bodyToken(fields));
  if (refusal) return refusal;
  const sessionId = fields.sessionId ?? fields.id ?? fields.session_id;
  if (typeof sessionId !== "string" || !/^[a-f0-9-]{36}$/i.test(sessionId)) {
    return NextResponse.json({ error: "A session identifier is required." }, { status: 400 });
  }
  try {
    return revokeBrowserSession(sessionId)
      ? NextResponse.json({ revoked: true })
      : NextResponse.json({ error: "Session not found." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Browser sessions are unavailable." }, { status: 503 });
  }
}
