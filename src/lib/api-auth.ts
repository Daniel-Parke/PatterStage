import { createHmac, randomUUID, timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { serviceUnavailable } from "@/lib/api-response";
import { getAuthMode } from "@/lib/auth-token";

function firstEnvFlag(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return undefined;
}

function isDeployApiEnabled(): boolean {
  const raw = firstEnvFlag(["PS_ENABLE_DEPLOY_API", "CH_ENABLE_DEPLOY_API"]);
  const value = raw?.toLowerCase();
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return process.env.NODE_ENV !== "production";
}

export function isReadOnly(): boolean {
  const raw = firstEnvFlag(["PS_READ_ONLY", "CH_READ_ONLY"]);
  const value = raw?.toLowerCase();
  return value === "1" || value === "true";
}

export function getCorrelationId(request: NextRequest): string {
  return (
    request.headers.get("x-correlation-id") ||
    request.headers.get("x-request-id") ||
    randomUUID()
  );
}

export function requireSignedRequest(request: NextRequest): NextResponse | null {
  const secret = firstEnvFlag(["PS_REQUEST_SIGNING_SECRET", "CH_REQUEST_SIGNING_SECRET"]) || "";
  if (!secret) return null;
  const ts = request.headers.get("x-ps-ts") || request.headers.get("x-ch-ts") || "";
  const sig = request.headers.get("x-ps-signature") || request.headers.get("x-ch-signature") || "";
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

/**
 * Guard for write endpoints. Returns a 503 NextResponse (to be returned
 * from the route handler) if PatterStage is in read-only mode, or
 * `null` if writes are allowed.
 *
 * Optional `context` is appended to the default message as a
 * resource-specific hint (e.g. "skill toggles are disabled",
 * "tool mutations are disabled"). When omitted, the canonical default
 * message including the env-var hint is used.
 */
export function requireNotReadOnly(context?: string): NextResponse | null {
  if (!isReadOnly()) return null;
  if (!context) {
    return serviceUnavailable(
      "PatterStage is in read-only mode (set PS_READ_ONLY=true to allow writes)."
    );
  }
  return serviceUnavailable(
    `PatterStage is in read-only mode — ${context}`,
  );
}

export function requireDeployApiEnabled(): NextResponse | null {
  if (isDeployApiEnabled()) return null;
  return NextResponse.json(
    { error: "Deploy API disabled. Set PS_ENABLE_DEPLOY_API=true to allow update/restart." },
    { status: 403 }
  );
}

/**
 * Refuse an endpoint that can cause host-level side effects (writing a script
 * that will later be executed, installing a crontab line) when authentication
 * has been switched off with `PS_AUTH_MODE=none`.
 *
 * With authentication on (the default), these endpoints are fine: the operator
 * holding the token already has shell access to the machine running the server,
 * so an authenticated script editor is a feature, not an escalation. With
 * authentication off, the same endpoints are an unauthenticated RCE, which is
 * exactly how this application shipped before `src/proxy.ts` existed.
 */
export function requireAuthenticatedHostWrites(): NextResponse | null {
  if (getAuthMode() !== "none") return null;
  return NextResponse.json(
    {
      error:
        "Host-affecting writes are disabled while PS_AUTH_MODE=none. Re-enable the access token to edit or schedule scripts.",
    },
    { status: 403 },
  );
}

/**
 * Write-access guard: checks the read-only mode flag ONLY.
 *
 * ⚠️ This function does NOT authenticate. Authentication lives in `src/proxy.ts`
 * and is enforced on every request before a handler runs — it cannot be
 * forgotten by a new route, which is the whole point. These per-route calls are
 * now redundant defence-in-depth for the read-only flag; do not treat the
 * presence of this call as evidence that a route is protected.
 *
 * Historical: the name dates from when every caller was a write route. It is
 * kept only to avoid churning ~30 call sites in a security hotfix; the rename to
 * `requireWriteAccess()` and the deletion of the redundant calls happen when the
 * read-only check moves wholly into the proxy.
 */
export function requireAuth(_request: NextRequest): NextResponse | null {
  return requireNotReadOnly();
}
