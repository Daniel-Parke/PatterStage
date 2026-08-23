/** @jest-environment node */
//
// /api/logs has always returned every file's mtime and the viewer discarded
// all of it, so a log that stopped being written three days ago looked
// exactly like one being appended to right now.

import { LOG_LIVE_WITHIN_MS, formatLogAge, isLogLive } from "@/lib/log-freshness";

const NOW = Date.parse("2026-08-23T12:00:00.000Z");
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe("formatLogAge", () => {
  it("resolves seconds, which is the whole point on a 5s poll", () => {
    expect(formatLogAge(at(0), NOW)).toBe("0s");
    expect(formatLogAge(at(4_000), NOW)).toBe("4s");
    expect(formatLogAge(at(59_000), NOW)).toBe("59s");
  });

  it("steps up to minutes, hours and days", () => {
    expect(formatLogAge(at(90_000), NOW)).toBe("1m");
    expect(formatLogAge(at(3 * 3_600_000), NOW)).toBe("3h");
    expect(formatLogAge(at(50 * 3_600_000), NOW)).toBe("2d");
  });

  it("returns null when there is no readable mtime, so the caller omits the phrase", () => {
    expect(formatLogAge(null, NOW)).toBeNull();
    expect(formatLogAge(undefined, NOW)).toBeNull();
    expect(formatLogAge("", NOW)).toBeNull();
    expect(formatLogAge("nonsense", NOW)).toBeNull();
  });

  it("clamps a future mtime instead of rendering a negative age", () => {
    expect(formatLogAge(at(-30_000), NOW)).toBe("0s");
  });
});

describe("isLogLive", () => {
  it("marks only files written inside the live window", () => {
    expect(isLogLive(at(1_000), NOW)).toBe(true);
    expect(isLogLive(at(LOG_LIVE_WITHIN_MS - 1), NOW)).toBe(true);
    expect(isLogLive(at(LOG_LIVE_WITHIN_MS), NOW)).toBe(false);
    expect(isLogLive(at(86_400_000), NOW)).toBe(false);
  });

  it("does not claim an unknown mtime is live", () => {
    expect(isLogLive(null, NOW)).toBe(false);
    expect(isLogLive("nonsense", NOW)).toBe(false);
  });
});
