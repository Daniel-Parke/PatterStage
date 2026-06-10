/** @jest-environment node */

// Tests for `parseScheduleToDisplay` in `src/lib/cron/write.ts` —
// the canonical schedule storage helper that turns user-input
// schedule strings into the {schedule, scheduleDisplay} pair stored
// in `cron_jobs`. The session-2026-06-10 investigation found that
// the live mission's `schedule = "every 30m"` was being stored
// verbatim (the helper returned `schedule: "every 30m"` instead of
// the canonical 5-field cron), which caused the Hermes push path
// to emit a broken `{kind: "every 30m", ...}` schedule object and
// left the cron never firing.
//
// These tests pin the new contract: for any user-input schedule,
// `parseScheduleToDisplay` must return a 5-field cron in `schedule`
// (so the CH→Hermes push path is a no-op) and the human label in
// `scheduleDisplay` (so the UI can still show "every 30m").

import { parseScheduleToDisplay } from "@/lib/cron/write";

describe("parseScheduleToDisplay — 5-field cron canonicalisation", () => {
  it("returns a 5-field cron when the input is a 5-field cron", () => {
    const r = parseScheduleToDisplay("0 9 * * 1-5");
    expect(r.schedule).toBe("0 9 * * 1-5");
    expect(r.scheduleDisplay).toBe("0 9 * * 1-5");
  });

  it("converts 'every Nm' shorthand to a 5-field cron and keeps the human label", () => {
    const r = parseScheduleToDisplay("every 30m");
    expect(r.schedule).toBe("*/30 * * * *");
    expect(r.scheduleDisplay).toBe("every 30m");
  });

  it("converts 'every 5m' to */5 * * * *", () => {
    const r = parseScheduleToDisplay("every 5m");
    expect(r.schedule).toBe("*/5 * * * *");
    expect(r.scheduleDisplay).toBe("every 5m");
  });

  it("converts 'every Nh' shorthand to 0 */N * * *", () => {
    // parseSchedule normalises hours to minutes for its display field.
    // The schedule column still gets the 5-field cron.
    const r = parseScheduleToDisplay("every 2h");
    expect(r.schedule).toBe("0 */2 * * *");
    expect(r.scheduleDisplay).toBe("every 120m");
  });

  it("converts 'every 1d' to 0 0 * * *", () => {
    // parseSchedule normalises "every 1d" to 1440 minutes with display
    // "every 1440m" (its single canonical form is always minutes-based).
    // The schedule column still gets the 5-field cron; only the display
    // text format differs from the user input.
    const r = parseScheduleToDisplay("every 1d");
    expect(r.schedule).toBe("0 0 * * *");
    expect(r.scheduleDisplay).toBe("every 1440m");
  });

  it("trims leading/trailing whitespace from the schedule column", () => {
    const r = parseScheduleToDisplay("  */15 * * * *  ");
    expect(r.schedule).toBe("*/15 * * * *");
    expect(r.scheduleDisplay).toBe("*/15 * * * *");
  });

  it("falls back to the raw input when the schedule is unparseable (caller decided)", () => {
    // The "invalid" kind has no canonical form; the helper passes the
    // raw string through as the schedule column. This preserves the
    // pre-fix behaviour for inputs the parser doesn't understand.
    const r = parseScheduleToDisplay("this is not a schedule");
    expect(r.schedule).toBe("this is not a schedule");
    expect(r.scheduleDisplay).toBe("this is not a schedule");
  });

  it("does not JSON-stringify the schedule (the corruption cascade)", () => {
    // Pre-fix regression: the helper returned
    // `schedule: JSON.stringify({kind: "interval", minutes: 30, ...})`
    // which the Hermes scheduler rejected as `kind: "invalid"`.
    const r = parseScheduleToDisplay("every 30m");
    expect(r.schedule.startsWith("{")).toBe(false);
    expect(r.schedule.startsWith("*/")).toBe(true);
  });
});
