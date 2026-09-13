/** The board's columns, in board order. */
export const MISSION_BOARD_COLUMNS = [
  "draft",
  "queued",
  "dispatched",
  "successful",
  "failed",
] as const;

export type MissionBoardColumn = (typeof MISSION_BOARD_COLUMNS)[number];

type MissionBoardFields = {
  status: string;
  queuedForRun?: boolean;
};

/** Save draft: queued status but not waiting for background dispatch. */
export function isMissionDraft(mission: MissionBoardFields): boolean {
  return mission.status === "queued" && mission.queuedForRun !== true;
}

/** Queued for MissionQueueSync when no other mission is dispatched. */
export function isMissionQueuedForRun(mission: MissionBoardFields): boolean {
  return mission.status === "queued" && mission.queuedForRun === true;
}

export function missionBoardColumn(mission: MissionBoardFields): MissionBoardColumn {
  if (isMissionDraft(mission)) return "draft";
  if (mission.status === "queued") return "queued";
  if (
    mission.status === "dispatched" ||
    mission.status === "successful" ||
    mission.status === "failed"
  ) {
    return mission.status;
  }
  return "queued";
}

/**
 * One pass, five mutually exclusive buckets: the board's own column function,
 * counted.
 *
 * The insights strip used to count `m.status` itself and disagreed with the
 * board on the facts rather than the words: a saved draft is a Draft on the
 * board and was Queued, and therefore Active, in the strip (T-0104, C126).
 * There is one counter now, and both surfaces read it.
 */
export function countMissionsByColumn<M extends MissionBoardFields>(
  missions: readonly M[],
): Record<MissionBoardColumn, number> {
  const counts: Record<MissionBoardColumn, number> = {
    draft: 0,
    queued: 0,
    dispatched: 0,
    successful: 0,
    failed: 0,
  };
  for (const mission of missions) counts[missionBoardColumn(mission)] += 1;
  return counts;
}

export function isMissionActive(mission: MissionBoardFields): boolean {
  return mission.status === "dispatched" || isMissionQueuedForRun(mission);
}
