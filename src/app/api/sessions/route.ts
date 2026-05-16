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
import {
  createSession,
  updateSession,
  getSession,
  listSessions,
  type AgentType,
  type SessionSource,
  type SessionStatus,
} from "@/lib/session-repository";
import { requireMcApiKey } from "@/lib/api-auth";
import { ensureSyncLayer } from "@/lib/sync";

// ── Debounced sync: fires at most once per 30s ───────────────
// Uses a module-level Promise chain instead of a mutable timestamp.
// This avoids the mutable state anti-pattern while preserving the
// debounce semantics for concurrent requests.
let pendingSync: Promise<void> | null = null;

function triggerSyncOnce(): void {
  if (pendingSync) return;
  pendingSync = new Promise<void>((resolve) => {
    ensureSyncLayer();
    setTimeout(() => {
      pendingSync = null;
      resolve();
    }, 30_000);
  });
}

function parseQuery(
  req: NextRequest,
): {
  agentType?: AgentType;
  source?: SessionSource;
  missionId?: string | null;
  limit: number;
  offset: number;
  id?: string;
} {
  const u = new URL(req.url);
  const id = u.searchParams.get("id") ?? undefined;
  const rawAgentType = u.searchParams.get("agentType");
  const agentType: AgentType | undefined =
    rawAgentType && ["hermes"].includes(rawAgentType) ? rawAgentType as AgentType : undefined;
  const rawSource = u.searchParams.get("source");
  const source: SessionSource | undefined =
    rawSource && ["cli", "cron", "mission", "api"].includes(rawSource) ? rawSource as SessionSource : undefined;
  const missionIdParam = u.searchParams.get("missionId");
  const missionId: string | null | undefined =
    missionIdParam === null ? undefined : missionIdParam;
  const limit = Math.min(parseInt(u.searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(u.searchParams.get("offset") ?? "0", 10);
  return { agentType, source, missionId, limit, offset, id };
}

export async function GET(request: NextRequest) {
  const limited = requireMcApiKey(request);
  if (limited) return limited;

  try {
    const q = parseQuery(request);

    if (q.id) {
      const session = getSession(q.id);
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
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
    });

    return NextResponse.json({
      data: {
        sessions: result.sessions,
        total: result.total,
      },
    });
  } catch (error) {
    logApiError("GET /api/sessions", "listing sessions", error);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const limited = requireMcApiKey(request);
  if (limited) return limited;

  try {
    const body = await request.json() as {
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

    // action=create — used by dispatch pipeline to pre-register a session
    if (body.action === "create") {
      if (!body.source) {
        return NextResponse.json({ error: "source is required" }, { status: 400 });
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
        return NextResponse.json({ error: "id is required" }, { status: 400 });
      }
      const session = updateSession(body.id, {
        endedAt: body.endedAt,
        status: body.status,
        exitCode: body.exitCode,
        error: body.error,
      });
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      return NextResponse.json({ data: { session } });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    logApiError("POST /api/sessions", "session action", error);
    return NextResponse.json({ error: "Failed to process session action" }, { status: 500 });
  }
}
