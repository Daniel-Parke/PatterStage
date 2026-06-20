import { cronToSchtasks } from "@/lib/cron-to-schtasks";

function argsFor(cron: string): string[] {
  const r = cronToSchtasks(cron);
  if (!r.ok) throw new Error(`expected ok for "${cron}": ${r.error}`);
  return r.args;
}

describe("cronToSchtasks", () => {
  it("daily at a given time", () => {
    expect(argsFor("0 3 * * *")).toEqual(["/SC", "DAILY", "/ST", "03:00"]);
    expect(argsFor("30 14 * * *")).toEqual(["/SC", "DAILY", "/ST", "14:30"]);
    expect(argsFor("5 0 * * *")).toEqual(["/SC", "DAILY", "/ST", "00:05"]);
  });

  it("every N minutes", () => {
    expect(argsFor("*/5 * * * *")).toEqual(["/SC", "MINUTE", "/MO", "5"]);
    expect(argsFor("*/15 * * * *")).toEqual(["/SC", "MINUTE", "/MO", "15"]);
  });

  it("every N hours (on a minute)", () => {
    expect(argsFor("0 */6 * * *")).toEqual(["/SC", "HOURLY", "/MO", "6", "/ST", "00:00"]);
    expect(argsFor("15 */2 * * *")).toEqual(["/SC", "HOURLY", "/MO", "2", "/ST", "00:15"]);
  });

  it("hourly at a minute", () => {
    expect(argsFor("10 * * * *")).toEqual(["/SC", "HOURLY", "/MO", "1", "/ST", "00:10"]);
  });

  it("weekly on one or more weekdays (cron 0/7 = Sunday)", () => {
    expect(argsFor("0 9 * * 1")).toEqual(["/SC", "WEEKLY", "/D", "MON", "/ST", "09:00"]);
    expect(argsFor("0 9 * * 1,3,5")).toEqual(["/SC", "WEEKLY", "/D", "MON,WED,FRI", "/ST", "09:00"]);
    expect(argsFor("0 9 * * 0")).toEqual(["/SC", "WEEKLY", "/D", "SUN", "/ST", "09:00"]);
    expect(argsFor("0 9 * * 7")).toEqual(["/SC", "WEEKLY", "/D", "SUN", "/ST", "09:00"]);
    expect(argsFor("0 9 * * 6")).toEqual(["/SC", "WEEKLY", "/D", "SAT", "/ST", "09:00"]);
  });

  it("monthly on a day-of-month", () => {
    expect(argsFor("0 2 1 * *")).toEqual(["/SC", "MONTHLY", "/D", "1", "/ST", "02:00"]);
    expect(argsFor("30 4 15 * *")).toEqual(["/SC", "MONTHLY", "/D", "15", "/ST", "04:30"]);
  });

  it("rejects schedules Task Scheduler can't express", () => {
    for (const cron of [
      "0 9 1 * 1", // dom AND dow
      "0 9 * 6 *", // specific month
      "*/5 9 * * *", // stepped minutes at a fixed hour
      "0 9-17 * * *", // hour range
      "0 0 * * 1-5", // weekday range (not a comma list)
      "bad", // wrong field count
      "61 0 * * *", // out-of-range minute
    ]) {
      expect(cronToSchtasks(cron).ok).toBe(false);
    }
  });

  it("error messages are actionable", () => {
    const r = cronToSchtasks("0 9-17 * * *");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Windows scheduled task/);
  });
});
