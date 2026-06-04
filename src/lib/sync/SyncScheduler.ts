// ═══════════════════════════════════════════════════════════════
// sync/SyncScheduler.ts — Background sync scheduler
//
// Runs registered SyncSource adapters on a configurable interval.
// Each source is independent — failures in one don't affect others.
// Staleness budget is enforced per-source: if a source's data is
// within its freshness window, the sync is skipped.
//
// Concurrency model:
//   - runAll() yields to the event loop between sources via setImmediate,
//     so even if one source is synchronously slow, the next source's
//     turn waits for a clean event-loop tick.
//   - Each source.sync() is raced against a per-source timeout
//     (DEFAULT_SOURCE_TIMEOUT_MS). A source that hangs in a tight
//     synchronous loop cannot block the scheduler forever — the
//     timeout fires, the source's promise is decoupled, and the
//     scheduler moves on. The source's tight loop will still hold
//     the main thread, but the scheduler has done its job of giving
//     other code a chance to run before the next source started.
//   - Per-source "running" set tracks in-flight sources so the
//     /api/sync endpoint can report liveness.
//
// Why this matters: the old implementation ran sources serially in a
// for-loop with await. A source that did a 5GB readFileSync blocked
// the event loop until completion. Combined with the 15s tick, this
// meant the scheduler could fall behind, and any HTTP request
// during a sync would time out. The 2026-06-01 outage (server
// wedged for 20+ hours) was triggered by exactly this class of bug.
// ═══════════════════════════════════════════════════════════════

import { messageFromError } from "@/lib/api-fetch";
import type { SyncSource, SyncResult, SyncCycleResult } from "./types";

// ── Constants ────────────────────────────────────────────────

const DEFAULT_TICK_MS = 15_000; // 15 seconds

/**
 * Per-source hard timeout. If a source's sync() doesn't resolve within
 * this window, we treat it as failed and move on. The source's actual
 * synchronous work may continue in the background — but at least the
 * scheduler and other sources are not blocked behind it.
 */
const DEFAULT_SOURCE_TIMEOUT_MS = 30_000;

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
  missions: 15_000,
  "mission-queue": 15_000,
};

/** Yield to the event loop so other I/O can be processed. */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** Race a promise against a timeout. The original promise is not
 *  cancelled (we can't cancel synchronous code in JS), but the
 *  returned promise resolves to a timeout error after `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`SyncSource "${label}" timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// ── SyncScheduler ────────────────────────────────────────────

export class SyncScheduler {
  private sources: Map<string, SyncSource> = new Map();
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private tickMs: number;
  private stalenessMs: Record<string, number>;
  private sourceTimeoutMs: number;
  private lastSyncTime: Map<string, number> = new Map();
  private lastCycleResult: SyncCycleResult | null = null;

  /** Names of sources currently executing (started but not yet resolved).
   *  Exposed via getRunningSources() so /api/sync can report which sources
   *  are stuck. */
  private runningSources: Set<string> = new Set();

  /** Per-source error state from the most recent sync. Sources that
   *  timed out or threw are recorded here so /api/sync can surface them. */
  private lastErrorBySource: Map<string, string> = new Map();

  constructor(
    tickMs?: number,
    stalenessOverrides?: Record<string, number>,
    sourceTimeoutMs?: number,
  ) {
    this.tickMs = tickMs ?? DEFAULT_TICK_MS;
    this.stalenessMs = { ...DEFAULT_STALENESS_MS, ...stalenessOverrides };
    this.sourceTimeoutMs = sourceTimeoutMs ?? DEFAULT_SOURCE_TIMEOUT_MS;
  }

  /** Register a sync source. Idempotent — re-registering overwrites. */
  register(source: SyncSource): void {
    this.sources.set(source.name, source);
  }

  /** Start the background sync loop. Safe to call multiple times. */
  start(): void {
    if (this.timer) return;
    // Run once immediately on start
    void this.runAll();
    this.timer = setInterval(() => {
      void this.runAll();
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

  /** Names of sources currently executing. Empty between cycles. */
  getRunningSources(): string[] {
    return Array.from(this.runningSources);
  }

  /** Per-source error state from the most recent sync cycle. */
  getLastErrorBySource(): Record<string, string> {
    return Object.fromEntries(this.lastErrorBySource);
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

    try {
      const sourceList = Array.from(this.sources.values());
      for (const source of sourceList) {
        // Yield to event loop between sources so other I/O can be
        // processed even if the previous source was synchronous and slow.
        await yieldToEventLoop();

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

        // Track in-flight state so /api/sync can report liveness.
        this.runningSources.add(source.name);
        const sourceStart = performance.now();
        try {
          const result = await withTimeout(
            Promise.resolve().then(() => source.sync()),
            this.sourceTimeoutMs,
            source.name,
          );
          this.lastSyncTime.set(source.name, Date.now());
          this.lastErrorBySource.delete(source.name);
          results.push(result);
        } catch (err) {
          this.lastSyncTime.set(source.name, Date.now());
          const msg = messageFromError(err, "");
          this.lastErrorBySource.set(source.name, msg);
          results.push({
            sourceName: source.name,
            success: false,
            syncedCount: 0,
            error: msg,
            durationMs: Math.round(performance.now() - sourceStart),
          });
        } finally {
          this.runningSources.delete(source.name);
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
      return cycleResult;
    } finally {
      this.running = false;
    }
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
    this.runningSources.add(name);
    try {
      const result = await withTimeout(
        Promise.resolve().then(() => source.sync()),
        this.sourceTimeoutMs,
        name,
      );
      this.lastSyncTime.set(name, Date.now());
      this.lastErrorBySource.delete(name);
      return result;
    } catch (err) {
      this.lastSyncTime.set(name, Date.now());
      const msg = messageFromError(err, "");
      this.lastErrorBySource.set(name, msg);
      return {
        sourceName: name,
        success: false,
        syncedCount: 0,
        error: msg,
        durationMs: 0,
      };
    } finally {
      this.runningSources.delete(name);
    }
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
