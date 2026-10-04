import { parseSchedule } from "./parse-schedule";
import { scheduleCanEverFire } from "./next-run";
import { scheduleIntervalProblem } from "./interval-bounds";

/**
 * Validate before writing: syntax, calendar feasibility, then interval bounds.
 * February 30 parses but never fires (T-0079); a zero interval can dispatch
 * paid work on every tick. A null next run alone is not a refusal: leap days
 * can fall beyond the search horizon, and a valid one-shot can be in the past.
 */
export function scheduleProblem(raw: string): string | null {
  if (parseSchedule(raw).kind === "invalid") return `Unrecognized schedule: ${raw}`;
  if (!scheduleCanEverFire(raw)) {
    return `Schedule "${raw}" can never fire: it names a date that does not ` +
      `exist, or a field outside its range. Check the day-of-month against the month.`;
  }
  return scheduleIntervalProblem(raw);
}
