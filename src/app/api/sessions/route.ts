// ═══════════════════════════════════════════════════════════════
// /api/sessions — Unified session registry
//
// Control Hub is the source of truth for ALL agent sessions.
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
import { logApiError } from "@/lib/api-logger";
import { requireAuth, isChReadOnly } from "@/lib/api-auth";
import { badRequest, notFound, serverError, serviceUnavailable } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import {
  listSessions,
  getSession,
  createSession,
  updateSession,
  type AgentType,
  type SessionSource,
  type SessionStatus,
} from "@/lib/session-repository";
import {
  parseSessionQuery,
  triggerSyncOnce,
} from "@/lib/sessions-api-helpers";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    const q = parseSessionQuery(request);

    if (q.id) {
      const session = getSession(q.id);
      if (!session) {
        return notFound("Session not found");
      }
      return NextResponse.json({ data: { session } });
    }

    // Sync layer handles background syncing of Hermes sessions (debounced — at most once per 30s)
    triggerSyncOnce();

    const result = listSessions({
      agentType: q.agentType,
      source: q.source,
      missionId: q.missionId,
      limit: q.limit,
      offset: q.offset,
      // Force an immediate sync from state.db so the active session shows
      // fresh messageCount, title, and status. The periodic sync is
      // debounced at 30s; without this the user sees a stale "0 msgs"
      // for the session they're currently in.
      syncIfActive: true,
    });

    return NextResponse.json({
      data: {
        sessions: result.sessions,
        total: result.total,
      },
    });
  } catch (error) {
    logApiError("GET /api/sessions", "listing sessions", error);
    return serverError("Failed to load sessions");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  if (isChReadOnly()) {
    return serviceUnavailable("Control Hub is in read-only mode");
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
        agentType: body.agentType ?? "hermes",
        source: body.source,
        missionId: body.missionId,
        profileName: body.profileName,
        modelId: body.modelId,
        provider: body.provider,
        title: body.title,
        status: body.status ?? "active",
      });
      return NextResponse.json({ data: { session } }, { status: 201 });
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
      return NextResponse.json({ data: { session } });
    }

    return badRequest("Unknown action");
  } catch (error) {
    logApiError("POST /api/sessions", "session action", error);
    return serverError("Failed to process session action");
  }
}
