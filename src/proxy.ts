// ═══════════════════════════════════════════════════════════════
// proxy.ts — the ONE authentication + CSRF + read-only boundary
//
// Next 16 renamed `middleware` to `proxy` and runs it on the Node.js runtime,
// so this file can read the token file directly. It runs before every route.
//
// Why here and not in route handlers: `requireAuth()` in src/lib/api-auth.ts
// never authenticated anything (it only checked the read-only flag), so all 100
// API routes were open to anyone who could reach the port — and BOTH start
// scripts bind 0.0.0.0, not just `start:network`. `next start` has no loopback
// default; with no -H it listens on every interface and prints the LAN URL. The
// naming used to suggest otherwise here and in the README, which made the
// exposure sound opt-in when it is the default. A boundary that each new route
// has to remember to opt into is not a boundary. This one cannot be forgotten.
//
// Three checks, in order:
//   1. read-only     — PS_READ_ONLY rejects unsafe METHODS (not, as before,
//                      whichever handlers happened to call the guard).
//   2. authentication — Bearer token or the ps_session cookie.
//   3. CSRF          — a cookie-authenticated unsafe request must be same-origin,
//                      so a page you visit cannot drive your control plane.
// ═══════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_COOKIE,
  TOKEN_QUERY_PARAM,
  describeTokenSource,
  getAuthMode,
  readAuthToken,
  tokenMatches,
} from "@/lib/auth-token";
import { isReadOnly, readOnlyMessage } from "@/lib/read-only";
import {
  authClientKey,
  authPenaltySeconds,
  clearAuthFailures,
  recordAuthFailure,
} from "@/lib/auth-throttle";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Reachable without a token. Deliberately tiny: a liveness probe the deploy
 * runner and container health checks need before a token can be presented.
 * `/api/status` is NOT here — it reports real system state.
 */
const PUBLIC_PATHS = new Set(["/api/health"]);

/**
 * The routes whose WRITES reach the host: a script the editor saves is executed
 * later by cron and by /api/scripts/run, a crontab line is installed, the
 * deploy script is spawned. With the token on, an authenticated operator
 * already has a shell on this machine and these are features. With
 * `PS_AUTH_MODE=none` they are unauthenticated remote code execution.
 *
 * `requireAuthenticatedHostWrites()` in src/lib/api-auth.ts is the same rule at
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
 * instance is read-only, and `npm run start:network` binds 0.0.0.0. An
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
function pass(request: NextRequest, pathname: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-ps-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * HTML-escape a server-derived string before it goes into the 401 page. The
 * only interpolation is the token path, which comes from env/config rather than
 * the request, but a page that hand-builds HTML should escape unconditionally
 * rather than rely on where today's input happens to come from.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Did this request arrive over loopback?
 *
 * It decides whether the 401 may name the token file's RESOLVED absolute path.
 * A caller on the machine needs that path to sign in; a caller across the
 * network must not be handed the OS username and install layout, which is what
 * an absolute home-directory path discloses. Under `npm run start:network` the
 * server binds 0.0.0.0, so the two are genuinely different audiences.
 *
 * The Host header is the right signal here: a request that reached a loopback
 * address is one that came through loopback, because a remote client cannot
 * route to another machine's 127.0.0.1. Getting this wrong only ever costs a
 * less specific error message; it can never grant access.
 */
function isLoopbackRequest(request: NextRequest): boolean {
  const host = (request.headers.get("host") || request.nextUrl.hostname || "")
    .replace(/:\d+$/, "")
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
}

/**
 * The 401 is the first PatterStage screen a lot of people ever see: the
 * installer finishes, they open the bare URL, and this is what answers. So it
 * has to be a set of instructions, not a refusal.
 *
 * It names the RESOLVED token location (a first-time user cannot expand
 * "PS_DATA_DIR" themselves), the command that prints it, and the way to recover
 * a token that is lost entirely. It reflects nothing from the request, so there
 * is no host or path to smuggle into the markup.
 *
 * None of this relaxes the check. The token requirement is unchanged; only the
 * explanation of how to satisfy it is.
 */
