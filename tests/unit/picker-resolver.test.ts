/** @jest-environment node */
// Pure cron-resolution helpers extracted from SchedulePicker
// (lib/schedule/picker-resolver.ts).

import {
  resolveToCron,
  previewCron,
  groupSchedulePresets,
  SCHEDULE_GROUP_ORDER,
} from "@/lib/schedule/picker-resolver";
import type { DayOfWeek } from "@/lib/schedule/presets";

describe("resolveToCron", () => {
  it("returns null for empty / whitespace", () => {
    expect(resolveToCron("")).toBeNull();
    expect(resolveToCron("   ")).toBeNull();
  });

  it("passes through a plain 5-field cron", () => {
    expect(resolveToCron("0 9 * * 1-5")).toBe("0 9 * * 1-5");
  });

  // NOTE (pre-existing, behaviour-preserved on extraction): the "plain
  // 5-field cron" check (`split(/\s+/).length >= 5`) runs before the JSON
  // branch, so a JSON-serialised cron whose expr has 4 internal spaces is
  // returned as the raw JSON string, not the unwrapped expr. The JSON-cron
  // branch is effectively shadowed. Flagged for a follow-up fix; asserted
  // here as-is so the refactor stays byte-equivalent.
  it("shadows a JSON cron ParsedSchedule (returns the raw string)", () => {
    const json = JSON.stringify({ kind: "cron", expr: "0 0 * * *" });
    expect(resolveToCron(json)).toBe(json);
  });

  it("converts a JSON interval (every 2h) to an hour-step cron", () => {
    expect(
      resolveToCron(JSON.stringify({ kind: "interval", display: "every 2h" })),
    ).toBe("0 */2 * * *");
  });

  it("converts the 'every Nh' shorthand to a cron", () => {
    expect(resolveToCron("every 3h")).toBe("0 */3 * * *");
  });

  it("converts a sub-hour minute interval to a minute-step cron", () => {
    expect(resolveToCron("every 15m")).toBe("*/15 * * * *");
  });

  it("returns null for junk", () => {
    expect(resolveToCron("not a schedule")).toBeNull();
  });
});

describe("previewCron", () => {
  it("builds an every-day cron when all/none selected", () => {
    expect(previewCron("09:30", new Set([0, 1, 2, 3, 4, 5, 6] as DayOfWeek[]))).toBe(
      "30 9 * * *",
    );
  });

  it("builds a weekday range cron for Mon–Fri", () => {
    expect(previewCron("18:00", new Set([1, 2, 3, 4, 5] as DayOfWeek[]))).toBe(
      "0 18 * * 1-5",
    );
  });

  it("falls back to 0:0 for an unparseable time", () => {
    expect(previewCron("", new Set([1] as DayOfWeek[]))).toBe("0 0 * * 1");
  });
});

describe("groupSchedulePresets", () => {
  it("returns the 4 groups in canonical order, each non-empty", () => {
    const groups = groupSchedulePresets();
    expect(groups.map((g) => g.group)).toEqual(SCHEDULE_GROUP_ORDER);
    for (const g of groups) expect(g.items.length).toBeGreaterThan(0);
  });
});
