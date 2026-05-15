// ═══════════════════════════════════════════════════════════════
// sync/SyncScheduler.ts — Background sync scheduler
//
// Runs registered SyncSource adapters on a configurable interval.
// Each source is independent — failures in one don't affect others.
// Staleness budget is enforced per-source: if a source's data is
// within its freshness window, the sync is skipped.
// ═══════════════════════════════════════════════════════════════

import type { SyncSource, SyncResult, SyncCycleResult } from "./types";

// ── Constants ────────────────────────────────────────────────

const DEFAULT_TICK_MS = 15_000; // 15 seconds

/**
 * Per-source staleness budget in milliseconds.
 * A source is skipped if it was last synced less than this many ms ago.
 */
const DEFAULT_STALENESS_MS: Record<string, number> = {
  cron: 30_000,
  sessions: 15_000,
  config: 60_000,
  env: 60_000,
  logs: 60_000,
  processes: 15_000,
  memory: 30_000,
};

// ── SyncScheduler ────────────────────────────────────────────

export class SyncScheduler {
  private sources: Map<string, SyncSource> = new Map();
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private tickMs: number;
  private stalenessMs: Record<string, number>;
  private lastSyncTime: Map<string, number> = new Map();
  private lastCycleResult: SyncCycleResult | null = null;

  constructor(tickMs?: number, stalenessOverrides?: Record<string, number>) {
    this.tickMs = tickMs ?? DEFAULT_TICK_MS;
    this.stalenessMs = { ...DEFAULT_STALENESS_MS, ...stalenessOverrides };
  }

  /** Register a sync source. Idempotent — re-registering overwrites. */
  register(source: SyncSource): void {
    this.sources.set(source.name, source);
  }

  /** Start the background sync loop. Safe to call multiple times. */
  start(): void {
    if (this.timer) return;
    // Run once immediately on start
    this.runAll().catch(() => { /* logged inside runAll */ });
    this.timer = setInterval(() => {
      this.runAll().catch(() => { /* logged inside runAll */ });
    }, this.tickMs);
  }

  /** Stop the background sync loop. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Whether the scheduler is actively running. */
  get isRunning(): boolean {
    return this.timer !== null;
  }

  /** Run all registered sync sources once. */
  async runAll(): Promise<SyncCycleResult> {
    if (this.running) {
      return {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        results: [],
        totalDurationMs: 0,
        allSuccessful: true,
      };
    }
    this.running = true;

    const startedAt = new Date().toISOString();
    const results: SyncResult[] = [];
    const overallStart = performance.now();

    const sourceList = Array.from(this.sources.values());
    for (const source of sourceList) {
      const staleness = this.stalenessMs[source.name] ?? 0;
      const lastSync = this.lastSyncTime.get(source.name) ?? 0;
      const age = Date.now() - lastSync;
      if (age < staleness) {
        // Skip — within freshness window
        results.push({
          sourceName: source.name,
          success: true,
          syncedCount: 0,
          durationMs: 0,
        });
        continue;
      }

      try {
        const result = await source.sync();
        this.lastSyncTime.set(source.name, Date.now());
        results.push(result);
      } catch (err) {
        this.lastSyncTime.set(source.name, Date.now());
        results.push({
          sourceName: source.name,
          success: false,
          syncedCount: 0,
          error: String(err),
          durationMs: 0,
        });
      }
    }

    const totalDurationMs = Math.round(performance.now() - overallStart);
    const allSuccessful = results.every((r) => r.success);

    const cycleResult: SyncCycleResult = {
      startedAt,
      completedAt: new Date().toISOString(),
      results,
      totalDurationMs,
      allSuccessful,
    };
    this.lastCycleResult = cycleResult;
    this.running = false;
    return cycleResult;
  }

  /** Run a single named source immediately. */
  async runOne(name: string): Promise<SyncResult> {
    const source = this.sources.get(name);
    if (!source) {
      return {
        sourceName: name,
        success: false,
        syncedCount: 0,
        error: `Unknown source: ${name}`,
        durationMs: 0,
      };
    }
    const result = await source.sync();
    this.lastSyncTime.set(name, Date.now());
    return result;
  }

  /** Force a full sync cycle, ignoring staleness budgets. */
  async forceSync(): Promise<SyncCycleResult> {
    // Clear staleness tracking so all sources run
    this.lastSyncTime.clear();
    return this.runAll();
  }

  /** Get the most recent cycle result. */
  getLastCycleResult(): SyncCycleResult | null {
    return this.lastCycleResult;
  }

  /** Get all registered source names. */
  getSourceNames(): string[] {
    return Array.from(this.sources.keys());
  }
}
