import { NextRequest, NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";

/** Default max session transcript size (bytes) before GET returns 413. Override with MAX_SESSION_FILE_BYTES. */
const DEFAULT_MAX_SESSION_BYTES = 64 * 1024 * 1024;

/** Sliding window for rate limit (ms). */
const RATE_WINDOW_MS = 60_000;

/** Max GET /api/sessions* per client per window. Override with SESSIONS_API_RATE_LIMIT_MAX. */
const DEFAULT_RATE_MAX = 120;

const windowHits = new Map<string, number[]>();

export function getMaxSessionFileBytes(): number {
  const n = Number(process.env.MAX_SESSION_FILE_BYTES);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_SESSION_BYTES;
}

function maxRatePerWindow(): number {
  const n = Number(process.env.SESSIONS_API_RATE_LIMIT_MAX);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RATE_MAX;
}

export function getSessionsApiClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "local";
}

/**
 * Records this request and returns true if the client should be throttled.
 */
export function sessionsApiRateLimitExceeded(request: NextRequest): boolean {
  const key = getSessionsApiClientKey(request);
  const now = Date.now();
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
    "rate limit exceeded for " + getSessionsApiClientKey(request),
    new Error("TooManyRequests")
  );
  return NextResponse.json(
    { error: "Too many session requests. Try again in a minute." },
    { status: 429 }
  );
}
