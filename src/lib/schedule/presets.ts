/**
 * Schedule presets — single source of truth for the schedule pickers.
 *
 * Grouped by intent (Interval, Daily, Weekly, Monthly) so the dropdown UI
 * is readable. Every value is a canonical 5-field cron expression. The
 * storage layer (`parseSchedule`) accepts both 5-field cron and the
 * "every Nh/Nm/Nd" shorthand, but going forward the pickers only emit
 * 5-field cron so storage is canonical.
 */

export type SchedulePresetGroup = "Interval" | "Daily" | "Weekly" | "Monthly";

export interface SchedulePreset {
  /** Stable id, used as the React key. */
  id: string;
  /** Human label shown in the dropdown. */
  label: string;
  /** Canonical 5-field cron expression. */
  value: string;
  /** Group header for the dropdown. */
  group: SchedulePresetGroup;
}

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  // ── Interval ────────────────────────────────────────────────
  { id: "int-1m",   group: "Interval", label: "Every 1 minute",   value: "* * * * *" },
  { id: "int-5m",   group: "Interval", label: "Every 5 minutes",  value: "*/5 * * * *" },
  { id: "int-10m",  group: "Interval", label: "Every 10 minutes", value: "*/10 * * * *" },
  { id: "int-15m",  group: "Interval", label: "Every 15 minutes", value: "*/15 * * * *" },
  { id: "int-30m",  group: "Interval", label: "Every 30 minutes", value: "*/30 * * * *" },
  { id: "int-1h",   group: "Interval", label: "Every 1 hour",     value: "0 * * * *" },
  { id: "int-2h",   group: "Interval", label: "Every 2 hours",    value: "0 */2 * * *" },
  { id: "int-3h",   group: "Interval", label: "Every 3 hours",    value: "0 */3 * * *" },
  { id: "int-4h",   group: "Interval", label: "Every 4 hours",    value: "0 */4 * * *" },
  { id: "int-6h",   group: "Interval", label: "Every 6 hours",    value: "0 */6 * * *" },
  { id: "int-8h",   group: "Interval", label: "Every 8 hours",    value: "0 */8 * * *" },
  { id: "int-12h",  group: "Interval", label: "Every 12 hours",   value: "0 */12 * * *" },
  { id: "int-1d",   group: "Interval", label: "Every 1 day",      value: "0 0 * * *" },

  // ── Daily ───────────────────────────────────────────────────
  { id: "d-mid",    group: "Daily", label: "Daily at midnight", value: "0 0 * * *" },
  { id: "d-6am",    group: "Daily", label: "Daily at 6am",      value: "0 6 * * *" },
  { id: "d-9am",    group: "Daily", label: "Daily at 9am",      value: "0 9 * * *" },
  { id: "d-6pm",    group: "Daily", label: "Daily at 6pm",      value: "0 18 * * *" },

  // ── Weekly ──────────────────────────────────────────────────
  { id: "w-wd-9am", group: "Weekly", label: "Weekdays at 9am",    value: "0 9 * * 1-5" },
  { id: "w-wd-6pm", group: "Weekly", label: "Weekdays at 6pm",    value: "0 18 * * 1-5" },
  { id: "w-mwf-7am",group: "Weekly", label: "Mon/Wed/Fri at 7am", value: "0 7 * * 1,3,5" },
  { id: "w-mon",    group: "Weekly", label: "Mondays at 9am",     value: "0 9 * * 1" },
  { id: "w-fri",    group: "Weekly", label: "Fridays at 5pm",     value: "0 17 * * 5" },

  // ── Monthly ─────────────────────────────────────────────────
  { id: "m-1",      group: "Monthly", label: "1st of month at 9am",  value: "0 9 1 * *" },
  { id: "m-15",     group: "Monthly", label: "15th of month at 9am", value: "0 9 15 * *" },
];

/** Reverse-lookup: 5-field cron expression → preset (or null). */
export function findPresetByValue(cron: string): SchedulePreset | null {
  if (!cron) return null;
  const trimmed = cron.trim();
  return SCHEDULE_PRESETS.find((p) => p.value === trimmed) ?? null;
}

// ── Days of week ─────────────────────────────────────────────

/** Cron day-of-week order: 0 = Sunday, 6 = Saturday. */
export const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Build a 5-field cron expression from a day-of-week set, hour, and minute.
 * - Empty set or all 7 days → "every day at HH:MM" (`mm hh * * *`)
 * - Mon–Fri only (1,2,3,4,5) → `mm hh * * 1-5`
 * - Custom subset → `mm hh * * 1,3,5`
 */
export function buildWeeklyCron(
  days: ReadonlySet<DayOfWeek>,
  hh: number,
  mm: number,
): string {
  const safeHh = Math.max(0, Math.min(23, Math.trunc(hh)));
  const safeMm = Math.max(0, Math.min(59, Math.trunc(mm)));
  const mmStr = String(safeMm);
  const hhStr = String(safeHh);

  const sorted = Array.from(days).sort((a, b) => a - b) as DayOfWeek[];

  // Empty set or all 7 days → every day
  if (sorted.length === 0 || sorted.length === 7) {
    return `${mmStr} ${hhStr} * * *`;
  }

  // Mon–Fri only (1,2,3,4,5) → use range shorthand
  if (
    sorted.length === 5 &&
    sorted[0] === 1 && sorted[1] === 2 && sorted[2] === 3 &&
    sorted[3] === 4 && sorted[4] === 5
  ) {
    return `${mmStr} ${hhStr} * * 1-5`;
  }

  return `${mmStr} ${hhStr} * * ${sorted.join(",")}`;
}

/**
 * Parse a 5-field cron expression's day-of-week field into a DayOfWeek set.
 * Handles `*`, `1-5`, `1,3,5`, and single digits. Returns `null` for `*`
 * (interpreted as "all 7 days"). Returns an empty set for `* * * * *` callers
 * who need to distinguish; callers that don't care can use `?? allDays()`.
 */
export function parseDayOfWeek(dowField: string): Set<DayOfWeek> | null {
  const trimmed = (dowField ?? "").trim();
  if (!trimmed || trimmed === "*") return null;

  const result = new Set<DayOfWeek>();
  for (const part of trimmed.split(",")) {
    const range = part.split("-");
    if (range.length === 1) {
      const n = parseInt(range[0], 10);
      if (n >= 0 && n <= 6) result.add(n as DayOfWeek);
    } else if (range.length === 2) {
      const lo = parseInt(range[0], 10);
      const hi = parseInt(range[1], 10);
      if (lo >= 0 && hi <= 6 && lo <= hi) {
        for (let d = lo; d <= hi; d++) result.add(d as DayOfWeek);
      }
    }
  }
  return result;
}

/** Convenience: return a set containing all 7 days. */
export function allDays(): Set<DayOfWeek> {
  return new Set([0, 1, 2, 3, 4, 5, 6]);
}
