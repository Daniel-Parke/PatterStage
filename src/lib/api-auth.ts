import { createHmac, randomUUID, timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { serviceUnavailable } from "@/lib/api-response";
import { getAuthMode } from "@/lib/auth-token";
import { readEnv } from "@/lib/paths";
import { isReadOnly, readOnlyMessage } from "@/lib/read-only";

/**
 * Whether POST /api/update may spawn the deploy script.
 *
 * Exported, and the ONLY copy of the rule: boot-diagnostics used to carry its
 * own mirror of these six lines "so the line cannot claim a state the guard
 * does not enforce", which is the argument for one function, not two. The
 * footer reads the answer on GET /api/update so it can say "off" before the
 * click (T-0095, D53). Setup writes `PS_ENABLE_DEPLOY_API=true` on a fresh
 * install (decision 17), so the production fallback below is for installs
 * that predate it.
 */
export function isDeployApiEnabled(): boolean {
  const raw = readEnv("PS_ENABLE_DEPLOY_API", "CH_ENABLE_DEPLOY_API");
  const value = raw?.toLowerCase();
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * Re-exported from `@/lib/read-only` so the route layer and the proxy read the
 * same function, not two implementations of the same sentence (T-0048).
 */
export { isReadOnly };

export function getCorrelationId(request: NextRequest): string {
  return (
    request.headers.get("x-correlation-id") ||
    request.headers.get("x-request-id") ||
    randomUUID()
  );
}

export function requireSignedRequest(request: NextRequest): NextResponse | null {
  const secret = readEnv("PS_REQUEST_SIGNING_SECRET", "CH_REQUEST_SIGNING_SECRET") || "";
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
 * Guard for a WRITE endpoint that needs its own resource-specific wording.
 *
 * ⚠️ Almost nothing should call this. `src/proxy.ts` refuses every unsafe method
 * under read-only before a handler runs, so a route-level call is redundant. It
 * survives only for the handful of endpoints that are not simply "a write":
 * a GET that performs a side effect, or a route whose refusal is more useful
 * with a resource named in it.
 *
 * NEVER call it from a GET, HEAD or OPTIONS handler. That is the defect T-0048
 * removed: `requireAuth()` was a thin alias for this function, 34 read handlers
 * called it, and `PS_READ_ONLY` therefore 503'd the dashboard it exists to
 * enable. `scripts/tooling/check-read-only-guards.mjs` fails the build on it.
 *
 * The message is `readOnlyMessage()` so the operator sees one sentence whichever
 * layer refused. The wording here used to say "set PS_READ_ONLY=true to allow
 * writes", which is the opposite of the fix.
 */
export function requireNotReadOnly(context?: string): NextResponse | null {
  if (!isReadOnly()) return null;
  return serviceUnavailable(readOnlyMessage(context));
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
 * that will later be executed, running one, installing a crontab line, spawning
 * the deploy script) when authentication has been switched off with
 * `PS_AUTH_MODE=none`.
 *
 * With authentication on (the default), these endpoints are fine: the operator
 * holding the token already has shell access to the machine running the server,
 * so an authenticated script editor is a feature, not an escalation. With
 * authentication off, the same endpoints are an unauthenticated RCE, which is
 * exactly how this application shipped before `src/proxy.ts` existed.
 *
 * `src/proxy.ts` now refuses the same paths first, from a list, so a route
 * that forgets this call is still covered. This stays as defence in depth.
 */
export function requireAuthenticatedHostWrites(): NextResponse | null {
  if (getAuthMode() !== "none") return null;
  return NextResponse.json(
    {
      error:
        "Host-affecting writes are disabled while PS_AUTH_MODE=none. Re-enable the access token to edit, schedule or run scripts, or to deploy.",
    },
    { status: 403 },
  );
}
