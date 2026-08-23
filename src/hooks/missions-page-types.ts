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

export type MissionRow = Mission & {
  cronJob?: {
    state: string;
    enabled: boolean;
    lastRun: string | null;
    lastStatus: string | null;
  };
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
  cronJob: {
    id: string;
    name: string;
    state: string;
    enabled: boolean;
    lastRun: string | null;
    nextRun: string | null;
    lastStatus: string | null;
    schedule: string;
  } | null;
  sessions: Array<{ id: string; modified: string; size: number }>;
}
