// ═══════════════════════════════════════════════════════════════
// schedule-target.ts: what a schedule row fires, in the words a screen uses
//
// A schedule is a promise to run something, and until now the list said only
// when. Two rows over two different missions read identically, and a script
// row was indistinguishable from a mission one even though the kind has been
// on the record since T-0107. The row already knows all of this; nothing
// turned it into copy (T-0114).
// ═══════════════════════════════════════════════════════════════

import type { ScheduleKind } from "@/lib/schedule/schedules-repository";

/** The four fields on a schedule row that say what it fires. */
export interface ScheduleTargetFields {
  kind: ScheduleKind;
  missionId: string | null;
  /** The mission's own name, resolved by the list read. Null for a script row. */
  missionName: string | null;
  scriptName: string | null;
}

export interface ScheduleTarget {
  /** What kind of thing this row fires: "Mission" or "Script". */
  kindLabel: string;
  /** The mission or script it fires, or why it cannot be named. */
  name: string;
  /** True when the row names nothing that could be found, so it cannot fire. */
  missing: boolean;
}

/**
 * The kind and the name a row shows, from the row itself.
 *
 * A missing target is still described rather than hidden: the scheduler
 * disables an orphaned row on its next tick and records the reason, so the
 * list says the same thing the tick would rather than showing a blank.
 */
export function describeScheduleTarget(row: ScheduleTargetFields): ScheduleTarget {
  if (row.kind === "script") {
    return row.scriptName
      ? { kindLabel: "Script", name: row.scriptName, missing: false }
      : { kindLabel: "Script", name: "No script linked", missing: true };
  }
  if (row.missionName) return { kindLabel: "Mission", name: row.missionName, missing: false };
  // A row with a mission id and no name is a mission that has been deleted;
  // one with neither never had a mission at all. Different fixes, so different
  // sentences.
  return {
    kindLabel: "Mission",
    name: row.missionId ? "Mission not found" : "No mission linked",
    missing: true,
  };
}
