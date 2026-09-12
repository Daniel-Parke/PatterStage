/** @jest-environment node */

/**
 * Tests for the schedule-string parser used by the PatterStage-owned
 * scheduler (src/lib/schedule/parse-schedule.ts). Pure functions — no DB.
 */

import {
  parseSchedule,
  looksLikeCronExpression,
  intervalShorthandToCron,
  scheduleDisplayFromParsed,
} from "@/lib/schedule/parse-schedule";

describe("parseSchedule", () => {
  it("parses 'every Nm/Nh/Nd' interval shorthand to minutes", () => {
    expect(parseSchedule("every 30m")).toEqual({ kind: "interval", minutes: 30, display: "every 30m" });
    expect(parseSchedule("every 2h")).toEqual({ kind: "interval", minutes: 120, display: "every 120m" });
    expect(parseSchedule("every 1d")).toEqual({ kind: "interval", minutes: 1440, display: "every 1440m" });
  });

  it("accepts the interval forms without the 'every' prefix", () => {
    expect(parseSchedule("45m")).toEqual({ kind: "interval", minutes: 45, display: "every 45m" });
    expect(parseSchedule("3h")).toEqual({ kind: "interval", minutes: 180, display: "every 180m" });
  });

  it("classifies a 5-field cron expression", () => {
    expect(parseSchedule("*/5 * * * *")).toEqual({ kind: "cron", expr: "*/5 * * * *", display: "*/5 * * * *" });
    expect(parseSchedule("0 9 * * 1")).toEqual({ kind: "cron", expr: "0 9 * * 1", display: "0 9 * * 1" });
  });

  it("classifies an ISO one-shot timestamp", () => {
    const iso = "2026-06-15T09:00:00Z";
    expect(parseSchedule(iso)).toEqual({ kind: "once", run_at: iso, display: iso });
  });

  it("returns invalid for empty / garbage / non-string input", () => {
    expect(parseSchedule("").kind).toBe("invalid");
    expect(parseSchedule("   ").kind).toBe("invalid");
    expect(parseSchedule("not a schedule at all").kind).toBe("invalid");
    // @ts-expect-error — exercising the runtime non-string guard
    expect(parseSchedule(null).kind).toBe("invalid");
  });
});

describe("looksLikeCronExpression", () => {
  it("is true for >=5 cron fields", () => {
    expect(looksLikeCronExpression("*/5 * * * *")).toBe(true);
    expect(looksLikeCronExpression("0 9 * * 1")).toBe(true);
    expect(looksLikeCronExpression("0 0 1 1 * 2026")).toBe(true); // 6 fields ok
  });
  it("is false for interval shorthand, too-few fields, or empty", () => {
    expect(looksLikeCronExpression("every 5m")).toBe(false);
    expect(looksLikeCronExpression("1 2 3")).toBe(false);
    expect(looksLikeCronExpression("")).toBe(false);
  });
});

describe("intervalShorthandToCron", () => {
  it("maps minute intervals that divide 60 directly", () => {
    expect(intervalShorthandToCron("every 30m")).toBe("*/30 * * * *");
    expect(intervalShorthandToCron("every 15m")).toBe("*/15 * * * *");
  });
  it("rounds non-divisor minutes to the nearest divisor of 60", () => {
    expect(intervalShorthandToCron("every 7m")).toBe("*/6 * * * *");
    expect(intervalShorthandToCron("every 13m")).toBe("*/12 * * * *");
  });
  it("rounds >=60m up to hourly", () => {
    expect(intervalShorthandToCron("every 60m")).toBe("0 * * * *");
    expect(intervalShorthandToCron("every 90m")).toBe("0 * * * *");
  });
  it("maps hours and days (capping hours beyond cron's reach)", () => {
    expect(intervalShorthandToCron("every 2h")).toBe("0 */2 * * *");
    expect(intervalShorthandToCron("every 25h")).toBe("0 * * * *");
    expect(intervalShorthandToCron("every 1d")).toBe("0 0 * * *");
    expect(intervalShorthandToCron("every 2d")).toBe("0 0 */2 * *");
  });
  it("returns null for non-interval input (raw cron / garbage)", () => {
    expect(intervalShorthandToCron("0 9 * * 1")).toBeNull();
    expect(intervalShorthandToCron("30m")).toBeNull(); // requires the 'every' prefix
    expect(intervalShorthandToCron("")).toBeNull();
  });
});

describe("scheduleDisplayFromParsed", () => {
  it("returns the display field for the non-invalid variants", () => {
    expect(scheduleDisplayFromParsed(parseSchedule("every 30m"), "fb")).toBe("every 30m");
    expect(scheduleDisplayFromParsed(parseSchedule("*/5 * * * *"), "fb")).toBe("*/5 * * * *");
  });
  it("falls back for the invalid variant (which has no display field)", () => {
    expect(scheduleDisplayFromParsed(parseSchedule(""), "the-fallback")).toBe("the-fallback");
  });
});
