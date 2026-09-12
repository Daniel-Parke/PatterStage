import {
  isMissionActive,
  isMissionDraft,
  isMissionQueuedForRun,
  missionBoardColumn,
} from "@/lib/missions/mission-board";

describe("mission-board helpers", () => {
  it("classifies drafts vs queued-for-run", () => {
    expect(isMissionDraft({ status: "queued", queuedForRun: false })).toBe(true);
    expect(isMissionQueuedForRun({ status: "queued", queuedForRun: true })).toBe(true);
    expect(missionBoardColumn({ status: "queued", queuedForRun: false })).toBe("draft");
    expect(missionBoardColumn({ status: "queued", queuedForRun: true })).toBe("queued");
  });

  it("counts active missions as dispatched or queued-for-run only", () => {
    expect(isMissionActive({ status: "dispatched" })).toBe(true);
    expect(isMissionActive({ status: "queued", queuedForRun: true })).toBe(true);
    expect(isMissionActive({ status: "queued", queuedForRun: false })).toBe(false);
  });
});
