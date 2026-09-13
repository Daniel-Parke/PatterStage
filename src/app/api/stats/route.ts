// ═══════════════════════════════════════════════════════════════
// GET /api/stats — dashboard + gamification stats
//
// One read-only aggregate over the DB for the dashboard. It also CAPTURES,
// which is why the writes live on this route: it is the only place that
// computes both halves of an agent's progression at once (`agents[]` and
// `achievements[]`), which is exactly the per-Body record WG-ARCH-003 stores,
// so recording here costs one small SELECT per profile where anywhere else
// would rescan `runs`. The capture appends only when an answer has moved, so
// the 20-second poll writes nothing in the steady state, and a failure is
// logged and swallowed: the dashboard must not go dark because bookkeeping
// failed. The quest latch is here for the same reason: what the programme finds
// complete has to outlive the retention of the events it was derived from.
// ═══════════════════════════════════════════════════════════════

import { logApiError } from "@/lib/api/api-logger";
import { ok } from "@/lib/api/api-response";
import { ensureDb } from "@/lib/db";
import { isReadOnly } from "@/lib/api/read-only";
import * as questLatch from "@/lib/quests/quest-latch";
import { getDashboardStats } from "@/lib/stats/stats-repository";
import { captureAgentProgressionSnapshots } from "@/lib/stats/agent-progression";
import { route } from "@/lib/api/api-route";

export const GET = route("GET /api/stats", "", "Failed to load stats", async () => {
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
});
