// Unit tests for the optional `now` parameter on timeAgo, timeUntil, and
// formatElapsed (src/lib/utils.ts).
//
// The `now` param was added so the cron-row-caption helper (and any
// future render loop that wants a stable "now" across many calls) can
// reuse the public formatters without re-implementing them.

import { timeAgo, timeUntil, formatElapsed } from "@/lib/utils";

const NOW = new Date("2026-06-02T12:00:00Z").getTime();

describe("timeAgo(now)", () => {
  it("returns 'never' for null", () => {
    expect(timeAgo(null, NOW)).toBe("never");
  });

  it("formats minutes-ago deterministically when `now` is supplied", () => {
    const fiveMinAgo = new Date(NOW - 5 * 60_000).toISOString();
    expect(timeAgo(fiveMinAgo, NOW)).toBe("5m ago");
  });

  it("formats hours-ago deterministically when `now` is supplied", () => {
    const twoHoursAgo = new Date(NOW - 2 * 60 * 60_000).toISOString();
    expect(timeAgo(twoHoursAgo, NOW)).toBe("2h ago");
  });

  it("formats days-ago deterministically when `now` is supplied", () => {
    const threeDaysAgo = new Date(NOW - 3 * 24 * 60 * 60_000).toISOString();
    expect(timeAgo(threeDaysAgo, NOW)).toBe("3d ago");
  });

  it("returns 'never' for unparseable input (regardless of `now`)", () => {
    expect(timeAgo("not-a-date", NOW)).toBe("never");
  });

  it("returns 'never' when `now` is before the timestamp (negative diff)", () => {
    const future = new Date(NOW + 5 * 60_000).toISOString();
    expect(timeAgo(future, NOW)).toBe("never");
  });

  it("still works when `now` is omitted (defaults to Date.now())", () => {
    const just = new Date().toISOString();
    expect(timeAgo(just)).toBe("just now");
  });
});

describe("timeUntil(now)", () => {
  it("returns '—' for null", () => {
    expect(timeUntil(null, NOW)).toBe("—");
  });

  it("formats future minutes deterministically when `now` is supplied", () => {
    const tenMinFromNow = new Date(NOW + 10 * 60_000).toISOString();
    expect(timeUntil(tenMinFromNow, NOW)).toBe("10m");
  });

  it("formats future hours-with-minutes deterministically when `now` is supplied", () => {
    const twoHoursFiveMinFromNow = new Date(NOW + (2 * 60 + 5) * 60_000).toISOString();
    expect(timeUntil(twoHoursFiveMinFromNow, NOW)).toBe("2h 5m");
  });

  it("returns 'overdue' when `now` is after the timestamp", () => {
    const past = new Date(NOW - 1 * 60_000).toISOString();
    expect(timeUntil(past, NOW)).toBe("overdue");
  });

  it("returns '< 1m' for sub-minute future times", () => {
    // 1s ahead — well under the 1-minute round-up threshold.
    const soon = new Date(NOW + 1_000).toISOString();
    expect(timeUntil(soon, NOW)).toBe("< 1m");
  });

  it("still works when `now` is omitted (defaults to Date.now())", () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    expect(timeUntil(future)).toBe("10m");
  });
});

describe("formatElapsed(now)", () => {
  it("returns '' for unparseable input", () => {
    expect(formatElapsed("not-a-date", NOW)).toBe("");
  });

  it("returns '0s' for a startedAt equal to now", () => {
    const sameAsNow = new Date(NOW).toISOString();
    expect(formatElapsed(sameAsNow, NOW)).toBe("0s");
  });

  it("returns '30s' for 30 seconds in the past", () => {
    const past = new Date(NOW - 30_000).toISOString();
    expect(formatElapsed(past, NOW)).toBe("30s");
  });

  it("returns '5m 30s' for 5 minutes 30 seconds in the past", () => {
    const past = new Date(NOW - (5 * 60 + 30) * 1000).toISOString();
    expect(formatElapsed(past, NOW)).toBe("5m 30s");
  });

  it("returns '1h 5m' for 1 hour 5 minutes in the past", () => {
    const past = new Date(NOW - (1 * 60 + 5) * 60 * 1000).toISOString();
    expect(formatElapsed(past, NOW)).toBe("1h 5m");
  });

  it("still works when `now` is omitted (defaults to Date.now())", () => {
    const past = new Date(Date.now() - 30_000).toISOString();
    expect(formatElapsed(past)).toBe("30s");
  });
});
