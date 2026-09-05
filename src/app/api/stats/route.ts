// ═══════════════════════════════════════════════════════════════
// GET /api/stats — dashboard + gamification stats
//
// One read-only aggregate over the PatterStage DB. Powers the command-center
// dashboard (vitals, throughput, activity heatmap, streak/level, achievements).
//
// It also CAPTURES, which is the one thing here that is not a read, so it is
// worth saying why it lives on this route and not on one of its own.
//
// This aggregate is the only place in the product that computes both halves of
// an agent's progression at once: `agents[]` carries every profile's measured
// performance and `achievements[]` carries the evaluated achievement list. The
// per-Body record (WG-ARCH-003) is exactly those two things stored, so recording
// them here costs one small SELECT plus one cheap active-days read per profile,
// while computing them anywhere else would mean a second full scan of `runs`.
//
// The capture appends a row only when an agent's answer has actually moved, so
// the dashboard's 20-second poll writes nothing in the steady state, and a
// failure to capture is logged and swallowed: the dashboard must not go dark
// because bookkeeping failed.
//
// The quest latch is the second write, and it is here for the same reason: the
// quest programme is evaluated inside this same aggregate, and what it finds
// complete has to outlive the retention of the events it was derived from. It
// too writes only when something has moved, and it too fails quietly.
// ═══════════════════════════════════════════════════════════════

import { logApiError, serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { isReadOnly } from "@/lib/read-only";
import * as questLatch from "@/lib/quests/quest-latch";
import { getDashboardStats } from "@/lib/stats/stats-repository";
import { captureAgentProgressionSnapshots } from "@/lib/stats/agent-progression";

export async function GET() {
  try {
    ensureDb();
    const stats = getDashboardStats();
    // check-read-only-guards-disable-next-line -- this GET appends a progression snapshot and latches quest completions, which are writes; under PS_READ_ONLY the read is served and the bookkeeping is skipped (T-0095, D124; B17)
    if (!isReadOnly()) {
      try {
        captureAgentProgressionSnapshots({
          agents: stats.agents,
          achievements: stats.achievements,
        });
      } catch (error) {
        logApiError("GET /api/stats", "capturing agent progression", error);
      }
      // Its own try: a progression capture that fails must not cost the
      // operator a quest they finished, and vice versa.
      try {
        if (stats.quests.latchChanged) questLatch.writeQuestCompletions(stats.quests.nextCompletedAt);
      } catch (error) {
        logApiError("GET /api/stats", "latching quest completions", error);
      }
    }
    return ok({ stats });
  } catch (error) {
    return serverErrorFromCatch("GET /api/stats", "", error, "Failed to load stats");
  }
}