function unauthorized(request: NextRequest): NextResponse {
  const source = describeTokenSource();

  if (isApiPath(request.nextUrl.pathname)) {
    // No path here, on purpose. The consumer is a script, which cannot act on a
    // filesystem hint anyway, and this branch answers unauthenticated callers
    // from anywhere the server is reachable.
    return NextResponse.json(
      {
        error:
          "Unauthorized. Send 'Authorization: Bearer <token>'. The server prints the full sign-in URL on the first [auth] line of its log at every start.",
      },
      { status: 401 },
    );
  }

  // Only a caller at the machine gets the resolved path.
  const local = isLoopbackRequest(request);

  const readHint =
    source.kind === "env"
      ? `<p>This server takes its token from the <code>PS_AUTH_TOKEN</code> environment variable it was started with. Read it from your container or service definition.</p>`
      : local
        ? `<p><strong>1.</strong> Your token is the single line in this file:</p>` +
          `<pre style="background:#0d1420;padding:.6rem .8rem;border-radius:6px;overflow-x:auto"><code>${escapeHtml(source.location)}</code></pre>` +
          `<p>Print it with <code>cat ${escapeHtml(source.location)}</code>.</p>`
        : `<p><strong>1.</strong> Your token is the single line in <code>auth-token</code>, inside the data directory on the machine running PatterStage. Read it there, or read the sign-in URL off that server's log.</p>`;

  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>PatterStage: access token required</title>` +
      `<body style="font:16px/1.6 system-ui;max-width:38rem;margin:10vh auto;padding:0 1.5rem;background:#05080d;color:#eaf2f8">` +
      `<h1 style="font-size:1.4rem">PatterStage needs your access token</h1>` +
      `<p>PatterStage is a single-operator control plane, so there is no login. The server minted one random token for you on first boot and every request is checked against it.</p>` +
      readHint +
      `<p><strong>${source.kind === "env" ? "Then" : "2."}</strong> Open this address once with the token on the end:</p>` +
      `<pre style="background:#0d1420;padding:.6rem .8rem;border-radius:6px;overflow-x:auto"><code>?${TOKEN_QUERY_PARAM}=&lt;your token&gt;</code></pre>` +
      `<p>PatterStage swaps it for a session cookie and strips it back out of the URL, so you only paste it once per browser.</p>` +
      `<h2 style="font-size:1rem;margin-top:2rem">Lost it completely?</h2>` +
      `<p>Restart PatterStage. It prints the whole sign-in URL, token included, on the first <code>[auth]</code> line of the server log at every start.</p>` +
      (source.kind === "file" && local
        ? `<p>Deleting that file and restarting mints a fresh token. That is also how you revoke the old one: every browser signed in with it is signed out.</p>`
        : "") +
      `</body>`,
    { status: 401, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/**
 * Same-origin test for cookie-authenticated writes. `Sec-Fetch-Site` is sent by
 * every current browser and is the reliable signal; the Origin host comparison
 * is the fallback for clients that omit it.
 */
function isSameOrigin(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";

  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser client; the bearer path covers it
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isSafe = SAFE_METHODS.has(request.method);

  // A public path is exempt from AUTHENTICATION, never from read-only. It used
  // to return here, above the read-only branch, so any non-safe method added to
  // a public path would have punched straight through the mode. /api/health is
  // GET-only today, so this was a latent hole rather than a live one (T-0048).
  if (PUBLIC_PATHS.has(pathname) && isSafe) return pass(request, pathname);

  const readOnlyRefusal = !isSafe && isReadOnly();

  if (getAuthMode() === "none") {
    if (readOnlyRefusal) return refuseReadOnly();
    if (isHostSideEffectWrite(pathname, isSafe)) return refuseHostWrite();
    return pass(request, pathname);
  }

  // FAILED-AUTH THROTTLE (T-0083, operator ruling 2). Checked before the token
  // is read or compared, so a client inside its penalty window gets no
  // comparison at all — which is the only version that actually slows a brute
  // force down. The window is capped at MAX_AUTH_PENALTY_SECONDS precisely
  // because it refuses valid tokens too: on loopback the operator and an
  // attacker are the same client, and an unbounded lock would be a denial of
  // service against the operator.
  const clientKey = authClientKey(request.headers);
  const penalty = authPenaltySeconds(clientKey);
  if (penalty > 0) {
    return NextResponse.json(
      { error: `Too many failed sign-in attempts. Try again in ${penalty}s.` },
      { status: 429, headers: { "Retry-After": String(penalty) } },
    );
  }

  const expected = readAuthToken();
  if (!expected) {
    // Fail CLOSED. A missing token file means boot has not minted one yet; the
    // alternative (allow everything) is how this app shipped an RCE.
    return NextResponse.json(
      { error: "PatterStage has no access token configured yet. Restart the server to mint one." },
      { status: 503 },
    );
  }

  // 2a. One-time hand-off: ?ps_token=<token> on a navigation exchanges the
  //     token for an httpOnly cookie, then redirects to strip it from the URL
  //     (and from the browser history / referrer).
  const handoff = request.nextUrl.searchParams.get(TOKEN_QUERY_PARAM);
  if (handoff && isSafe) {
    if (!tokenMatches(handoff, expected)) {
      recordAuthFailure(clientKey);
      return unauthorized(request);
    }
    clearAuthFailures(clientKey);
    const clean = request.nextUrl.clone();
    clean.searchParams.delete(TOKEN_QUERY_PARAM);
    const response = NextResponse.redirect(clean);
    response.cookies.set(SESSION_COOKIE, expected, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      secure: request.nextUrl.protocol === "https:",
    });
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
    return readOnlyRefusal ? refuseReadOnly() : pass(request, pathname);
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!tokenMatches(cookie, expected)) {
    // A request carrying NO cookie at all is the normal first visit, not an
    // attempt: counting it would penalise a browser for arriving.
    if (cookie) recordAuthFailure(clientKey);
    return unauthorized(request);
  }
  clearAuthFailures(clientKey);

  // 3. Cookie-authenticated writes must be same-origin.
  if (!isSafe && !isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Cross-origin write rejected." },
      { status: 403 },
    );
  }

  return readOnlyRefusal ? refuseReadOnly() : pass(request, pathname);
}

export const config = {
  // Everything except Next's own static output and the favicon. API routes are
  // deliberately INCLUDED — they are the surface that matters.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
