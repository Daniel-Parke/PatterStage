import { NextRequest, NextResponse } from "next/server";

import { logApiError } from "@/lib/api/api-logger";
import { authClientKey } from "@/lib/api/auth-throttle";

/** Default max session transcript size (bytes) before GET returns 413. Override with MAX_SESSION_FILE_BYTES. */
const DEFAULT_MAX_SESSION_BYTES = 64 * 1024 * 1024;

/** Sliding window for rate limit (ms). */
const RATE_WINDOW_MS = 60_000;

/** Max GET /api/sessions* per client per window. Override with SESSIONS_API_RATE_LIMIT_MAX. */
const DEFAULT_RATE_MAX = 120;

const windowHits = new Map<string, number[]>();

/** Default max messages a transcript response carries. Override with MAX_SESSION_MESSAGES. */
const DEFAULT_MAX_SESSION_MESSAGES = 2000;

/**
 * How many messages one transcript answer may carry.
 *
 * The byte ceiling above is a refusal: over it, the route answers 413 and the
 * operator sees nothing. A long-but-legal transcript still arrived whole and
 * was rendered whole, one bubble per message with no virtualisation
 * (T-0105, D40). The cap is the middle answer: the newest N, and a line saying
 * so.
 */
export function getMaxSessionMessages(): number {
  const n = Number(process.env.MAX_SESSION_MESSAGES);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_SESSION_MESSAGES;
}

export function getMaxSessionFileBytes(): number {
  const n = Number(process.env.MAX_SESSION_FILE_BYTES);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_SESSION_BYTES;
}

function maxRatePerWindow(): number {
  const n = Number(process.env.SESSIONS_API_RATE_LIMIT_MAX);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RATE_MAX;
}

/**
 * Forgets every caller whose window has passed.
 *
 * The map is keyed by a header the caller sends, so without this a caller that
 * changes the header on every request grows it without bound. The auth throttle
 * prunes for the same reason, on its own longer clock; here the sliding window
 * IS the lifetime, so nothing older than one window is worth keeping.
 */
function pruneWindows(now: number): void {
  for (const [key, hits] of windowHits) {
    if (hits.length === 0 || now - hits[hits.length - 1] >= RATE_WINDOW_MS) {
      windowHits.delete(key);
    }
  }
}

/**
 * How many callers are remembered. Exported for one assertion, the same reason
 * the auth throttle exports its own count: the key comes from a header the
 * caller controls, and that the map SHRINKS shows up in no response, so without
 * this the prune above could be deleted and nothing would notice.
 *
 * What it bounds, precisely. A caller sending a new header value on every
 * request never re-hits a key, so each entry survives its full window: the map
 * holds one window's distinct headers, not one per request forever. That is a
 * bound and it is not a small one.
 */
export function sessionsRateWindowCount(): number {
  return windowHits.size;
}

/**
 * Records this request and returns true if the client should be throttled.
 */
function sessionsApiRateLimitExceeded(request: NextRequest): boolean {
  // One derivation, shared with the auth throttle: two answers to "which client
  // is this" would be two security boundaries, and only one of them would be
  // reviewed when the answer changed.
  const key = authClientKey(request.headers);
  const now = Date.now();
  pruneWindows(now);
  const max = maxRatePerWindow();
  const existing = windowHits.get(key) || [];
  const arr = existing.filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length === 0) {
    windowHits.delete(key);
  } else {
    windowHits.set(key, arr);
  }
  if (arr.length >= max) {
    return true;
  }
  windowHits.set(key, [...arr, now]);
  return false;
}

export function sessionsRateLimitResponse(
  request: NextRequest,
  routeLabel = "GET /api/sessions*"
): NextResponse | null {
  if (!sessionsApiRateLimitExceeded(request)) {
    return null;
  }
  logApiError(
    routeLabel,
    "rate limit exceeded for " + authClientKey(request.headers),
    new Error("TooManyRequests")
  );
  return NextResponse.json(
    { error: "Too many session requests. Try again in a minute." },
    { status: 429 }
  );
}
