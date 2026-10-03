/** @jest-environment node */
import {
  closeMissionModelBoundaryDb, missionRows, openMissionModelBoundaryDb, post, setFindModel,
} from "../helpers/mission-model-boundary";

beforeEach(() => {
  openMissionModelBoundaryDb();
  setFindModel((modelId: string) =>
    modelId === "catalogue/valid" ? { modelId, provider: "catalogue" } : null,
  );
});

afterEach(() => {
  closeMissionModelBoundaryDb();
});

describe("POST /api/missions modelId validation before writes", () => {
  it.each(["dispatch", "promote", "update"])(
    "refuses a numeric modelId for %s and preserves every mission row",
    async (action) => {
      const saved = await post({ action: "dispatch", dispatchMode: "save", name: "Existing", instruction: "Original task" });
      expect(saved.status).toBe(201);
      const existing = missionRows()[0];
      const before = missionRows();
      const response = await post({
        action,
        id: existing.id,
        missionId: existing.id,
        dispatchMode: "save",
        name: "Attempted change",
        instruction: "Attempted replacement task",
        modelId: 42,
      });

      expect(missionRows()).toEqual(before);
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    },
  );

  it.each([
    ["absent", undefined, null],
    ["valid", "catalogue/valid", "catalogue/valid"],
  ])("preserves the %s modelId behaviour when saving a mission", async (_case, modelId, expected) => {
    const response = await post({
      action: "dispatch", dispatchMode: "save", name: "Accepted", instruction: "Accepted task", modelId,
    });

    expect(response.status).toBe(201);
    expect(missionRows()).toHaveLength(1);
    expect(missionRows()[0].model_id).toBe(expected);
  });
});
