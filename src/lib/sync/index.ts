// ═══════════════════════════════════════════════════════════════
// sync/index.ts — Sync layer bootstrap
//
// Initializes the SyncScheduler singleton and registers all sources
// on first call to ensureSyncLayer(). The scheduler starts automatically
// when ensureSyncLayer() is called (typically on server boot).
// ═══════════════════════════════════════════════════════════════

import { SyncScheduler } from "./SyncScheduler";
import { SERVER_MODULES } from "@/lib/modules/server";
import type { SyncCycleResult } from "./types";
import { SessionSync } from "./sources/SessionSync";
import { EnvSync } from "./sources/EnvSync";
import { LogSync } from "./sources/LogSync";
import { ProcessSync } from "./sources/ProcessSync";
import { MemorySync } from "./sources/MemorySync";
import { MissionQueueSync } from "./sources/MissionQueueSync";

// ── Singleton ────────────────────────────────────────────────

let _scheduler: SyncScheduler | null = null;
let _initialized = false;

/** Get (or create) the global SyncScheduler instance. */
export function getSyncScheduler(): SyncScheduler {
  if (_scheduler) return _scheduler;
  _scheduler = new SyncScheduler();
  return _scheduler;
}

/**
 * Initialize the sync layer.
 * Registers all sources and starts the background sync loop.
 * Idempotent — safe to call multiple times.
 * Called from API routes or server initialization code.
 */
export function ensureSyncLayer(): void {
  if (_initialized) return;
  _initialized = true;

  const scheduler = getSyncScheduler();

  // Register all sync sources
  scheduler.register(new SessionSync());
  scheduler.register(new EnvSync());
  scheduler.register(new LogSync());
  scheduler.register(new ProcessSync());
  scheduler.register(new MemorySync());
  // Mission run reconciliation now lives in the orchestration BackgroundScheduler
  // (RunSync). MissionQueueSync still dispatches queued missions (via the runtime).
  scheduler.register(new MissionQueueSync());

  // Module-contributed sources. ConfigSync is the hermes module's: it parses a
  // Hermes config.yaml schema and probes SOUL.md, which is protocol knowledge
  // rather than a file path. The four above needed only paths, which
  // AgentWorkspace already gives them neutrally, so they stay core.
  for (const source of SERVER_MODULES.flatMap((m) => m.syncSources?.() ?? [])) {
    scheduler.register(source);
  }

  scheduler.start();
}

/** Run a full sync cycle immediately (for "Sync Now" button). */
export async function runFullSync(): Promise<SyncCycleResult> {
  const scheduler = getSyncScheduler();
  return scheduler.forceSync();
}
