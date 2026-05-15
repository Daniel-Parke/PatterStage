// ═══════════════════════════════════════════════════════════════
// sync/index.ts — Sync layer bootstrap
//
// Initializes the SyncScheduler singleton and registers all sources
// on first call to ensureSyncLayer(). The scheduler starts automatically
// when ensureSyncLayer() is called (typically on server boot).
// ═══════════════════════════════════════════════════════════════

import { SyncScheduler } from "./SyncScheduler";
import type { SyncCycleResult } from "./types";
import { CronSync } from "./sources/CronSync";
import { SessionSync } from "./sources/SessionSync";
import { ConfigSync } from "./sources/ConfigSync";
import { EnvSync } from "./sources/EnvSync";
import { LogSync } from "./sources/LogSync";
import { ProcessSync } from "./sources/ProcessSync";
import { MemorySync } from "./sources/MemorySync";

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
  scheduler.register(new CronSync());
  scheduler.register(new SessionSync());
  scheduler.register(new ConfigSync());
  scheduler.register(new EnvSync());
  scheduler.register(new LogSync());
  scheduler.register(new ProcessSync());
  scheduler.register(new MemorySync());

  scheduler.start();
}

/** Run a full sync cycle immediately (for "Sync Now" button). */
export async function runFullSync(): Promise<SyncCycleResult> {
  const scheduler = getSyncScheduler();
  return scheduler.forceSync();
}

/** Get the current scheduler (for read-only access). */
export function getScheduler(): SyncScheduler | null {
  return _scheduler;
}

/** Check if sync layer has been initialized. */
export function isSyncLayerInitialized(): boolean {
  return _initialized;
}
