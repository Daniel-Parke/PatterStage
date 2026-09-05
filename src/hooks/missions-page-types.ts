// ═══════════════════════════════════════════════════════════════
// missions-page-types — the missions page row + detail view models
// ═══════════════════════════════════════════════════════════════
//
// Split out of useMissionsPage (Phase 4 god-file decomposition). These
// two types are read by the focused hooks the page composes and by the
// presentational components underneath it. They live in their own
// module so neither has to import the composing hook, which would make
// the module graph cyclic.

import type { Mission } from "@/types/console";
import type { MissionRunView } from "@/lib/missions/mission-run-state";
import type { MissionScheduleView } from "@/lib/missions/mission-schedule-view";

export type MissionRow = Mission & {
  /**
   * The mission's schedule, as the LIST branch of /api/missions publishes it.
   *
   * Not called `schedule`: `Mission.schedule` is already the stored cron
   * string, and an intersection would give the property the unusable type
   * `string & MissionScheduleView`. It replaces `cronJob`, which nothing has
   * ever populated (T-0104, D68).
   */
  scheduleStatus?: MissionScheduleView | null;
  latestSession?: { id: string; modified: string } | null;
  /**
   * The mission's latest run, as /api/missions publishes it. Null for a
   * mission that has never been dispatched.
   *
   * This replaces a `results?: string` field that claimed the API "may return
   * results as plural for backward compatibility". Nothing has ever returned
   * it: the repository column is `result`, singular, and the detail panel was
   * rendering the plural one, so every mission's output and every failure
   * message rendered as nothing at all.
   */
  run?: MissionRunView | null;
};

export interface MissionDetail {
  mission: MissionRow;
  /** The mission's latest run. See MissionRow.run. */
  run?: MissionRunView | null;
  /**
   * Renamed from `cronJob`: the thing is a PatterStage schedule, not a Hermes
   * cron job, and this is the first version of the field anything sends.
   *
   * `sessions` went with it. It was declared required and no route has ever
   * sent it, so every MissionDetail in the tree was built with a `sessions: []`
   * that was a lie; the mission-to-sessions affordance is the link on the
   * panel.
   */
  schedule: MissionScheduleView | null;
}
