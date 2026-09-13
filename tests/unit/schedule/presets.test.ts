import {
  SCHEDULE_PRESETS,
  findPresetByValue,
  buildWeeklyCron,
  parseDayOfWeek,
  allDays,
  type DayOfWeek,
} from "@/lib/schedule/presets";
import { parseSchedule } from "@/lib/schedule/parse-schedule";

describe("SCHEDULE_PRESETS", () => {
  it("has no duplicate preset values within the same group", () => {
    // Multiple groups may share a value (e.g. "Every 1 day" Interval and
    // "Daily at midnight" Daily are the same cron). But within a single
    // group, every value must be unique.
    const seenByGroup = new Map<string, Set<string>>();
    for (const p of SCHEDULE_PRESETS) {
      if (!seenByGroup.has(p.group)) seenByGroup.set(p.group, new Set());
      const set = seenByGroup.get(p.group)!;
      expect(set.has(p.value)).toBe(false);
      set.add(p.value);
    }
  });

  it("has no duplicate preset ids", () => {
    const ids = SCHEDULE_PRESETS.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every preset value is a valid 5-field cron expression", () => {
    for (const preset of SCHEDULE_PRESETS) {
      const parsed = parseSchedule(preset.value);
      expect(parsed.kind).toBe("cron");
      if (parsed.kind === "cron") {
        expect(parsed.expr).toBe(preset.value);
      }
    }
  });

  it("contains expected groups (Interval, Daily, Weekly, Monthly)", () => {
    const groups = new Set(SCHEDULE_PRESETS.map((p) => p.group));
    expect(groups.has("Interval")).toBe(true);
    expect(groups.has("Daily")).toBe(true);
    expect(groups.has("Weekly")).toBe(true);
    expect(groups.has("Monthly")).toBe(true);
  });

  it("includes the Weekly presets (the new feature)", () => {
    const weekly = SCHEDULE_PRESETS.filter((p) => p.group === "Weekly");
    expect(weekly.length).toBeGreaterThanOrEqual(5);
    // The "Weekdays at 9am" preset must exist
    const weekdays = weekly.find((p) => p.value === "0 9 * * 1-5");
    expect(weekdays).toBeTruthy();
  });

  it("includes the Interval presets for the existing 2-hour mission", () => {
    const every2h = SCHEDULE_PRESETS.find((p) => p.value === "0 */2 * * *");
    expect(every2h).toBeTruthy();
    expect(every2h?.label).toBe("Every 2 hours");
  });
});

describe("findPresetByValue", () => {
  it("returns the matching preset for a known value", () => {
    const p = findPresetByValue("0 */2 * * *");
    expect(p).toBeTruthy();
    expect(p?.label).toBe("Every 2 hours");
  });

  it("returns null for an unknown cron", () => {
    expect(findPresetByValue("0 0 31 2 *")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(findPresetByValue("")).toBeNull();
    expect(findPresetByValue("   ")).toBeNull();
  });

  it("trims whitespace before matching", () => {
    const p = findPresetByValue("  0 9 * * 1-5  ");
    expect(p?.id).toBe("w-wd-9am");
  });
});

describe("buildWeeklyCron", () => {
  it("returns `mm hh * * *` for an empty day set (every day)", () => {
    expect(buildWeeklyCron(new Set(), 9, 0)).toBe("0 9 * * *");
  });

  it("returns `mm hh * * *` for all 7 days (every day)", () => {
    expect(buildWeeklyCron(allDays(), 18, 0)).toBe("0 18 * * *");
  });

  it("returns `mm hh * * 1-5` for weekdays only (1,2,3,4,5)", () => {
    const weekdays = new Set<DayOfWeek>([1, 2, 3, 4, 5]);
    expect(buildWeeklyCron(weekdays, 9, 0)).toBe("0 9 * * 1-5");
  });

  it("returns `mm hh * * 1,3,5` for a custom subset", () => {
    const mwf = new Set<DayOfWeek>([1, 3, 5]);
    expect(buildWeeklyCron(mwf, 7, 0)).toBe("0 7 * * 1,3,5");
  });

  it("does not pad minutes and hours (matches preset convention)", () => {
    expect(buildWeeklyCron(new Set<DayOfWeek>([1]), 6, 5)).toBe("5 6 * * 1");
  });

  it("clamps out-of-range hours/minutes", () => {
    expect(buildWeeklyCron(new Set<DayOfWeek>([1]), 99, -3)).toBe("0 23 * * 1");
  });

  it("sorts days in the output (so 5,1,3 → 1,3,5)", () => {
    const unsorted = new Set<DayOfWeek>([5, 1, 3]);
    expect(buildWeeklyCron(unsorted, 12, 0)).toBe("0 12 * * 1,3,5");
  });
});

describe("parseDayOfWeek", () => {
  it("returns null for '*' (interpreted as all 7 days)", () => {
    expect(parseDayOfWeek("*")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseDayOfWeek("")).toBeNull();
  });

  it("parses a single digit", () => {
    const result = parseDayOfWeek("1");
    expect(result).toEqual(new Set([1]));
  });

  it("parses a range", () => {
    const result = parseDayOfWeek("1-5");
    expect(result).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it("parses a comma-separated list", () => {
    const result = parseDayOfWeek("1,3,5");
    expect(result).toEqual(new Set([1, 3, 5]));
  });
});

describe("allDays", () => {
  it("returns a set with all 7 days (0-6)", () => {
    const days = allDays();
    expect(days.size).toBe(7);
    for (let d = 0; d <= 6; d++) {
      expect(days.has(d as DayOfWeek)).toBe(true);
    }
  });

  it("returns a fresh set each call (caller can mutate safely)", () => {
    const a = allDays();
    a.delete(0);
    const b = allDays();
    expect(b.size).toBe(7);
  });
});
