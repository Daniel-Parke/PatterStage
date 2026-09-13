import { createHmac, randomUUID, timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { getAuthMode } from "@/lib/api/auth-token";
import { readEnv } from "@/lib/host/paths";
import { isReadOnly } from "@/lib/api/read-only";

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
 * Re-exported from `@/lib/api/read-only` so the route layer and the proxy read the
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

// `requireNotReadOnly(context)` lived here until app-06 (ruled 2026-09-12).
// Its own comment had said for two batches that almost nothing should call it:
// src/proxy.ts refuses every unsafe method under read-only before a handler
// runs, so eleven of its seventeen callers could not fire over HTTP, while
// sixty-nine other write handlers never called it. One boundary is now both
// what the tree says and what it keeps. The six that stayed write `isReadOnly()`
// out at the route — cron/hardware and the two scripts routes, whose writes run
// ON THE HOST, where proxy.ts:58-63 wants a guard that holds without the proxy.
// That is six of the seventeen, not all of HOST_SIDE_EFFECT_PREFIXES: /api/update
// is the third prefix and never carried a read-only check of its own. The
// ruling named six and this is those six.

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
