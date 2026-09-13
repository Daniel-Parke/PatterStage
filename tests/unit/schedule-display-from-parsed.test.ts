/** @jest-environment node */

// Tests for `scheduleDisplayFromParsed` in
// `src/lib/schedule/parse-schedule.ts` — the small type-narrowing helper
// that turns a `ParsedSchedule` into the display string the cron UI shows.
//
// The helper collapses the inline pattern
//   "display" in parsed ? (parsed as { display: string }).display : <fallback>
// into a single named function. The 3 in-tree call sites
// (src/lib/cron/write.ts, src/app/api/cron/route.ts,
// src/lib/cron-field-updates.ts) use the helper, and these tests pin the
// contract so a future regression that re-introduces the inline form
// fails CI.
//
// Byte-equivalence: the inline form and the helper form produce the
// same string for every reachable input. The `invalid` variant is the
// only one that takes the fallback branch, and the `display` field is
// non-empty on the 3 success variants per `parseSchedule`.

import { scheduleDisplayFromParsed } from "@/lib/schedule/parse-schedule";

describe("scheduleDisplayFromParsed — type narrowing for ParsedSchedule.display", () => {
  it("returns the display field for the interval variant", () => {
    const parsed = { kind: "interval", minutes: 30, display: "every 30m" } as const;
    expect(scheduleDisplayFromParsed(parsed, "fallback")).toBe("every 30m");
  });

  it("returns the display field for the cron variant", () => {
    const parsed = { kind: "cron", expr: "0 9 * * 1-5", display: "0 9 * * 1-5" } as const;
    expect(scheduleDisplayFromParsed(parsed, "fallback")).toBe("0 9 * * 1-5");
  });

  it("returns the display field for the once variant", () => {
    const parsed = { kind: "once", run_at: "2026-06-12T10:00:00Z", display: "2026-06-12T10:00:00Z" } as const;
    expect(scheduleDisplayFromParsed(parsed, "fallback")).toBe("2026-06-12T10:00:00Z");
  });

  it("returns the fallback for the invalid variant", () => {
    const parsed = { kind: "invalid", raw: "garbage", message: "Unrecognized schedule: garbage" } as const;
    expect(scheduleDisplayFromParsed(parsed, "raw input")).toBe("raw input");
  });

  it("the invalid-variant fallback is the value the caller passes through (not the message)", () => {
    const parsed = { kind: "invalid", raw: "x", message: "msg" } as const;
    expect(scheduleDisplayFromParsed(parsed, "")).toBe("");
    expect(scheduleDisplayFromParsed(parsed, "trimmed raw input")).toBe("trimmed raw input");
  });
});
