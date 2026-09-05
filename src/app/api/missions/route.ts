// ═══════════════════════════════════════════════════════════════
// /api/missions — Mission CRUD + dispatch (SQLite)
// ═══════════════════════════════════════════════════════════════
// Missions are stored in PatterStage SQLite. Dispatch is handled
// by the Hermes backend for mission execution.
//
// This route is a thin auth + parse + router: each POST action
// (dispatch/promote/update/cancel/delete) lives in its own module
// under src/lib/mission-handlers/*. The id/category resolution helpers
// shared by the handlers + GET live in mission-handlers/shared.ts.
import { NextRequest, NextResponse } from "next/server";

import { listMissions } from "@/lib/missions/mission-repository";
import { boundsFrom, MISSION_LIST_BOUNDS } from "@/lib/list-bounds";
import { getLatestRunForMission, listLatestRunsForMissions } from "@/lib/runs-repository";
import { buildMissionRunView } from "@/lib/orchestration/run-deadline";
import { getScheduleForMission, listSchedulesForMissions } from "@/lib/schedules-repository";
import { toMissionScheduleView } from "@/lib/missions/mission-schedule-view";
import { requireNotReadOnly } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { parseJsonBody } from "@/lib/parse-json-body";
import { badRequest, ok } from "@/lib/api-response";
import { ensureSyncLayer } from "@/lib/sync";
import { getMissionOrNotFound } from "@/lib/missions/mission-handlers/shared";
import { handleDispatchMission } from "@/lib/missions/mission-handlers/dispatch";
import { handlePromoteMission } from "@/lib/missions/mission-handlers/promote";
import { handleUpdateMission } from "@/lib/missions/mission-handlers/update";
import { handleCancelMission } from "@/lib/missions/mission-handlers/cancel";
import { handleDeleteMission } from "@/lib/missions/mission-handlers/delete";

// ── GET ───────────────────────────────────────────────────────

// A READ. No guard of any kind: src/proxy.ts authenticates every request
// before this handler exists, and read-only mode is a restriction on WRITES.
// This route used to call requireAuth(), which authenticates nothing and
// answers 503 under PS_READ_ONLY, so setting the flag to browse safely made
// the missions board unreadable (T-0034).
export async function GET(request: NextRequest) {
  ensureSyncLayer();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  try {
    if (id) {
      const mission = getMissionOrNotFound(id);
      if (mission instanceof NextResponse) return mission;
      // Mission status is synced in background by MissionSync. The run row is
      // sent alongside it: it carries the only honest answer to "how long has
      // this been going and when does the reconciler give up on it", and the
      // detail panel was previously guessing from the mission's createdAt.
      return ok({
        mission,
        run: buildMissionRunView(mission, getLatestRunForMission(mission.id)),
        // The panel's schedule card had no source until now (T-0104, D68).
        schedule: toMissionScheduleView(getScheduleForMission(mission.id)),
      });
    }

    const categoryIdParam = url.searchParams.get("categoryId");
    const bounds = boundsFrom(request, MISSION_LIST_BOUNDS);
    const missions = listMissions({
      ...(categoryIdParam === "__uncategorized__"
        ? { categoryId: null }
        : categoryIdParam
          ? { categoryId: categoryIdParam }
          : {}),
      ...bounds,
    });
    // One extra query for the whole page, not one per row: the board needs the
    // run anchor to distinguish a mission that started ten seconds ago from one
    // that has been dispatched for two hours.
    const ids = missions.map((m) => m.id);
    const runs = listLatestRunsForMissions(ids);
    const schedules = listSchedulesForMissions(ids);
    return ok({
      missions: missions.map((m) => ({
        ...m,
        run: buildMissionRunView(m, runs.get(m.id) ?? null),
        scheduleStatus: toMissionScheduleView(schedules.get(m.id) ?? null),
      })),
    });
  } catch (error) {
    return serverErrorFromCatch("GET /api/missions", id ? `mission ${id}` : "listing missions", error, "Failed to load missions");
  }
}

// ── POST ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // One read-only guard, not two. This handler carried requireAuth() AND an
  // isReadOnly() block, which are the same check: requireAuth IS
  // requireNotReadOnly under an older name. The duplication is what the name
  // was costing (T-0034).
  const readOnly = requireNotReadOnly("missions cannot be created or changed");
  if (readOnly) return readOnly;

  ensureSyncLayer();

  // Hoist parseJsonBody out of the main try/catch so malformed JSON returns
  // 400 (REST semantics) instead of being swallowed and re-thrown as a
  // generic 500 from the catch below. Same bug class as the session-37
  // fix for /api/sessions, /api/memory/hindsight, etc.
  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const body = bodyResult as Record<string, unknown>;

  try {
    const { action } = body as { action?: string };

    switch (action) {
      case "dispatch":
        return await handleDispatchMission(body);
      case "promote":
        return await handlePromoteMission(body);
      case "update":
        return handleUpdateMission(body);
      case "cancel":
        return handleCancelMission(body);
      case "delete":
        return handleDeleteMission(body);
      default:
        return badRequest(`Unknown action: ${action}`);
    }
  } catch (error) {
    return serverErrorFromCatch("POST /api/missions", "processing request", error, "Internal server error");
  }
}
