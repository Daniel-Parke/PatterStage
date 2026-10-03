// Pure-logic tests for the PatterStage scheduler next-fire computation
// (cron evaluator, interval, one-shot, and the DOM/DOW combination rule).

import { computeNextRun, nextCronAfter } from "@/lib/schedule/next-run";

function expectDate(value: Date | null): Date {
  expect(value).not.toBeNull();
  return value as Date;
}

function local(y: number, mo: number, d: number, h: number, mi: number): Date {
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

describe("computeNextRun", () => {
  it("intervals fire base time plus N minutes", () => {
    const base = new Date("2026-06-14T10:00:00.000Z");
    expect(computeNextRun("every 30m", base)?.toISOString()).toBe("2026-06-14T10:30:00.000Z");
    expect(computeNextRun("every 2h", base)?.toISOString()).toBe("2026-06-14T12:00:00.000Z");
  });

  it("one-shot fires once in the future, then never again", () => {
    const before = new Date("2026-06-14T10:00:00.000Z");
    const after = new Date("2026-06-14T13:00:00.000Z");
    expect(computeNextRun("2026-06-14T12:00:00.000Z", before)?.toISOString()).toBe(
      "2026-06-14T12:00:00.000Z",
    );
    expect(computeNextRun("2026-06-14T12:00:00.000Z", after)).toBeNull();
  });

  it("invalid schedules return null", () => {
    expect(computeNextRun("not a schedule", new Date())).toBeNull();
    expect(computeNextRun("", new Date())).toBeNull();
  });
});

describe("nextCronAfter (local-time evaluation)", () => {
  it("steps to the next matching minute for every-15", () => {
    const next = expectDate(nextCronAfter("*/15 * * * *", local(2026, 6, 14, 10, 7)));
    expect(next.getHours()).toBe(10);
    expect(next.getMinutes()).toBe(15);
  });

  it("finds the next daily 09:00 run", () => {
    const next = expectDate(nextCronAfter("0 9 * * *", local(2026, 6, 14, 10, 0)));
    expect(next.getDate()).toBe(15);
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
  });

  it("respects a weekday-only (Mon-Fri) schedule", () => {
    // 2026-06-13 is a Saturday; next 08:00 weekday run is Mon 2026-06-15.
    const next = expectDate(nextCronAfter("0 8 * * 1-5", local(2026, 6, 13, 12, 0)));
    expect(next.getDay()).toBe(1);
    expect(next.getDate()).toBe(15);
    expect(next.getHours()).toBe(8);
  });

  it("uses OR semantics when both day-of-month and day-of-week are set", () => {
    // "0 0 1 * 1" = midnight on the 1st OR any Monday; Monday the 15th is next.
    const next = expectDate(nextCronAfter("0 0 1 * 1", local(2026, 6, 14, 12, 0)));
    expect(next.getDay()).toBe(1);
    expect(next.getDate()).toBe(15);
  });
});
