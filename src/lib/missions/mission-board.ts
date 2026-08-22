export type MissionBoardColumn =
  | "draft"
  | "queued"
  | "dispatched"
  | "successful"
  | "failed";

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

export function isMissionActive(mission: MissionBoardFields): boolean {
  return mission.status === "dispatched" || isMissionQueuedForRun(mission);
}
