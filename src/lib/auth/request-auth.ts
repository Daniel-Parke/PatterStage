import { NextResponse, type NextRequest } from "next/server";

import { getAuthMode, readAuthToken, tokenMatches } from "@/lib/api/auth-token";
import { authClientKey, authPenaltySeconds, clearAuthFailures, recordAuthFailure } from "@/lib/api/auth-throttle";
import { hasExactOrigin, publicOrigin } from "./public-origin";

const MAX_BODY_BYTES = 8_192;

/** Read a small credential body without buffering an attacker-sized request. */
export async function credentialBody(request: NextRequest): Promise<Record<string, unknown> | NextResponse> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: "Sign-in body is too large." }, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "Sign-in body is too large." }, { status: 413 });
      }
      chunks.push(value);
    }
  } catch {
    return NextResponse.json({ error: "Could not read sign-in body." }, { status: 400 });
  }
  const input = Buffer.concat(chunks).toString("utf8");
  const type = request.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase();
  if (type === "application/x-www-form-urlencoded") {
    const form = new URLSearchParams(input);
    return Object.fromEntries(form.entries());
  }
  if (type === "text/plain") return { token: input };
  if (!type || type === "application/json") {
    if (!input) return {};
    try {
      const parsed: unknown = JSON.parse(input);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch { /* invalid input */ }
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  return NextResponse.json({ error: "Unsupported credential body type." }, { status: 415 });
}

export function bodyToken(fields: Record<string, unknown>): string | null {
  for (const name of ["token", "operatorToken", "operator_token"]) {
    const value = fields[name];
    if (typeof value === "string" && value.length > 0 && value.length <= MAX_BODY_BYTES) return value;
  }
  return null;
}

export function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  return header?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

export function exactBrowserOrigin(request: NextRequest): URL | NextResponse {
  const origin = publicOrigin(request);
  if (!origin) return NextResponse.json({ error: "Browser origin is not configured safely." }, { status: 503 });
  if (!hasExactOrigin(request, origin)) return NextResponse.json({ error: "Cross-origin sign-in rejected." }, { status: 403 });
  return origin;
}

/** Root credential for sign-in or management, with the shared failed-attempt budget. */
export function requireFreshOperatorToken(request: NextRequest, supplied: string | null): NextResponse | null {
  if (getAuthMode() !== "token") return NextResponse.json({ error: "Operator token authentication is disabled." }, { status: 403 });
  const key = authClientKey(request.headers);
  const penalty = authPenaltySeconds(key);
  if (penalty > 0) return NextResponse.json({ error: "Too many failed sign-in attempts." }, { status: 429, headers: { "Retry-After": String(penalty) } });
  const expected = readAuthToken();
  if (!expected) return NextResponse.json({ error: "Operator token is unavailable." }, { status: 503 });
  if (!tokenMatches(supplied, expected)) {
    recordAuthFailure(key);
    return NextResponse.json({ error: "Invalid operator credential." }, { status: 401 });
  }
  clearAuthFailures(key);
  return null;
}
