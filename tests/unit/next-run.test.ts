/** @jest-environment node */

/**
 * Tests for the dependency-free next-fire-time math used by the Control
 * Hub-owned scheduler (src/lib/schedule/next-run.ts). Pure functions — no DB.
 *
 * Cron is evaluated in the server's local timezone (cron convention), so the
 * tests build `from` with local-time `new Date(y, m, d, …)` and assert on local
 * getHours/getMinutes/getDate rather than ISO strings — keeps them tz-robust.
 */

import { computeNextRun, nextCronAfter } from "@/lib/schedule/next-run";

describe("computeNextRun", () => {
  it("adds N minutes for an interval schedule", () => {
    const from = new Date("2026-06-15T10:00:00.000Z");
    const next = computeNextRun("every 30m", from);
    expect(next?.getTime()).toBe(from.getTime() + 30 * 60_000);
  });

  it("returns a future one-shot, and null for a past one-shot", () => {
    const from = new Date("2026-06-15T10:00:00.000Z");
    expect(computeNextRun("2099-01-01T00:00:00.000Z", from)?.toISOString()).toBe("2099-01-01T00:00:00.000Z");
    expect(computeNextRun("2000-01-01T00:00:00.000Z", from)).toBeNull();
  });

  it("returns the next matching minute for a cron schedule", () => {
    const from = new Date(2026, 5, 15, 10, 2, 0); // local
    const next = computeNextRun("*/5 * * * *", from)!;
    expect(next.getHours()).toBe(10);
    expect(next.getMinutes()).toBe(5);
  });

  it("returns null for an invalid schedule", () => {
    expect(computeNextRun("total garbage", new Date())).toBeNull();
  });
});

describe("nextCronAfter", () => {
  it("steps to the next */5 boundary strictly after `from`", () => {
    const next = nextCronAfter("*/5 * * * *", new Date(2026, 5, 15, 10, 2))!;
    expect(next.getMinutes()).toBe(5);
  });

  it("is strictly after `from` — never returns the same minute", () => {
    const at = new Date(2026, 5, 15, 10, 0, 0); // exactly on a */5 boundary
    const next = nextCronAfter("*/5 * * * *", at)!;
    expect(next.getTime()).toBeGreaterThan(at.getTime());
    expect(next.getMinutes()).toBe(5);
  });

  it("finds the next daily fire (rolls to the next day when past)", () => {
    // 09:30 daily, asked at 10:00 → tomorrow 09:30.
    const next = nextCronAfter("30 9 * * *", new Date(2026, 5, 15, 10, 0))!;
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(30);
  });

  it("matches the same day when `from` is before the daily fire", () => {
    const next = nextCronAfter("30 9 * * *", new Date(2026, 5, 15, 8, 0))!;
    expect(next.getDate()).toBe(15);
    expect(next.getHours()).toBe(9);
  });

  it("DOM/DOW are OR'd when BOTH are restricted (standard cron)", () => {
    // 1st of month OR Monday. June 16 2026 is a Tuesday; the next match
    // after June 15 (a Monday, but `from` is later in that day) is the
    // following Monday June 22, NOT the non-matching 16th–21st.
    const next = nextCronAfter("0 0 1 * 1", new Date(2026, 5, 15, 12, 0))!;
    const isFirst = next.getDate() === 1;
    const isMonday = next.getDay() === 1;
    expect(isFirst || isMonday).toBe(true);
  });

  it("returns null for an expression with fewer than 5 fields", () => {
    expect(nextCronAfter("0 9 *", new Date())).toBeNull();
  });
});
