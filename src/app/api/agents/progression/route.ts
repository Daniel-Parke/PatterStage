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
// Read-only by construction. The table's write path is the dashboard capture,
// and migration 031 refuses UPDATE and DELETE at the database, so there is no
// mutating verb for this route to expose.
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import {
  readAgentProgressionHistory,
  readLatestAgentProgressionSnapshots,
} from "@/lib/stats/agent-progression-repository";

export async function GET(request: NextRequest) {
  try {
    ensureDb();
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
