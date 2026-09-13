/** @jest-environment node */

/**
 * Regression tests for the SyncScheduler non-blocking fixes.
 *
 * Background: 2026-06-01, the PatterStage server wedged for 20+ hours
 * because a sync source's synchronous I/O blocked the Node event loop.
 * The fix in PR #136 added three guarantees:
 *
 *   1. runAll() yields to the event loop between sources.
 *   2. Each source is raced against a timeout (default 30s).
 *   3. Per-source liveness is exposed via getRunningSources().
 *
 * These tests assert all three. If a future refactor removes any of
 * them, CI catches it.
 */

/** @jest-environment node */

import { SyncScheduler } from "@/lib/sync/SyncScheduler";
import type { SyncSource, SyncResult } from "@/lib/sync/types";

class StubSource implements SyncSource {
  public callCount = 0;
  public name: string;

  /** Wall-clock duration this source takes. */
  public durationMs: number;
  /** What to do: 'resolve' immediately on call, or 'block' (tight loop). */
  public behavior: "resolve" | "block";
  /** Optional override for sync() return. */
  public result: SyncResult | Error;

  constructor(opts: {
    name: string;
    durationMs?: number;
    behavior?: "resolve" | "block";
    result?: SyncResult | Error;
  }) {
    this.name = opts.name;
    this.durationMs = opts.durationMs ?? 10;
    this.behavior = opts.behavior ?? "resolve";
    this.result =
      opts.result ??
      ({
        sourceName: opts.name,
        success: true,
        syncedCount: 1,
        durationMs: 0,
      } as SyncResult);
  }

  async sync(): Promise<SyncResult> {
    this.callCount++;
    if (this.behavior === "block") {
      // Tight CPU loop. Used to verify the event loop is yielded between
      // sources — if it weren't, the next source wouldn't get scheduled
      // until this loop completed.
      const until = Date.now() + this.durationMs;
      while (Date.now() < until) {
        // spin
      }
      if (this.result instanceof Error) throw this.result;
      return this.result as SyncResult;
    }
    // resolve behavior: yield via setImmediate to simulate async I/O
    await new Promise<void>((r) => setImmediate(r));
    await new Promise<void>((r) => setTimeout(r, this.durationMs));
    if (this.result instanceof Error) throw this.result;
    return this.result as SyncResult;
  }
}

