// ═══════════════════════════════════════════════════════════════
// sessions-api-helpers.ts — Pure helpers for /api/sessions route
// ═══════════════════════════════════════════════════════════════
//
// Extracted from src/app/api/sessions/route.ts so the small pieces
// of logic that don't depend on the request handler's DB access can
// be unit-tested in isolation:
//   - `pickEnum`          — typed lookup against a known string tuple
//   - `triggerSyncOnce`   — debounced (30s) sync trigger
//   - `parseSessionQuery` — query-string → typed options object
//
// Keeping these in a separate module (rather than re-declaring them
// per route) means a future route that needs the same enum-pick or
// debounced-sync pattern can import the helpers rather than
// re-implement.

import type { NextRequest } from "next/server";
import { parseListBounds } from "@/lib/list-bounds";
import { ensureSyncLayer } from "@/lib/sync";
import type {
  AgentType,
  SessionSource,
} from "@/lib/sessions/session-repository";

// ── Type constants ──────────────────────────────────────────────

export const ALL_AGENT_TYPES = ["hermes"] as const;
export const ALL_SOURCES = ["cli", "cron", "mission", "api"] as const;

// ── Enum picker ────────────────────────────────────────────────

/**
 * Pick a value from a known enum tuple if the raw input matches.
 * Returns undefined for missing / invalid values so callers can short-circuit.
 */
export function pickEnum<T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T | undefined {
  return raw && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : undefined;
}

// ── Debounced sync ─────────────────────────────────────────────
// Uses a module-level Promise to track whether a sync window is
// active. ensureSyncLayer() is called OUTSIDE the Promise so it
// fires immediately on the first call; subsequent calls within
// 30s are no-ops until the window expires.
let pendingSync: Promise<void> | null = null;

/**
 * Trigger a one-shot Hermes session sync. Coalesces calls within
 * the debounce window so a burst of /api/sessions requests doesn't
 * hammer the sync layer. Default window is 30s; pass a different
 * value in tests.
 */
export function triggerSyncOnce(debounceMs: number = 30_000): void {
  if (pendingSync) return;
  // Call OUTSIDE the Promise so it runs immediately, not after the
  // debounce expires. The Promise just holds the timer.
  ensureSyncLayer();
  pendingSync = new Promise<void>((resolve) => {
    setTimeout(() => {
      pendingSync = null;
      resolve();
    }, debounceMs);
  });
}

/** Test-only: reset the debounce state. Production code should never call this. */
export function _resetSyncDebounceForTests(): void {
  pendingSync = null;
}

// ── Query parser ───────────────────────────────────────────────

export interface ParsedSessionQuery {
  agentType?: AgentType;
  source?: SessionSource;
  /** Undefined when the key is missing; the string value otherwise (empty string for `?missionId=`). */
  missionId?: string;
  /** Free-text search over the full table (title / id / profile / mission). */
  search?: string;
  limit: number;
  offset: number;
  id?: string;
}

/**
 * Parse /api/sessions query string into a typed options object.
 * `missionId` is the only nullable field: the API treats a missing
 * value as "any" and an empty string as "explicitly null" (so
 * missionId= lets callers filter to missionless sessions).
 */
export function parseSessionQuery(req: NextRequest): ParsedSessionQuery {
  const u = new URL(req.url);
  const id = u.searchParams.get("id") ?? undefined;
  const agentType = pickEnum(u.searchParams.get("agentType"), ALL_AGENT_TYPES);
  const source = pickEnum(u.searchParams.get("source"), ALL_SOURCES);
  const missionIdParam = u.searchParams.get("missionId");
  // `searchParams.get` returns `null` when the key is missing;
  // coalesce to undefined so callers can use a single optional check.
  const missionId: string | undefined =
    missionIdParam === null ? undefined : missionIdParam;
  // parseInt bound NaN on junk and -1 on "-1", which SQLite reads as
  // "no limit": the cap bypass the round-6 audit found (T-0088).
  const { limit, offset } = parseListBounds(u.searchParams, { defaultLimit: 50, maxLimit: 100 });
  const searchParam = u.searchParams.get("search")?.trim();
  const search = searchParam ? searchParam : undefined;
  return { agentType, source, missionId, search, limit, offset, id };
}
