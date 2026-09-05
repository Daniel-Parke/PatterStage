// ═══════════════════════════════════════════════════════════════
// /api/sessions — Unified session registry
//
// PatterStage is the source of truth for ALL agent sessions.
// Hermes session files on disk are synced into the DB on every
// GET. Agent-native sessions (mission, cron) are written
// directly by the dispatch pipeline.
//
// GET /api/sessions
//   Query params: agentType, source, missionId, limit, offset
//
// GET /api/sessions?id=<id>
//   Returns a single session by id
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { sessionsRateLimitResponse } from "@/lib/sessions/sessions-api-guard";
import { isReadOnly } from "@/lib/api-auth";
import { badRequest, created, notFound, ok, serviceUnavailable } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import {
  listSessions,
  getSession,
  createSession,
  updateSession,
  type AgentType,
  type SessionSource,
  type SessionStatus,
} from "@/lib/sessions/session-repository";
import {
  parseSessionQuery,
  triggerSyncOnce,
} from "@/lib/sessions/sessions-api-helpers";

export async function GET(request: NextRequest) {
  // The limiter has existed since the sessions API was written and was wired
  // only to /api/sessions/[id] — not to the LIST route, which is the one a QA
  // pass hit 130 times without ever seeing a 429 (finding 13). The list is
  // also the more expensive read of the two: it syncs from Hermes and scans
  // the table, where the [id] route reads one row.
  const limited = sessionsRateLimitResponse(request, "GET /api/sessions");
  if (limited) return limited;

  try {
    const q = parseSessionQuery(request);

    if (q.id) {
      const session = getSession(q.id);
      if (!session) {
        return notFound("Session not found");
      }
      return ok({ session });
    }

    // Both syncs below write state.db rows into the sessions table. Under
    // PS_READ_ONLY the list is still served from what is already there; the
    // writes are what the mode exists to stop (T-0095, D124).
    // check-read-only-guards-disable-next-line -- this GET syncs Hermes sessions into the table, a write it skips under the mode while still answering
    const writesAllowed = !isReadOnly();

    // Sync layer handles background syncing of Hermes sessions (debounced — at most once per 30s)
    if (writesAllowed) triggerSyncOnce();

    const result = listSessions({
      agentType: q.agentType,
      source: q.source,
      status: q.status,
      excludeApiNoise: q.excludeApiNoise,
      missionId: q.missionId,
      search: q.search,
      limit: q.limit,
      offset: q.offset,
      // Force an immediate sync from state.db so the active session shows
      // fresh messageCount, title, and status. The periodic sync is
      // debounced at 30s; without this the user sees a stale "0 msgs"
      // for the session they're currently in.
      syncIfActive: writesAllowed,
    });

    return ok({
      sessions: result.sessions,
      total: result.total,
      // The whole-table figures behind the insight tiles. They travel with the
      // page rather than being recomputed from it: `totals.total` IS `total`,
      // which is what stops a tile contradicting the header above it (T-0042).
      totals: result.totals,
      // Every source this filter can still reach. The page built its filter
      // buttons from a constant, so a session from any other source could not
      // be found by what started it (T-0105, D29).
      sources: result.sources,
    });
  } catch (error) {
    return serverErrorFromCatch("GET /api/sessions", "listing sessions", error, "Failed to load sessions");
  }
}

export async function POST(request: NextRequest) {
  if (isReadOnly()) {
    return serviceUnavailable("PatterStage is in read-only mode");
  }

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const body = bodyResult as {
    action?: string;
    id?: string;
    agentType?: AgentType;
    source?: SessionSource;
    missionId?: string | null;
    profileName?: string | null;
    modelId?: string | null;
    provider?: string | null;
    title?: string | null;
    status?: SessionStatus;
    endedAt?: string | null;
    exitCode?: number | null;
    error?: string | null;
  };

  try {
    // action=create — used by dispatch pipeline to pre-register a session
    if (body.action === "create") {
      if (!body.source) {
        return badRequest("source is required");
      }
      const session = createSession({
        agentType: body.agentType,
        source: body.source,
        missionId: body.missionId,
        profileName: body.profileName,
        modelId: body.modelId,
        provider: body.provider,
        title: body.title,
        status: body.status ?? "active",
      });
      return created({ session });
    }

    // action=update — used by dispatch pipeline on mission complete/fail
    if (body.action === "update") {
      if (!body.id) {
        return badRequest("id is required");
      }
      const session = updateSession(body.id, {
        endedAt: body.endedAt,
        status: body.status,
        exitCode: body.exitCode,
        error: body.error,
      });
      if (!session) {
        return notFound("Session not found");
      }
      return ok({ session });
    }

    return badRequest("Unknown action");
  } catch (error) {
    return serverErrorFromCatch("POST /api/sessions", "session action", error, "Failed to process session action");
  }
}