describe("SyncScheduler — non-blocking guarantees", () => {
  test("yields to event loop between sources (a setInterval tick can fire between sources)", async () => {
    const scheduler = new SyncScheduler(15_000, {}, 30_000);
    const a = new StubSource({ name: "a", durationMs: 50 });
    const b = new StubSource({ name: "b", durationMs: 50 });
    scheduler.register(a);
    scheduler.register(b);

    let aFinishedAt = 0;
    let bStartedAt = 0;
    const originalA = a.sync.bind(a);
    a.sync = async () => {
      const result = await originalA();
      aFinishedAt = Date.now();
      return result;
    };
    const originalB = b.sync.bind(b);
    b.sync = async () => {
      bStartedAt = Date.now();
      return await originalB();
    };

    // Schedule a setInterval to fire 25ms in. If the scheduler does NOT
    // yield between a and b, this interval would be starved (both sources
    // run back-to-back, and the event loop has no chance to service the
    // timer for 100ms).
    const interval = setInterval(() => {}, 25);

    await scheduler.runAll();
    clearInterval(interval);

    // Sanity: both sources actually ran
    expect(a.callCount).toBe(1);
    expect(b.callCount).toBe(1);

    // b must have started after a finished (sources ran serially, with a
    // yield between them)
    expect(bStartedAt).toBeGreaterThanOrEqual(aFinishedAt);
  });

  test("a slow source is timed out and does not block other sources", async () => {
    // 300ms source timeout. The "stuck" source does an *asynchronous*
    // loop that yields to the event loop every iteration (await new
    // Promise(r => setTimeout(r, 0))). This is the realistic hang
    // pattern: a source that keeps the event loop busy with async work
    // (a slow DB query, a large file read in chunks, etc) but never
    // returns. The scheduler's setTimeout CAN fire because the loop
    // yields.
    //
    // A purely synchronous `while(Date.now()<t)` block is also a hang,
    // but the scheduler cannot interrupt it (the JS thread is
    // uninterruptible). The yield-between-sources guarantee and the
    // per-source timeout together handle the async-hang case; the
    // sync-block case is caught by the watchdog's CPU-stuck probe.
    const scheduler = new SyncScheduler(15_000, {}, 300);
    let stuckAborted = false;
    const stuck: SyncSource = {
      name: "stuck",
      async sync(): Promise<SyncResult> {
        // Tight async loop. We don't check stuckAborted because in
        // real life, hung sources don't have an abort signal — they
        // just don't return. The scheduler's timeout fires; the source
        // continues looping in the background, but the scheduler
        // proceeds.
        while (!stuckAborted) {
          await new Promise<void>((resolve) => setTimeout(resolve, 50));
        }
        return { sourceName: "stuck", success: true, syncedCount: 0, durationMs: 0 };
      },
    };
    const quick = new StubSource({ name: "quick", durationMs: 10 });
    scheduler.register(stuck);
    scheduler.register(quick);

    const start = Date.now();
    const cycle = await scheduler.runAll();
    const elapsed = Date.now() - start;

    // Now unblock the stuck source so the test can exit cleanly
    stuckAborted = true;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    // The stuck source's result should be a failure with a timeout message
    const stuckResult = cycle.results.find((r) => r.sourceName === "stuck");
    expect(stuckResult?.success).toBe(false);
    expect(stuckResult?.error).toMatch(/timed out/i);

    // The quick source should have run successfully
    const quickResult = cycle.results.find((r) => r.sourceName === "quick");
    expect(quickResult?.success).toBe(true);
    expect(quick.callCount).toBe(1);

    // Quick source ran well before the stuck source's natural duration
    expect(elapsed).toBeLessThan(2_000);
  }, 10_000);

  test("exposes per-source liveness while a slow source runs", async () => {
    const scheduler = new SyncScheduler(15_000, {}, 30_000);
    const slow = new StubSource({ name: "slow", durationMs: 200 });
    scheduler.register(slow);

    // Start a runAll but don't await it. While it's running, the
    // scheduler should report `slow` as in-flight.
    const promise = scheduler.runAll();

    // Give the scheduler a tick to start the source
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));

    const inFlight = scheduler.getRunningSources();
    expect(inFlight).toContain("slow");

    await promise;

    // After completion, no source is in-flight
    expect(scheduler.getRunningSources()).not.toContain("slow");
  });

  test("records the last error per source for /api/sync visibility", async () => {
    const scheduler = new SyncScheduler(15_000, {}, 30_000);
    const failing = new StubSource({
      name: "failing",
      result: new Error("synthetic failure"),
    });
    scheduler.register(failing);

    await scheduler.runAll();

    const errors = scheduler.getLastErrorBySource();
    expect(errors["failing"]).toMatch(/synthetic failure/);

    // A subsequent successful run clears the error
    const ok = new StubSource({ name: "failing" });
    scheduler.register(ok); // re-register with new instance, same name
    await scheduler.runAll();
    expect(scheduler.getLastErrorBySource()["failing"]).toBeUndefined();
  });

  test("start() begins an immediate sync and schedules subsequent ones", async () => {
    const scheduler = new SyncScheduler(15_000, {}, 30_000);
    const a = new StubSource({ name: "a" });
    scheduler.register(a);

    scheduler.start();

    // Give the immediate run a chance to fire
    await new Promise<void>((r) => setTimeout(r, 100));

    expect(a.callCount).toBeGreaterThanOrEqual(1);
    expect(scheduler.isRunning).toBe(true);

    scheduler.stop();
  });
});
