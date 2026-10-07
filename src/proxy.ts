// ═══════════════════════════════════════════════════════════════
// proxy.ts — authentication, exact-origin CSRF and read-only boundary.
// Bearer clients retain the operator token. Browsers use revocable, opaque
// SQLite sessions. Routes recheck credentials before protected stream output.
// ═══════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";

import {
  SESSION_COOKIE,
  TOKEN_QUERY_PARAM,
  describeTokenSource,
  getAuthMode,
  readAuthToken,
  tokenMatches,
} from "@/lib/api/auth-token";
import { createBrowserSession, SessionCredentialChangedError, validateBrowserSession } from "@/lib/auth/session-store";
import { hasExactOrigin, publicOrigin, sessionCookieOptions } from "@/lib/auth/public-origin";
import { isReadOnly, readOnlyMessage } from "@/lib/api/read-only";
import {
  authClientKey,
  authPenaltySeconds,
  clearAuthFailures,
  recordAuthFailure,
} from "@/lib/api/auth-throttle";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
type RequestPolicy = { nonce: string; value: string };

function requestPolicy(): RequestPolicy {
  const nonce = randomBytes(16).toString("base64");
  const development = process.env.NODE_ENV === "development";
  const value = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    `style-src-elem 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${development ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  return { nonce, value };
}

/**
 * Reachable without a token. Deliberately tiny: a liveness probe the deploy
 * runner and container health checks need before a token can be presented.
 * `/api/status` is NOT here — it reports real system state.
 */
const PUBLIC_PATHS = new Set(["/api/health", "/api/healthz", "/healthz"]);
const AUTH_LIFECYCLE_WRITES = new Set([
  "POST /api/auth/sign-in",
  "DELETE /api/auth/session",
  "POST /api/auth/sessions/list",
  "POST /api/auth/sessions/revoke",
]);
const BODY_TOKEN_MANAGEMENT = new Set([
  "POST /api/auth/sessions/list",
  "POST /api/auth/sessions/revoke",
]);

/**
 * The routes whose WRITES reach the host: a script the editor saves is executed
 * later by cron and by /api/scripts/run, a crontab line is installed, the
 * deploy script is spawned. With the token on, an authenticated operator
 * already has a shell on this machine and these are features. With
 * `PS_AUTH_MODE=none` they are unauthenticated remote code execution.
 *
 * `requireAuthenticatedHostWrites()` in src/lib/api/api-auth.ts is the same rule at
 * the route level, and it was applied to the script editor and the crontab
 * routes and forgotten on the two routes that EXECUTE (T-0095, D42/D123). A
 * guard a route has to remember is not a boundary; this list is. The routes
 * keep their own call as well, so a harness that bypasses the proxy is still
 * not a hole.
 */
const HOST_SIDE_EFFECT_PREFIXES = ["/api/scripts/", "/api/cron/hardware", "/api/update"];

function isHostSideEffectWrite(pathname: string, isSafe: boolean): boolean {
  if (isSafe) return false;
  return HOST_SIDE_EFFECT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function refuseHostWrite(): NextResponse {
  return NextResponse.json(
    {
      error:
        "Host-affecting writes are disabled while PS_AUTH_MODE=none. Re-enable the access token to edit, schedule or run scripts, or to deploy.",
    },
    { status: 403 },
  );
}

/**
 * The read-only refusal.
 *
 * Deliberately raised only AFTER the caller has been authenticated. Refusing an
 * anonymous write with 503 tells anyone who can reach the port whether this
 * instance is read-only. An
 * unauthenticated caller learns nothing but 401 (T-0048).
 */
function refuseReadOnly(): NextResponse {
  return NextResponse.json({ error: readOnlyMessage() }, { status: 503 });
}

/**
 * Let the request through, telling the root layout which path it is for.
 *
 * generateMetadata in src/app/layout.tsx reads `x-ps-pathname` to set the tab
 * title from the registry (T-0097, D55). It has to come from here: a client
 * effect setting document.title is overwritten when Next streams the layout's
 * metadata after hydration, so on a fresh load every tab read "PatterStage".
 * Every pass-through below goes through this, and
 * tests/unit/b3-titles-from-registry.test.ts refuses a bare next() call.
 */
function pass(request: NextRequest, pathname: string, policy: RequestPolicy): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-ps-pathname", pathname);
  requestHeaders.set("x-nonce", policy.nonce);
  requestHeaders.set("Content-Security-Policy", policy.value);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!isApiPath(pathname) && (request.method === "GET" || request.method === "HEAD")) {
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * The 401 is the first PatterStage screen a lot of people ever see: the
 * installer finishes and they open the local URL. Give the local file hint
 * without exposing an absolute host path to an unverified network caller.
 */
function unauthorized(request: NextRequest, clearLegacyCookie = false): NextResponse {
  const source = describeTokenSource();

  if (isApiPath(request.nextUrl.pathname)) {
    // No path here, on purpose. The consumer is a script, which cannot act on a
    // filesystem hint anyway, and this branch answers unauthenticated callers
    // from anywhere the server is reachable.
    const response = NextResponse.json(
      {
        error:
          "Unauthorized. Send 'Authorization: Bearer <token>' or sign in with your operator credential.",
      },
      { status: 401 },
    );
    if (clearLegacyCookie) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  const readHint =
    source.kind === "env"
      ? `<p>This server takes its token from the <code>PS_AUTH_TOKEN</code> environment variable it was started with. Read it from your container or service definition.</p>`
      : `<p>Read your token locally from <code>PS_DATA_DIR/auth-token</code>. The server log gives the resolved file location but never prints the token.</p>`;

  const response = new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PatterStage: access token required</title></head>` +
      `<body style="font:16px/1.6 system-ui;max-width:38rem;margin:10vh auto;padding:0 1.5rem;background:#05080d;color:#eaf2f8">` +
      `<h1 style="font-size:1.4rem">PatterStage needs your access token</h1>` +
      `<p>PatterStage is a single-operator control plane. The server minted one random operator token on first boot.</p>` +
      readHint +
      `<form method="post" action="/api/auth/sign-in"><label for="token">Operator token</label><br>` +
      `<input id="token" name="token" type="password" autocomplete="off" required style="font:inherit;width:100%;box-sizing:border-box;padding:.6rem;margin:.4rem 0 1rem;background:#152132;color:#fff;border:1px solid #68819a;border-radius:6px">` +
      `<button type="submit" style="font:inherit;padding:.55rem 1rem">Sign in</button></form>` +
      `<p>For a deliberate URL hand-off, open <code>?${TOKEN_QUERY_PARAM}=&lt;your token&gt;</code> once. The URL is then cleared.</p>` +
      `<h2 style="font-size:1rem;margin-top:2rem">Lost it completely?</h2>` +
      `<p>Read the token from your local file or service secret. Restarting the server requires browser sign-in again.</p>` +
      (source.kind === "file"
        ? `<p>If the token file is lost, delete it and restart to mint a new one. This also invalidates existing Bearer credentials and browser sessions.</p>`
        : "") +
      `</body></html>`,
    { status: 401, headers: { "content-type": "text/html; charset=utf-8" } },
  );
  if (clearLegacyCookie) response.cookies.delete(SESSION_COOKIE);
  return response;
}

