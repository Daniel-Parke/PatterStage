// ═══════════════════════════════════════════════════════════════
// schedule/next-run.ts — compute the next fire time for a schedule
//
// PatterStage owns scheduling, so it must compute "when does this fire next"
// itself (the agent's jobs.json scheduler is gone). Dependency-free: a small
// 5-field cron evaluator (minute hour day-of-month month day-of-week) plus
// interval and one-shot handling, reusing parseSchedule() for classification.
// Times are evaluated in the server's local timezone (cron convention).
// ═══════════════════════════════════════════════════════════════

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

const CAP_MINUTES = 366 * 24 * 60; // give up after a year of minute-stepping

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
    case "interval":
      return new Date(from.getTime() + parsed.minutes * 60_000);
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
