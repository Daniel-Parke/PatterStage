// ═══════════════════════════════════════════════════════════════
// schedule/next-run.ts — compute the next fire time for a schedule
//
// PatterStage owns scheduling, so it must compute "when does this fire next"
// itself (the agent's jobs.json scheduler is gone). Dependency-free: a small
// 5-field cron evaluator (minute hour day-of-month month day-of-week) plus
// interval and one-shot handling, reusing parseSchedule() for classification.
// Times are evaluated in the server's local timezone (cron convention).
// ═══════════════════════════════════════════════════════════════

import { intervalMinutesAllowed, MAX_SCHEDULE_INTERVAL_MINUTES } from "./interval-bounds";
import { parseSchedule } from "./parse-schedule";

// Expand one cron field to a value set. Supports "*", step ("star-slash-5"),
// ranges ("1-5"), lists ("0,30"), and range-step forms ("5/10").
function expandField(field: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const token of field.split(",")) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    let step = 1;
    let body = trimmed;
    const slash = trimmed.indexOf("/");
    if (slash !== -1) {
      step = parseInt(trimmed.slice(slash + 1), 10) || 1;
      body = trimmed.slice(0, slash);
    }
    let lo = min;
    let hi = max;
    if (body === "*" || body === "") {
      lo = min;
      hi = max;
    } else if (body.includes("-")) {
      const [a, b] = body.split("-");
      lo = parseInt(a, 10);
      hi = parseInt(b, 10);
    } else {
      lo = parseInt(body, 10);
      // "N/step" means N..max; a bare "N" is just N.
      hi = slash !== -1 ? max : lo;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
    for (let v = lo; v <= hi; v += step) {
      if (v >= min && v <= max) out.add(v);
    }
  }
  return out;
}

/** Day-of-week field: cron allows 0 and 7 for Sunday — normalise 7 → 0. */
function expandDow(field: string): Set<number> {
  const set = expandField(field, 0, 7);
  if (set.has(7)) {
    set.delete(7);
    set.add(0);
  }
  return set;
}

// The SAME horizon the interval bounds refuse past, imported rather than
// retyped: the bounds doc claims the two agree, and two copies of a number
// in two files is how they stop agreeing.
const CAP_MINUTES = MAX_SCHEDULE_INTERVAL_MINUTES;

/** Longest each month can ever be, February counted as a leap year. */
const MAX_DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Could this cron expression EVER fire?
 *
 * `looksLikeCronExpression` only checks shape -- five fields of digits and
 * punctuation -- so `0 0 30 2 *` (the 30th of February) parses as valid, is
 * stored `enabled`, and computes a null next-run. `getDueSchedules` selects
 * `WHERE next_run_at IS NOT NULL`, so the row sits enabled forever and dead
 * forever, and the UI's "Next:" preview simply disappears rather than saying
 * why (T-0079).
 *
 * WHY THIS IS STRUCTURAL RATHER THAN A PROBE. The obvious check -- call
 * computeNextRun and refuse a null -- is wrong twice over. It costs ~527,000
 * synchronous Date mutations per rejected expression, on the request thread.
 * And CAP_MINUTES is 366 days, so `0 0 29 2 *` -- the 29th of February, a
 * legitimate expression that fires every four years -- also returns null from
 * most start dates and would be refused. Asking the calendar directly is exact
 * and costs nothing.
 */
export function cronCanEverFire(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return false;
  const [minF, hourF, domF, monF, dowF] = parts;

  // An empty set means every value in that field was out of range, e.g. hour 99.
  const minutes = expandField(minF, 0, 59);
  const hours = expandField(hourF, 0, 23);
  const doms = expandField(domF, 1, 31);
  const months = expandField(monF, 1, 12);
  const dows = expandDow(dowF);
  if (!minutes.size || !hours.size || !doms.size || !months.size || !dows.size) return false;

  // Standard cron: when BOTH day-of-month and day-of-week are restricted, a day
  // matching EITHER fires. So an impossible date is only fatal when day-of-week
  // is unrestricted and cannot rescue it.
  const domRestricted = domF.trim() !== "*";
  const monRestricted = monF.trim() !== "*";
  const dowRestricted = dowF.trim() !== "*";
  if (domRestricted && monRestricted && !dowRestricted) {
    for (const m of months) {
      for (const d of doms) {
        if (d <= MAX_DAYS_IN_MONTH[m - 1]) return true;
      }
    }
    return false;
  }
  return true;
}

/** Next time strictly after `from` that matches a 5-field cron expression. */
export function nextCronAfter(expr: string, from: Date): Date | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const [minF, hourF, domF, monF, dowF] = parts;

  const minutes = expandField(minF, 0, 59);
  const hours = expandField(hourF, 0, 23);
  const doms = expandField(domF, 1, 31);
  const months = expandField(monF, 1, 12);
  const dows = expandDow(dowF);
  const domRestricted = domF.trim() !== "*";
  const dowRestricted = dowF.trim() !== "*";

  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);

  for (let i = 0; i < CAP_MINUTES; i++) {
    if (
      minutes.has(d.getMinutes()) &&
      hours.has(d.getHours()) &&
      months.has(d.getMonth() + 1)
    ) {
      const domMatch = doms.has(d.getDate());
      const dowMatch = dows.has(d.getDay());
      // Standard cron: if both DOM and DOW are restricted, match either;
      // otherwise match both (one being "*" is always satisfied).
      const dayMatch =
        domRestricted && dowRestricted ? domMatch || dowMatch : domMatch && dowMatch;
      if (dayMatch) return new Date(d.getTime());
    }
    d.setMinutes(d.getMinutes() + 1);
  }
  return null;
}

/**
 * Compute the next fire time strictly after `from` for a canonical schedule
 * string (5-field cron, "every Nm/Nh/Nd" interval, or an ISO one-shot).
 * Returns null when the schedule will not fire again (past one-shot / invalid).
 */
export function computeNextRun(schedule: string, from: Date): Date | null {
  const parsed = parseSchedule(schedule);
  switch (parsed.kind) {
    case "interval": {
      // The bounds are checked HERE and not only at the write paths, because
      // this is where an out-of-bounds interval turns into damage: zero minutes
      // answers "the instant you asked", so the row is due again on the tick
      // that just fired it, and an absurd interval leaves the Date range, so
      // the caller's `.toISOString()` throws. Neither can now leave this
      // function. Refusing an already-stored bad row is the scheduler tick's
      // job, which disables it and says why.
      if (!intervalMinutesAllowed(parsed.minutes)) return null;
      return new Date(from.getTime() + parsed.minutes * 60_000);
    }
    case "once": {
      const at = new Date(parsed.run_at);
      return Number.isFinite(at.getTime()) && at.getTime() > from.getTime() ? at : null;
    }
    case "cron":
      return nextCronAfter(parsed.expr, from);
    default:
      return null;
  }
}

/**
 * Could this SCHEDULE ever fire?
 *
 * The wrapper every caller should use. `cronCanEverFire` judges a five-field
 * cron expression and nothing else, so calling it directly on "every 10m" or an
 * ISO one-shot refuses a perfectly good schedule — which is exactly what
 * happened the first time this was wired in, and what the interval and one-shot
 * cases below now pin.
 *
 * Only cron carries the impossible-date problem: an interval always fires, and
 * a one-shot is already handled by computeNextRun returning null for a past
 * date, which the callers have always coped with.
 */
export function scheduleCanEverFire(raw: string): boolean {
  const parsed = parseSchedule(raw);
  if (parsed.kind !== "cron") return true;
  return cronCanEverFire(parsed.expr);
}