function redirectWithoutHandoffToken(request: NextRequest): NextResponse {
  const clean = request.nextUrl.clone();
  clean.searchParams.delete(TOKEN_QUERY_PARAM);
  return NextResponse.redirect(clean, {
    status: 307,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function redirectToSessionUnavailable(request: NextRequest): NextResponse {
  const clean = request.nextUrl.clone();
  clean.pathname = "/auth/session-unavailable";
  clean.search = "";
  return NextResponse.redirect(clean, {
    status: 307,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

/** Only an activated, top-level document navigation renews idle activity. */
function isInteractiveNavigation(request: NextRequest): boolean {
  if (request.method !== "GET" || isApiPath(request.nextUrl.pathname)) return false;
  if (request.headers.get("purpose")?.toLowerCase() === "prefetch" || request.headers.has("next-router-prefetch")) return false;
  return request.headers.get("sec-fetch-mode") === "navigate"
    && request.headers.get("sec-fetch-dest") === "document"
    && request.headers.get("sec-fetch-user") === "?1";
}

function proxyImpl(request: NextRequest, policy: RequestPolicy): NextResponse {
  const { pathname } = request.nextUrl;
  const isSafe = SAFE_METHODS.has(request.method);
  const lifecycleWrite = AUTH_LIFECYCLE_WRITES.has(`${request.method} ${pathname}`);
  const hasHandoffToken = request.method === "GET" && request.nextUrl.searchParams.has(TOKEN_QUERY_PARAM);

  // A public path is exempt from AUTHENTICATION, never from read-only. It used
  // to return here, above the read-only branch, so any non-safe method added to
  // a public path would have punched straight through the mode. /api/health is
  // GET-only today, so this was a latent hole rather than a live one (T-0048).
  if (PUBLIC_PATHS.has(pathname) && isSafe) {
    return hasHandoffToken ? redirectWithoutHandoffToken(request) : pass(request, pathname, policy);
  }
  if (pathname === "/auth/session-unavailable" && isSafe) {
    if (hasHandoffToken) return redirectWithoutHandoffToken(request);
    return new NextResponse("Browser sessions are unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8", "Referrer-Policy": "no-referrer" },
    });
  }

  const readOnlyRefusal = !isSafe && isReadOnly() && !lifecycleWrite;

  if (getAuthMode() === "none") {
    if (hasHandoffToken) return redirectWithoutHandoffToken(request);
    if (pathname.startsWith("/api/auth/")) return NextResponse.json({ error: "Session management requires token authentication." }, { status: 403 });
    if (readOnlyRefusal) return refuseReadOnly();
    if (isHostSideEffectWrite(pathname, isSafe)) return refuseHostWrite();
    return pass(request, pathname, policy);
  }

  // FAILED-AUTH THROTTLE (T-0083, operator ruling 2). Checked before the token
  // is read or compared, so a client inside its penalty window gets no
  // comparison at all — which is the only version that actually slows a brute
  // force down. The window is capped at MAX_AUTH_PENALTY_SECONDS precisely
  // because it refuses valid tokens too: on loopback the operator and an
  // attacker are the same client, and an unbounded lock would be a denial of
  // service against the operator.
  const clientKey = authClientKey(request.headers);
  // Only a root-credential attempt needs this budget. An already validated
  // browser session can still navigate or sign out during bad guesses.
  const rootCredentialAttempt = hasHandoffToken || request.headers.has("authorization") ||
    (request.method === "POST" && pathname === "/api/auth/sign-in");
  const penalty = rootCredentialAttempt ? authPenaltySeconds(clientKey) : 0;
  if (penalty > 0) {
    if (hasHandoffToken) return redirectWithoutHandoffToken(request);
    return NextResponse.json(
      { error: `Too many failed sign-in attempts. Try again in ${penalty}s.` },
      { status: 429, headers: { "Retry-After": String(penalty) } },
    );
  }

  const expected = readAuthToken();
  if (!expected) {
    if (hasHandoffToken) return redirectWithoutHandoffToken(request);
    // Fail CLOSED. A missing token file means boot has not minted one yet; the
    // alternative (allow everything) is how this app shipped an RCE.
    const response = NextResponse.json(
      { error: "PatterStage has no access token configured yet. Restart the server to mint one." },
      { status: 503 },
    );
    if (request.method === "DELETE" && pathname === "/api/auth/session") {
      const origin = publicOrigin(request);
      if (origin && hasExactOrigin(request, origin)) response.cookies.delete(SESSION_COOKIE);
    }
    return response;
  }

  // The public body-token hand-off has exactly one method/path exception. The
  // handler checks Origin, body size, credential, throttle and committed insert.
  if (request.method === "POST" && pathname === "/api/auth/sign-in") {
    return pass(request, pathname, policy);
  }

  // These two handlers demand a fresh operator token from the body or an
  // explicit Bearer header. A browser session alone never authorises them.
  if (BODY_TOKEN_MANAGEMENT.has(`${request.method} ${pathname}`) &&
      !request.headers.has("authorization")) {
    return pass(request, pathname, policy);
  }

  // 2a. One-time hand-off: ?ps_token=<token> on a navigation exchanges the
  //     token for an httpOnly cookie, then redirects to strip it from the URL
  //     (and from the browser history / referrer).
  const handoff = request.nextUrl.searchParams.get(TOKEN_QUERY_PARAM);
  if (hasHandoffToken) {
    if (!tokenMatches(handoff, expected)) {
      recordAuthFailure(clientKey);
      return redirectWithoutHandoffToken(request);
    }
    const origin = publicOrigin(request);
    if (!origin) return redirectWithoutHandoffToken(request);
    let session;
    try { session = createBrowserSession(handoff!); }
    catch (error) {
      if (error instanceof SessionCredentialChangedError) {
        recordAuthFailure(clientKey);
        return redirectWithoutHandoffToken(request);
      }
      return redirectToSessionUnavailable(request);
    }
    clearAuthFailures(clientKey);
    const response = redirectWithoutHandoffToken(request);
    response.cookies.set(SESSION_COOKIE, session.secret,
      sessionCookieOptions(origin, Math.floor((session.expiresAtMs - Date.now()) / 1000)));
    return response;
  }

  // 2b. Bearer beats cookie: a bearer request is not CSRF-able, so it skips (3).
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer) {
    if (!tokenMatches(bearer, expected)) {
      recordAuthFailure(clientKey);
      return unauthorized(request);
    }
    clearAuthFailures(clientKey);
    return readOnlyRefusal ? refuseReadOnly() : pass(request, pathname, policy);
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return unauthorized(request);
  const origin = publicOrigin(request);
  if (!origin) return NextResponse.json({ error: "Browser origin is not configured safely." }, { status: 503 });
  let session;
  try { session = validateBrowserSession(cookie, isInteractiveNavigation(request)); }
  catch { return NextResponse.json({ error: "Browser sessions are unavailable." }, { status: 503 }); }
  if (!session) {
    // A revoked, expired or pre-upgrade cookie can be sent by many concurrent
    // page requests after sign-out or restart. It is not a root-token guess.
    // Counting those requests can block the operator's next sign-in.
    return unauthorized(request, Boolean(cookie));
  }
  if (!isSafe && !hasExactOrigin(request, origin)) {
    return NextResponse.json({ error: "Cross-origin write rejected." }, { status: 403 });
  }

  return readOnlyRefusal ? refuseReadOnly() : pass(request, pathname, policy);
}

export function proxy(request: NextRequest): NextResponse {
  const policy = requestPolicy();
  const response = proxyImpl(request, policy);
  response.headers.set("Content-Security-Policy", policy.value);
  if (response.headers.get("content-type")?.toLowerCase().startsWith("text/html")) {
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

export const config = {
  // Everything except Next's own static output and the favicon. API routes are
  // deliberately INCLUDED — they are the surface that matters.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
