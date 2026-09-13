// ═══════════════════════════════════════════════════════════════
// picker-resolver.ts — pure cron-resolution helpers for SchedulePicker
// ═══════════════════════════════════════════════════════════════
//
// Extracted from SchedulePicker.tsx so the value→cron resolution, the
// custom-builder preview, and the preset grouping are pure + unit-testable
// (the component is just rendering + local state around these).

import { scheduleIntervalProblem } from "./interval-bounds";
import { scheduleCanEverFire } from "./next-run";
import { parseSchedule } from "@/lib/schedule/parse-schedule";
import {
  SCHEDULE_PRESETS,
  buildWeeklyCron,
  type DayOfWeek,
  type SchedulePreset,
  type SchedulePresetGroup,
} from "@/lib/schedule/presets";

export const SCHEDULE_GROUP_ORDER: SchedulePresetGroup[] = [
  "Interval",
  "Daily",
  "Weekly",
  "Monthly",
];

/**
 * Resolve a raw value (any supported format) to a canonical 5-field cron
 * expression. Returns null if the value doesn't parse to something usable.
 * Accepts: plain 5-field cron, JSON-serialised ParsedSchedule (DB shape),
 * and "every Nh/Nm/Nd" shorthand.
 */
export function resolveToCron(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Plain 5-field cron
  if (trimmed.split(/\s+/).length >= 5) return trimmed;

  // 2. JSON-serialised ParsedSchedule (what the DB stores)
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { kind?: string; expr?: string; display?: string };
      if (parsed.kind === "cron" && typeof parsed.expr === "string") {
        return parsed.expr;
      }
      if (parsed.kind === "interval" && typeof parsed.display === "string") {
        // Re-parse the display field (e.g. "every 2h")
        const re = parseSchedule(parsed.display);
        if (re.kind === "cron" && "expr" in re) return re.expr;
        if (re.kind === "interval") {
          // Convert minutes to a cron expression: pick a sensible hour interval
          const m = re.minutes;
          if (m % 60 === 0) return `0 */${m / 60} * * *`;
          if (m % (24 * 60) === 0) return `0 0 */${m / (24 * 60)} * *`;
          if (60 % m === 0) return `*/${m} * * * *`;
        }
      }
    } catch {
      // fall through
    }
  }

  // 3. "every Nh/Nm/Nd" shorthand
  const parsed = parseSchedule(trimmed);
  if (parsed.kind === "interval") {
    const m = parsed.minutes;
    if (m % 60 === 0) return `0 */${m / 60} * * *`;
    if (m % (24 * 60) === 0) return `0 0 */${m / (24 * 60)} * *`;
    if (60 % m === 0) return `*/${m} * * * *`;
  }
  if (parsed.kind === "cron" && "expr" in parsed) {
    return parsed.expr;
  }

  return null;
}

/** Build a preview cron expression for the custom builder's "Preview" label. */
export function previewCron(time: string, days: ReadonlySet<DayOfWeek>): string {
  const [hhStr, mmStr] = time.split(":");
  const hh = parseInt(hhStr ?? "0", 10);
  const mm = parseInt(mmStr ?? "0", 10);
  return buildWeeklyCron(days, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0);
}

/** Group the preset catalog by display group, in canonical order. */
export function groupSchedulePresets(): Array<{
  group: SchedulePresetGroup;
  items: SchedulePreset[];
}> {
  const groups: Record<SchedulePresetGroup, SchedulePreset[]> = {
    Interval: [],
    Daily: [],
    Weekly: [],
    Monthly: [],
  };
  for (const p of SCHEDULE_PRESETS) groups[p.group].push(p);
  return SCHEDULE_GROUP_ORDER.map((g) => ({ group: g, items: groups[g] }));
}

/**
 * Is this raw advanced-field draft usable, and if not, why not?
 *
 * Extracted so the picker can report a bad draft on CHANGE and still display it
 * on blur, from ONE definition. Reporting on change matters: the composer used
 * to learn about a bad draft only through the blur that a submit click happens
 * to fire first, and relying on that ordering is the assumption that produced
 * the defect. jsdom does not move focus on click at all, so a test written
 * against blur ordering tests the harness rather than the app (T-0063).
 *
 * An empty draft is not a problem: it reverts to the committed value, which is
 * a perfectly good way to abandon an edit.
 */
export function advancedDraftProblem(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (parseSchedule(trimmed).kind === "invalid") {
    return `Not a schedule this understands: "${trimmed}"`;
  }
  // Shape is not satisfiability. Without this the client accepted `0 0 30 2 *`,
  // the server accepted it too, and the only signal was the "Next:" preview row
  // quietly disappearing -- the picker had computed the answer and thrown it
  // away. Client and server now refuse the same expressions (T-0079).
  if (!scheduleCanEverFire(trimmed)) {
    return `"${trimmed}" can never fire: that date does not exist, or a field is out of range`;
  }
  // And the opposite: `every 0m` fires constantly, and each firing is a paid
  // agent run. Refused here as well as at the API so the operator is told
  // before the request goes out, from the same definition the server uses.
  return scheduleIntervalProblem(trimmed);
}
