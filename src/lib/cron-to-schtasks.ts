// ═══════════════════════════════════════════════════════════════
// cron-to-schtasks.ts — translate a 5-field cron schedule to schtasks args
// ═══════════════════════════════════════════════════════════════
// Windows has no crontab; host-script scheduling uses Task Scheduler
// (schtasks). We translate the common schedules the SchedulePicker emits and
// return a clear error for anything Task Scheduler can't express. Pure — no OS
// calls — so it's exhaustively unit-testable.

export type SchtasksTranslation =
  | { ok: true; args: string[] }
  | { ok: false; error: string };

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function isNum(s: string): boolean {
  return /^\d+$/.test(s);
}
function stepOf(field: string): number | null {
  const m = field.match(/^\*\/(\d+)$/);
  return m && Number(m[1]) > 0 ? Number(m[1]) : null;
}
function hhmm(hour: number, min: number): string {
  return `${pad2(hour)}:${pad2(min)}`;
}

const UNSUPPORTED = (cron: string): SchtasksTranslation => ({
  ok: false,
  error: `Schedule "${cron}" can't be expressed as a Windows scheduled task. Use a daily, weekly, or monthly time, or "every N minutes/hours".`,
});

/**
 * Translate `min hour dom mon dow` → schtasks `/SC …` argument list (without
 * `/TN` / `/TR`, which the caller adds). Covers: every-N-minutes, every-N-hours,
 * hourly-at-minute, daily, weekly (one or more weekdays), monthly (day-of-month).
 */
export function cronToSchtasks(cron: string): SchtasksTranslation {
  const f = cron.trim().split(/\s+/);
  if (f.length !== 5) return { ok: false, error: "Schedule must have exactly 5 cron fields: min hour dom mon dow" };
  const [min, hour, dom, mon, dow] = f;

  // No day/month constraints → minute / hour / daily family.
  if (dom === "*" && mon === "*" && dow === "*") {
    const stepMin = stepOf(min);
    if (stepMin && hour === "*") return { ok: true, args: ["/SC", "MINUTE", "/MO", String(stepMin)] };

    const stepHour = stepOf(hour);
    if (stepHour && isNum(min)) {
      return { ok: true, args: ["/SC", "HOURLY", "/MO", String(stepHour), "/ST", `00:${pad2(Number(min))}`] };
    }
    if (isNum(min) && hour === "*") {
      return { ok: true, args: ["/SC", "HOURLY", "/MO", "1", "/ST", `00:${pad2(Number(min))}`] };
    }
    if (isNum(min) && isNum(hour) && Number(min) < 60 && Number(hour) < 24) {
      return { ok: true, args: ["/SC", "DAILY", "/ST", hhmm(Number(hour), Number(min))] };
    }
    return UNSUPPORTED(cron);
  }

  // Weekly: explicit time, any day-of-week list, no dom/month.
  if (isNum(min) && isNum(hour) && dom === "*" && mon === "*" && dow !== "*") {
    const parts = dow.split(",");
    const days: string[] = [];
    for (const d of parts) {
      if (!isNum(d)) return UNSUPPORTED(cron);
      const n = Number(d);
      if (n < 0 || n > 7) return UNSUPPORTED(cron);
      days.push(DOW[n % 7]); // cron 0 and 7 are both Sunday
    }
    return { ok: true, args: ["/SC", "WEEKLY", "/D", days.join(","), "/ST", hhmm(Number(hour), Number(min))] };
  }

  // Monthly: explicit time + day-of-month, no weekday/month constraint.
  if (isNum(min) && isNum(hour) && isNum(dom) && mon === "*" && dow === "*") {
    const d = Number(dom);
    if (d < 1 || d > 31) return UNSUPPORTED(cron);
    return { ok: true, args: ["/SC", "MONTHLY", "/D", String(d), "/ST", hhmm(Number(hour), Number(min))] };
  }

  return UNSUPPORTED(cron);
}
