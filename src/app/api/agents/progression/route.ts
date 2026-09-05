// ═══════════════════════════════════════════════════════════════
// GET /api/agents/progression — the recorded per-Body growth
//
// The read side of WG-ARCH-003. `/api/agents/experience` answers "what is this
// agent now", recomputed from history every time it is asked. This answers "what
// was recorded, and when", from rows that no prune can rewrite.
//
// Without a slug it returns the newest row for every profile. With `?slug=` it
// returns that profile's whole trail, oldest first, which is the read the
// append-only design exists for: after the events behind a level have been
// deleted, the trail is the only thing left that can say the level was reached.
//
// It captures on the way past, before reading. That is not a mutating verb: it
// is the same lazy correction the dashboard poll performs, and it exists here
// because the capture used to happen ONLY inside GET /api/stats -- so an
// install driven over HTTP never captured anything and this endpoint answered
// with rows nobody had written, while the spend figures beside it read live
// (T-0081, RC-A). Migration 031 still refuses UPDATE and DELETE at the
// database, so nothing here can rewrite what was recorded.
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from "next/server";

import { logApiError, serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import {
  readAgentProgressionHistory,
  readLatestAgentProgressionSnapshots,
} from "@/lib/stats/agent-progression-repository";
import { captureAgentProgressionFromLiveStats } from "@/lib/stats/agent-progression";

export async function GET(request: NextRequest) {
  try {
    ensureDb();
    // Before the read, so the very first caller -- the one who has never opened
    // the dashboard, which is exactly the reported case -- sees something.
    // Guarded and logged the same way GET /api/stats guards its capture: the
    // stored rows are the answer this endpoint owes, and the capture is a
    // courtesy performed on the way past.
    try {
      captureAgentProgressionFromLiveStats();
    } catch (error) {
      logApiError("GET /api/agents/progression", "capturing agent progression", error);
    }
    const slug = request.nextUrl.searchParams.get("slug");
    const snapshots = slug
      ? readAgentProgressionHistory(slug)
      : readLatestAgentProgressionSnapshots();
    return ok({ slug: slug ?? null, snapshots });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/agents/progression",
      "reading recorded agent progression",
      error,
      "Failed to load agent progression",
    );
  }
}
