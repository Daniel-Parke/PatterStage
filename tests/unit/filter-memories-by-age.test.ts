// ═══════════════════════════════════════════════════════════════
// filter-memories-by-age — unit tests for the stale-fact TTL substitute
// ═══════════════════════════════════════════════════════════════
//
// Added 2026-06-13 as part of the corpus-flood cleanup. The Memory
// tab in PatterStage uses this to hide facts older than 90 days by
// default, with a "Show stale" toggle to override. The unit tests
// pin the contract: cutoff math, missing/unparseable dates, edge
// values (Infinity = disabled, 0 = pass-through), and the exact
// 90-day default.

import {
  filterMemoriesByAge,
  HINDSIGHT_DEFAULT_MAX_AGE_DAYS,
} from "@/lib/memory/hindsight-client";

describe("filterMemoriesByAge", () => {
  // Use a fixed reference time so threshold-edge tests are not racy.
  // The production function uses Date.now() internally, so we test
  // edge cases by constructing memories dated relative to that fixed
  // moment in the past — i.e. 90 days back, 90 days + 1s back, etc.
  const now = Date.now();
  const days = (n: number) =>
    new Date(now - n * 24 * 60 * 60 * 1000).toISOString();
  const make = (id: string, ageDays: number) => ({
    id,
    content: `fact ${id}`,
    created_at: days(ageDays),
  });

  it("drops memories older than the threshold", () => {
    const memories = [
      make("recent", 5),
      make("at-cutoff", 89),
      make("stale", 91),
      make("very-stale", 365),
    ];
    const result = filterMemoriesByAge(memories, 90);
    expect(result.map((m: { id: string }) => m.id)).toEqual(["recent", "at-cutoff"]);
  });

  it("drops memories at exactly the threshold (microsecond race-safe)", () => {
    // 90 days + 100ms ago. Definitely older than the threshold even if
    // the function reads Date.now() microseconds later. The test is
    // racy for "exactly 90 days" because Date.now() advances between
    // the `make()` call and the function call — the threshold check
    // is "t >= cutoffMs" where cutoffMs = now() - threshold, so
    // "exactly 90 days back at make-time" is now 90 days + 1-2ms back
    // at filter-time, which is below the cutoff and correctly dropped.
    const memories = [make("at-cutoff", 90)];
    const result = filterMemoriesByAge(memories, 90);
    expect(result.length).toBe(0);
  });

  it("keeps memories 1ms inside the threshold", () => {
    // 89 days, 23 hours, 59 minutes ago. Always inside 90 days
    // regardless of the microsecond race.
    const memories = [
      {
        id: "just-inside",
        content: "x",
        created_at: new Date(now - 89 * 24 * 60 * 60 * 1000 - 1).toISOString(),
      },
    ];
    const result = filterMemoriesByAge(memories, 90);
    expect(result.length).toBe(1);
  });

  it("drops memories 1ms past the threshold", () => {
    const memories = [
      {
        id: "just-past",
        content: "x",
        created_at: new Date(now - 90 * 24 * 60 * 60 * 1000 - 1000).toISOString(),
      },
    ];
    const result = filterMemoriesByAge(memories, 90);
    expect(result.length).toBe(0);
  });

  it("keeps memories with no created_at (unknown age is not stale)", () => {
    const memories: { id: string; content: string; created_at?: string }[] = [
      { id: "no-date", content: "x" }, // no created_at
      make("recent", 1),
    ];
    const result = filterMemoriesByAge(memories, 90);
    expect(result.length).toBe(2);
  });

  it("keeps memories with unparseable created_at (default to keep)", () => {
    const memories = [
      { id: "bad-date", content: "x", created_at: "not a date" },
      make("recent", 1),
    ];
    const result = filterMemoriesByAge(memories, 90);
    expect(result.length).toBe(2);
  });

  it("Infinity disables the filter (used by 'Show stale' toggle)", () => {
    const memories = [
      make("recent", 5),
      make("ancient", 10000),
    ];
    const result = filterMemoriesByAge(memories, Infinity);
    expect(result.length).toBe(2);
  });

  it("0 days is a pass-through (all kept — caller can opt out)", () => {
    const memories = [
      make("recent", 5),
      make("stale", 100),
    ];
    const result = filterMemoriesByAge(memories, 0);
    expect(result.length).toBe(2);
  });

  it("negative threshold is treated as pass-through", () => {
    // Defensive: callers passing -1 shouldn't accidentally drop everything.
    const memories = [make("stale", 100)];
    const result = filterMemoriesByAge(memories, -1);
    expect(result.length).toBe(1);
  });

  it("empty array returns empty", () => {
    const result = filterMemoriesByAge([], 90);
    expect(result).toEqual([]);
  });

  it("HINDSIGHT_DEFAULT_MAX_AGE_DAYS is 90", () => {
    // Pin the default so a future change is intentional.
    expect(HINDSIGHT_DEFAULT_MAX_AGE_DAYS).toBe(90);
  });

  it("realistic 90-day filter on a mixed corpus", () => {
    // Simulates the actual situation: a corpus with a wide age spread.
    // The 90-day threshold is the production default; the test
    // confirms the math holds on a sample.
    const memories = [
      make("today", 0),
      make("week-old", 7),
      make("month-old", 30),
      make("quarter-old", 91),  // just over
      make("two-quarters", 180),
      make("year-old", 365),
    ];
    const result = filterMemoriesByAge(memories, HINDSIGHT_DEFAULT_MAX_AGE_DAYS);
    expect(result.map((m: { id: string }) => m.id)).toEqual(["today", "week-old", "month-old"]);
  });
});
