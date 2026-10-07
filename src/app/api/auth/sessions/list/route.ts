import { NextResponse, type NextRequest } from "next/server";

import { listBrowserSessions } from "@/lib/auth/session-store";
import { bearerToken, bodyToken, credentialBody, requireFreshOperatorToken } from "@/lib/auth/request-auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const fields = await credentialBody(request);
  if (fields instanceof NextResponse) return fields;
  const refusal = requireFreshOperatorToken(request, bearerToken(request) ?? bodyToken(fields));
  if (refusal) return refusal;
  try { return NextResponse.json({ sessions: listBrowserSessions() }); }
  catch { return NextResponse.json({ error: "Browser sessions are unavailable." }, { status: 503 }); }
}
