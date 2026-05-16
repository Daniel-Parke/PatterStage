import { createHmac, randomUUID, timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";

function firstEnvFlag(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return undefined;
}

/** Legacy helper; optional API keys are not enforced for route access. */
export function getChApiKey(): string {
  return "";
}

export function isDeployApiEnabled(): boolean {
  const raw = firstEnvFlag(["CH_ENABLE_DEPLOY_API"]);
  const value = raw?.toLowerCase();
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return process.env.NODE_ENV !== "production";
}

export function isChReadOnly(): boolean {
  const raw = firstEnvFlag(["CH_READ_ONLY"]);
  const value = raw?.toLowerCase();
  return value === "1" || value === "true";
}

/** Optional API key / scoped key checks are disabled; routes rely on same-trust as the UI. */
export function requireChApiKey(_request: NextRequest): NextResponse | null {
  return null;
}

export function getCorrelationId(request: NextRequest): string {
  return (
    request.headers.get("x-correlation-id") ||
    request.headers.get("x-request-id") ||
    randomUUID()
  );
}

export function requireSignedRequest(request: NextRequest): NextResponse | null {
  const secret = process.env.CH_REQUEST_SIGNING_SECRET || "";
  if (!secret) return null;
  const ts = request.headers.get("x-ch-ts") || "";
  const sig = request.headers.get("x-ch-signature") || "";
  if (!ts || !sig) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
  }
  const ageMs = Math.abs(Date.now() - Number(ts));
  if (!Number.isFinite(ageMs) || ageMs > 5 * 60 * 1000) {
    return NextResponse.json({ error: "Signature timestamp expired" }, { status: 401 });
  }
  const payload = `${request.method}:${request.nextUrl.pathname}:${ts}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const lhs = Buffer.from(sig);
  const rhs = Buffer.from(expected);
  if (lhs.length !== rhs.length || !timingSafeEqual(lhs, rhs)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  return null;
}

export function requireNotReadOnly(): NextResponse | null {
  if (!isChReadOnly()) return null;
  return NextResponse.json(
    { error: "Control Hub is in read-only mode (set CH_READ_ONLY=true to allow writes)." },
    { status: 503 }
  );
}

export function requireDeployApiEnabled(): NextResponse | null {
  if (isDeployApiEnabled()) return null;
  return NextResponse.json(
    { error: "Deploy API disabled. Set CH_ENABLE_DEPLOY_API=true to allow update/restart." },
    { status: 403 }
  );
}

// Backward-compatible aliases.
export const getMcApiKey = getChApiKey;
export const isMcReadOnly = isChReadOnly;
export const requireMcApiKey = requireChApiKey;

/**
 * Combined auth guard: checks read-only mode AND optional API key.
 * Returns a NextResponse (to return) if auth fails, or null if allowed.
 *
 * Use as the first line in route handlers:
 *   const auth = requireAuth(request);
 *   if (auth) return auth;
 */
export function requireAuth(request: NextRequest): NextResponse | null {
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;
  return null;
}

/**
 * Safely parse the JSON body of a request.
 * Returns the parsed object on success, or a NextResponse (400) on parse failure.
 *
 * Usage:
 *   const body = await parseJsonBody(request);
 *   if (body instanceof NextResponse) return body;
 *   // body is now Record<string, unknown>
 */
export async function parseJsonBody(
  request: NextRequest,
): Promise<Record<string, unknown> | NextResponse> {
  try {
    const body = await request.json();
    return body as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
