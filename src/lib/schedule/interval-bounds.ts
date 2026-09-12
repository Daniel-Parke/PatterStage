// ═══════════════════════════════════════════════════════════════
// schedule/interval-bounds.ts: how often a schedule is allowed to fire
//
// `every 0m` parsed cleanly, so computeNextRun answered "now" forever and every
// tick dispatched a real agent run at a paid provider, unwarned; `every
// 999999999d` left the Date range, so the advance threw AFTER the dispatch and
// the row never left the due set either. Only intervals are judged here: cron
// cannot express either end.
// ═══════════════════════════════════════════════════════════════

import { parseSchedule } from "./parse-schedule";

/**
 * The shortest gap between two firings. A minute: a firing is not free (a paid
 * agent run, or a host process), faster buys nothing an operator could consume,
 * and cron, which steps in whole minutes, already stops here.
 */
export const MIN_SCHEDULE_INTERVAL_MINUTES = 1;

/**
 * The longest gap that can be stored: 366 days, the horizon nextCronAfter
 * searches, so both halves agree on "certainly a typo". Past roughly 273
 * million days the millisecond arithmetic leaves the Date range and
 * `.toISOString()` throws: a 500 on the write path, and on the tick a throw
 * AFTER the dispatch that left the row due and firing on every tick.
 */
export const MAX_SCHEDULE_INTERVAL_MINUTES = 366 * 24 * 60;

/** MAX expressed in days, for the refusals below. */
const MAX_SCHEDULE_INTERVAL_DAYS = MAX_SCHEDULE_INTERVAL_MINUTES / (24 * 60);

/**
 * The rule as one comparison, so computeNextRun (minutes already parsed, no
 * message wanted) and the two refusals below cannot drift on what is allowed.
 */
export function intervalMinutesAllowed(minutes: number): boolean {
  return minutes >= MIN_SCHEDULE_INTERVAL_MINUTES && minutes <= MAX_SCHEDULE_INTERVAL_MINUTES;
}

/** Which bound an interval breaks, if either. */
type IntervalBreach = "too often" | "too rarely";

/**
 * The one judgement, so the write-time sentence and the row status cannot
 * disagree. Anything not an interval (cron, one-shot, unparseable) is null:
 * the parse and never-fires checks judge those, and answering for them would
 * refuse perfectly good cron.
 */
function intervalBreach(raw: string): IntervalBreach | null {
  const parsed = parseSchedule(raw);
  if (parsed.kind !== "interval" || intervalMinutesAllowed(parsed.minutes)) return null;
  return parsed.minutes < MIN_SCHEDULE_INTERVAL_MINUTES ? "too often" : "too rarely";
}

/**
 * The sentence to show the operator, or null. Used at every write path and by
 * the picker, so the refusal arrives before the request rather than after it.
 */
export function scheduleIntervalProblem(raw: string): string | null {
  const breach = intervalBreach(raw);
  if (!breach) return null;
  const shown = raw.trim();
  if (breach === "too often") {
    return (
      // Deliberately NOT "because it starts a paid agent run": the same refusal
      // serves script schedules, which cost nothing at a provider, so the
      // sentence has to be true of both.
      `Schedule "${shown}" repeats too often. The shortest gap between runs is ` +
      `${MIN_SCHEDULE_INTERVAL_MINUTES} minute, because each run starts real work ` +
      `that has to finish. Try "every 5m".`
    );
  }
  return (
    `Schedule "${shown}" repeats too rarely. The longest gap between runs is ` +
    `${MAX_SCHEDULE_INTERVAL_DAYS} days. Use a smaller number, or a cron schedule such as ` +
    `"0 9 1 1 *" to run once a year.`
  );
}

/**
 * The same judgement in the few words a row's status has room for: the tick
 * writes it on a row it refuses to fire and the lists show it verbatim, so it
 * says what happened and what would fix it in one line.
 */
export function scheduleIntervalStatus(raw: string): string | null {
  const breach = intervalBreach(raw);
  if (!breach) return null;
  if (breach === "too often") {
    return `stopped: repeats too often, the minimum is every ${MIN_SCHEDULE_INTERVAL_MINUTES} minute`;
  }
  return `stopped: repeats too rarely, the maximum is every ${MAX_SCHEDULE_INTERVAL_DAYS} days`;
}
