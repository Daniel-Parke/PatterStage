import {
  intervalShorthandToCron,
  parseSchedule,
} from "@/lib/schedule/parse-schedule";

/**
 * Contract tests for `intervalShorthandToCron` — the helper that
 * converts user-facing "every Nm / Nh / Nd" interval shorthand into
 * 5-field cron expressions, the canonical storage form for
 * `cron_jobs.schedule`.
 *
 * Why this exists: the live "Review & Refactor" recurring mission
 * (id 5585c131) had `schedule = "every 30m"` stored verbatim in the
 * DB. The Hermes push path's `normaliseScheduleObj` only knew how to
 * normalise cron-shaped `kind` values, so it wrote
 * `{kind: "every 30m", ...}` to `~/.hermes/cron/jobs.json` — an
 * invalid `kind` the Python scheduler can't compute `next_run_at`
 * from, so the job never fired.
 *
 * Two-layer fix: (1) `parseScheduleToDisplay` now uses this helper
 * to canonicalise the column on write, and (2) the schedule
 * canonicalisation migration also uses it to repair existing rows.
 */
describe("intervalShorthandToCron", () => {
  it("converts minute intervals that divide 60 to star-slash-N", () => {
    expect(intervalShorthandToCron("every 1m")).toBe("*/1 * * * *");
    expect(intervalShorthandToCron("every 5m")).toBe("*/5 * * * *");
    expect(intervalShorthandToCron("every 10m")).toBe("*/10 * * * *");
    expect(intervalShorthandToCron("every 15m")).toBe("*/15 * * * *");
    expect(intervalShorthandToCron("every 30m")).toBe("*/30 * * * *");
  });

  it("rounds non-divisible minute intervals to the nearest divisor of 60", () => {
    // 7 is closest to 6 (delta 1) among [1,2,3,4,5,6,10,12,15,20,30]
    expect(intervalShorthandToCron("every 7m")).toBe("*/6 * * * *");
    // 8 is between 6 (delta 2) and 10 (delta 2); 6 wins on first-match
    expect(intervalShorthandToCron("every 8m")).toBe("*/6 * * * *");
    // 13 is between 12 (delta 1) and 15 (delta 2); 12 wins
    expect(intervalShorthandToCron("every 13m")).toBe("*/12 * * * *");
    // 25 is between 20 (delta 5) and 30 (delta 5); 20 wins on first-match
    expect(intervalShorthandToCron("every 25m")).toBe("*/20 * * * *");
  });

  it("collapses minutes >= 60 to every-hour", () => {
    expect(intervalShorthandToCron("every 60m")).toBe("0 * * * *");
    expect(intervalShorthandToCron("every 90m")).toBe("0 * * * *");
    expect(intervalShorthandToCron("every 120m")).toBe("0 * * * *");
  });

  it("converts hour intervals to 0 */N * * *", () => {
    expect(intervalShorthandToCron("every 1h")).toBe("0 */1 * * *");
    expect(intervalShorthandToCron("every 2h")).toBe("0 */2 * * *");
    expect(intervalShorthandToCron("every 12h")).toBe("0 */12 * * *");
    expect(intervalShorthandToCron("every 23h")).toBe("0 */23 * * *");
  });

  it("collapses hours >= 24 to every-hour (cron has no N>23 hour slot)", () => {
    expect(intervalShorthandToCron("every 24h")).toBe("0 * * * *");
    expect(intervalShorthandToCron("every 25h")).toBe("0 * * * *");
  });

  it("converts day intervals to 0 0 star-slash-N * *", () => {
    expect(intervalShorthandToCron("every 1d")).toBe("0 0 * * *");
    expect(intervalShorthandToCron("every 2d")).toBe("0 0 */2 * *");
    expect(intervalShorthandToCron("every 7d")).toBe("0 0 */7 * *");
  });

  it("accepts the alternate unit spellings (min, mins, hour, hours, day, days)", () => {
    expect(intervalShorthandToCron("every 5min")).toBe("*/5 * * * *");
    expect(intervalShorthandToCron("every 5mins")).toBe("*/5 * * * *");
    expect(intervalShorthandToCron("every 5minutes")).toBe("*/5 * * * *");
    expect(intervalShorthandToCron("every 2hours")).toBe("0 */2 * * *");
    expect(intervalShorthandToCron("every 2hr")).toBe("0 */2 * * *");
    expect(intervalShorthandToCron("every 3days")).toBe("0 0 */3 * *");
  });

  it("is whitespace-tolerant", () => {
    expect(intervalShorthandToCron("  every   30m  ")).toBe("*/30 * * * *");
    expect(intervalShorthandToCron("every\t2h")).toBe("0 */2 * * *");
  });

  it("returns null for non-interval inputs (caller should fall through)", () => {
    expect(intervalShorthandToCron("0 9 * * 1-5")).toBeNull();
    expect(intervalShorthandToCron("*/5 * * * *")).toBeNull();
    expect(intervalShorthandToCron("2026-06-15T09:00:00Z")).toBeNull();
    expect(intervalShorthandToCron("")).toBeNull();
    expect(intervalShorthandToCron("every 1w")).toBeNull(); // weeks unsupported
    expect(intervalShorthandToCron("every 1h 30m")).toBeNull(); // combined unsupported
  });

  it("returns null for non-positive intervals", () => {
    expect(intervalShorthandToCron("every 0m")).toBeNull();
    expect(intervalShorthandToCron("every 0h")).toBeNull();
  });

  it("agrees with parseSchedule on the canonical display string", () => {
    // For every successful input, parseSchedule should produce a kind
    // "interval" with the same minutes. This guards against the two
    // helpers diverging in their interpretation of the same shorthand.
    for (const input of [
      "every 5m",
      "every 30m",
      "every 1h",
      "every 2h",
      "every 1d",
    ]) {
      const parsed = parseSchedule(input);
      expect(parsed.kind).toBe("interval");
      if (parsed.kind === "interval") {
        // minutes must be positive
        expect(parsed.minutes).toBeGreaterThan(0);
      }
      expect(intervalShorthandToCron(input)).not.toBeNull();
    }
  });
});
