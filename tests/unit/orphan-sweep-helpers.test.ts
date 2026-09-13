/** @jest-environment node */

/**
 * Tests for the pure helpers extracted from `closeOrphanedActiveSessions`
 * and `previewOrphanSweep` in `src/lib/sessions/session-repository.ts`:
 *
 *   - `computeOrphanCutoffs(now?)` — derives the 5-min and 30-min cutoffs
 *     from a single `now` so the dry-run SELECT and the write UPDATE
 *     always see the same point-in-time.
 *   - `tallyOrphanRows(rows, counters)` — mutates an `OrphanSweepResult`
 *     counter object from an array of `{ source, status }` rows.
 *
 * The end-to-end behaviour is covered by `close-orphaned-sessions.test.ts`
 * (the parity test that asserts `preview === actual`). This file pins
 * the helpers' contract independently so a future regression in the
 * counter shape (e.g. someone "fixing" `byNewStatus["completed"]` to a
 * constant) surfaces here first, with a clear message.
 */

import {
  computeOrphanCutoffs,
  tallyOrphanRows,
  type OrphanSweepResult,
} from "@/lib/sessions/session-orphan-sweep";

describe("computeOrphanCutoffs", () => {
  it("returns shortCutoff = now - 5min and longCutoff = now - 30min (ISO-8601)", () => {
    const now = Date.parse("2026-06-14T12:00:00.000Z");
    const out = computeOrphanCutoffs(now);

    expect(out.shortCutoff).toBe("2026-06-14T11:55:00.000Z");
    expect(out.longCutoff).toBe("2026-06-14T11:30:00.000Z");
  });

  it("uses Date.now() when no `now` argument is supplied (default)", () => {
    const before = Date.now();
    const out = computeOrphanCutoffs();
    const after = Date.now();

    const shortMs = Date.parse(out.shortCutoff);
    const longMs = Date.parse(out.longCutoff);

    // shortCutoff should be ~5 min before `before`/`after`; the assertion
    // bounds are 5 min ± 1 second to absorb ms-level execution overhead.
    expect(shortMs).toBeGreaterThanOrEqual(before - 5 * 60 * 1000 - 1000);
    expect(shortMs).toBeLessThanOrEqual(after - 5 * 60 * 1000 + 1000);
    expect(longMs).toBeGreaterThanOrEqual(before - 30 * 60 * 1000 - 1000);
    expect(longMs).toBeLessThanOrEqual(after - 30 * 60 * 1000 + 1000);
  });

  it("shortCutoff is always exactly 25 minutes more recent than longCutoff", () => {
    // The two cutoffs must be 25 min apart by construction
    // (5 min short - 30 min long = -25 min; longCutoff is 25 min older).
    // This invariant is what makes the (A) and (B) tracks
    // independent gate windows — verify it directly.
    const now = Date.parse("2026-06-14T12:00:00.000Z");
    const out = computeOrphanCutoffs(now);

    const shortMs = Date.parse(out.shortCutoff);
    const longMs = Date.parse(out.longCutoff);
    expect(shortMs - longMs).toBe(25 * 60 * 1000);
  });
});

describe("tallyOrphanRows", () => {
  // Fresh empty counter for each test — mirrors the per-call init
  // pattern used in the real `previewOrphanSweep` and
  // `closeOrphanedActiveSessions` functions.
  function makeCounters(): OrphanSweepResult {
    return { total: 0, bySource: {}, byNewStatus: {} };
  }

  it("tallies a single row into total + bySource + byNewStatus", () => {
    const counters = makeCounters();
    tallyOrphanRows([{ source: "mission", status: "completed" }], counters);

    expect(counters.total).toBe(1);
    expect(counters.bySource).toEqual({ mission: 1 });
    expect(counters.byNewStatus).toEqual({ completed: 1 });
  });

  it("aggregates multiple rows with the same source + status", () => {
    const counters = makeCounters();
    tallyOrphanRows(
      [
        { source: "mission", status: "completed" },
        { source: "mission", status: "completed" },
        { source: "mission", status: "completed" },
      ],
      counters,
    );

    expect(counters.total).toBe(3);
    expect(counters.bySource).toEqual({ mission: 3 });
    expect(counters.byNewStatus).toEqual({ completed: 3 });
  });

  it("separates bySource from byNewStatus (one is a row attribute, not a sum)", () => {
    // 2 mission+completed + 1 cron+completed + 1 mission+failed = 4 total
    // bySource = {mission: 3, cron: 1}; byNewStatus = {completed: 3, failed: 1}
    const counters = makeCounters();
    tallyOrphanRows(
      [
        { source: "mission", status: "completed" },
        { source: "cron", status: "completed" },
        { source: "mission", status: "completed" },
        { source: "mission", status: "failed" },
      ],
      counters,
    );

    expect(counters.total).toBe(4);
    expect(counters.bySource).toEqual({ mission: 3, cron: 1 });
    expect(counters.byNewStatus).toEqual({ completed: 3, failed: 1 });
  });

  it("is a no-op on an empty row array (counters remain at zero)", () => {
    const counters = makeCounters();
    tallyOrphanRows([], counters);

    expect(counters.total).toBe(0);
    expect(counters.bySource).toEqual({});
    expect(counters.byNewStatus).toEqual({});
  });

  it("mutates the counters object in place (does not return a new one)", () => {
    // Confirms the `tally` verb in the JSDoc — the caller's `counters`
    // object is the one that gets updated, not a returned replacement.
    // The pre-extraction inline form had the same behaviour (3 inline
    // mutations to `total`, `bySource`, `byNewStatus`); the refactor
    // preserves it.
    const counters = makeCounters();
    const result = tallyOrphanRows(
      [{ source: "cli", status: "completed" }],
      counters,
    );

    expect(result).toBeUndefined();
    expect(counters.total).toBe(1);
  });

  it("accumulates across multiple invocations on the same counter (additive)", () => {
    // The real `previewOrphanSweep` and `closeOrphanedActiveSessions`
    // each call `tallyOrphanRows` twice (once per (A)/(B) track) on the
    // same counter object. Verify the helper is additive.
    const counters = makeCounters();
    tallyOrphanRows(
      [{ source: "mission", status: "completed" }],
      counters,
    );
    tallyOrphanRows(
      [
        { source: "cli", status: "completed" },
        { source: "api", status: "completed" },
      ],
      counters,
    );

    expect(counters.total).toBe(3);
    expect(counters.bySource).toEqual({ mission: 1, cli: 1, api: 1 });
    expect(counters.byNewStatus).toEqual({ completed: 3 });
  });
});
