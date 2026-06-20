import { createHmac, randomUUID, timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { serviceUnavailable } from "@/lib/api-response";

function firstEnvFlag(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return undefined;
}

export function isDeployApiEnabled(): boolean {
  const raw = firstEnvFlag(["PS_ENABLE_DEPLOY_API", "CH_ENABLE_DEPLOY_API"]);
  const value = raw?.toLowerCase();
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return process.env.NODE_ENV !== "production";
}

export function isChReadOnly(): boolean {
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
 * from the route handler) if the control hub is in read-only mode, or
 * `null` if writes are allowed.
 *
 * Optional `context` is appended to the default message as a
 * resource-specific hint (e.g. "skill toggles are disabled",
 * "tool mutations are disabled"). When omitted, the canonical default
 * message including the env-var hint is used.
 */
export function requireNotReadOnly(context?: string): NextResponse | null {
  if (!isChReadOnly()) return null;
  if (!context) {
    return serviceUnavailable(
      "PatterStage is in read-only mode (set CH_READ_ONLY=true to allow writes)."
    );
  }
  return serviceUnavailable(
    `PatterStage is in read-only mode — ${context}`,
  );
}

export function requireDeployApiEnabled(): NextResponse | null {
  if (isDeployApiEnabled()) return null;
  return NextResponse.json(
    { error: "Deploy API disabled. Set CH_ENABLE_DEPLOY_API=true to allow update/restart." },
    { status: 403 }
  );
}

/**
 * Combined write-access guard: checks the read-only mode flag.
 * Returns a NextResponse (to return) if write access is denied, or null if allowed.
 *
 * NOTE: Despite the name, this function does NOT perform authentication — it only
 * checks the read-only env flag (CH_READ_ONLY). The `_request` parameter is
 * intentionally ignored. For new code, prefer the explicit `requireNotReadOnly()`
 * or the dedicated signed-request check `requireSignedRequest()`.
 *
 * Historical: this helper was originally named `requireAuth` because every route
 * that called it was also a write route, so the read-only check was sufficient.
 * The misnomer persists across ~30 call sites; renaming to `requireWriteAccess()`
 * is a separate, larger refactor (deferred).
 */
export function requireAuth(_request: NextRequest): NextResponse | null {
  return requireNotReadOnly();
}
