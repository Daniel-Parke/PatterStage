// sessions-api-helpers.ts — the pieces of /api/sessions that need no DB access.

import type { NextRequest } from "next/server";
import { parseListBounds } from "@/lib/list-bounds";
import { ensureSyncLayer } from "@/lib/sync";
import type {
  AgentType,
  SessionStatus,
} from "@/lib/sessions/session-repository";

export const ALL_AGENT_TYPES = ["hermes"] as const;
/** The sources PatterStage has a word for. Not the set that can occur. */
export const ALL_SOURCES = ["cli", "cron", "mission", "api", "chat", "subagent", "tui"] as const;
const ALL_STATUSES = ["active", "completed", "failed"] as const;

/**
 * A source is free text in the column, so the filter accepts anything that
 * looks like one rather than only the names above: running it through
 * pickEnum silently dropped the filter for every other source, so asking for
 * subagent sessions returned all of them (T-0105, D29).
 */
const SOURCE_SHAPE = /^[a-z0-9][a-z0-9_.-]{0,31}$/i;

/** The raw input when it is one of `allowed`, else undefined. */
export function pickEnum<T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T | undefined {
  return raw && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : undefined;
}

// Non-null while a sync debounce window is open.
let pendingSync: Promise<void> | null = null;

/**
 * One-shot Hermes session sync, coalescing calls within the window so a burst
 * of /api/sessions requests does not hammer the sync layer. Tests pass a shorter window.
 */
export function triggerSyncOnce(debounceMs: number = 30_000): void {
  if (pendingSync) return;
  // OUTSIDE the Promise so it runs now, not after the window; the Promise only holds the timer.
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

export interface ParsedSessionQuery {
  agentType?: AgentType;
  source?: string;
  status?: SessionStatus;
  /** Drop short-lived api chatter, in SQL (T-0105, D31). */
  excludeApiNoise?: boolean;
  /** Undefined when the key is missing; the string value otherwise (empty string for `?missionId=`). */
  missionId?: string;
  /** Free-text search over the full table (title / id / profile / mission). */
  search?: string;
  limit: number;
  offset: number;
  id?: string;
}

/**
 * Query string to typed options. `missionId` is the only nullable field:
 * missing means "any", empty string means "explicitly null" (missionless sessions).
 */
export function parseSessionQuery(req: NextRequest): ParsedSessionQuery {
  const u = new URL(req.url);
  const id = u.searchParams.get("id") ?? undefined;
  const agentType = pickEnum(u.searchParams.get("agentType"), ALL_AGENT_TYPES);
  const rawSource = u.searchParams.get("source");
  const source = rawSource && SOURCE_SHAPE.test(rawSource) ? rawSource : undefined;
  const status = pickEnum(u.searchParams.get("status"), ALL_STATUSES);
  const excludeApiNoise = u.searchParams.get("hideApiNoise") === "1";
  const missionIdParam = u.searchParams.get("missionId");
  // `get` returns null when the key is missing; coalesce to undefined for one optional check.
  const missionId: string | undefined =
    missionIdParam === null ? undefined : missionIdParam;
  // parseInt bound NaN on junk and -1 on "-1", which SQLite reads as
  // "no limit": the cap bypass the round-6 audit found (T-0088).
  const { limit, offset } = parseListBounds(u.searchParams, { defaultLimit: 50, maxLimit: 100 });
  const searchParam = u.searchParams.get("search")?.trim();
  const search = searchParam ? searchParam : undefined;
  return { agentType, source, status, excludeApiNoise, missionId, search, limit, offset, id };
}
