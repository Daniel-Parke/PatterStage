// ═══════════════════════════════════════════════════════════════
// composer/scheduler/composer-tick.ts — drive Composer on the background loop
//
// A SyncSource registered on the BackgroundScheduler (alongside RunSync +
// ScheduleTickSource): each tick advances active Composer runs (start pending,
// backstop in-flight, resume after gates). Gated by the scheduling lease + the
// `composer` feature flag (the tick itself short-circuits when disabled).
// ═══════════════════════════════════════════════════════════════

import type { SyncSource, SyncResult } from "@/lib/sync/types";
import { composerTick } from "../engine";

export class ComposerTickSource implements SyncSource {
  readonly name = "composer";
  constructor(private readonly isOwner: () => boolean) {}

  async sync(): Promise<SyncResult> {
    const { advanced } = await composerTick({ isOwner: this.isOwner() });
    return { sourceName: this.name, success: true, syncedCount: advanced, durationMs: 0 };
  }
}
