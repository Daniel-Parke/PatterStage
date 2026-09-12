// ═══════════════════════════════════════════════════════════════
// orchestration/RunSync.ts — SyncSource that reconciles active runs
//
// Replaces sync/sources/MissionSync.ts. Runs on the BackgroundScheduler's
// tick, inheriting its per-source timeout + event-loop-yield robustness.
// ═══════════════════════════════════════════════════════════════

import type { SyncSource, SyncResult } from "@/lib/sync/types";
import { reconcileActiveRuns } from "./run-reconcile";

export class RunSync implements SyncSource {
  readonly name = "runs";

  async sync(): Promise<SyncResult> {
    const advanced = await reconcileActiveRuns();
    return {
      sourceName: this.name,
      success: true,
      syncedCount: advanced,
      durationMs: 0,
    };
  }
}
