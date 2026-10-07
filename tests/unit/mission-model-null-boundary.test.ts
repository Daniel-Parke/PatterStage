/** @jest-environment node */
import {
  closeMissionModelBoundaryDb, missionDatabase, missionRows, openMissionModelBoundaryDb, post, setFindModel,
} from "../helpers/mission-model-boundary";

beforeEach(() => {
  openMissionModelBoundaryDb();
  setFindModel(() => null);
});

afterEach(() => {
  closeMissionModelBoundaryDb();
});

describe("POST /api/missions explicit null modelId boundary", () => {
  it.each(["dispatch", "promote", "update"])(
    "rejects explicit null modelId for %s before any mission row changes",
    async (action) => {
      const saved = await post({ action: "dispatch", dispatchMode: "save", name: "Existing", instruction: "Original task" });
      expect(saved.status).toBe(201);
      const existing = missionRows()[0];
      if (action === "update") {
        missionDatabase().prepare("UPDATE missions SET status = 'dispatched' WHERE id = ?").run(String(existing.id));
      }
      const before = missionRows();

      const response = await post({
        action,
        id: existing.id,
        missionId: existing.id,
        dispatchMode: "save",
        name: "Attempted change",
        instruction: "Attempted replacement task",
        modelId: null,
      });

      expect({
        clientError: response.status >= 400 && response.status < 500,
        rowsUnchanged: JSON.stringify(missionRows()) === JSON.stringify(before),
      }).toEqual({ clientError: true, rowsUnchanged: true });
    },
  );

  it("keeps the default-model path when modelId is omitted", async () => {
    const response = await post({
      action: "dispatch", dispatchMode: "save", name: "Default model", instruction: "Accepted task",
    });

    expect(response.status).toBe(201);
    expect(missionRows()).toHaveLength(1);
    expect(missionRows()[0].model_id).toBeNull();
  });

  it("updates a dispatched mission when modelId is omitted", async () => {
    const saved = await post({
      action: "dispatch", dispatchMode: "save", name: "Existing", instruction: "Original task",
    });
    expect(saved.status).toBe(201);
    const missionId = String(missionRows()[0].id);
    missionDatabase().prepare("UPDATE missions SET status = 'dispatched' WHERE id = ?").run(missionId);
    const before = missionRows()[0];

    const response = await post({
      action: "update", id: missionId, missionId,
      dispatchMode: "save", name: "Attempted change", instruction: "Attempted replacement task",
    });

    expect(response.status).toBe(200);
    expect(missionRows()[0]).toMatchObject({ id: missionId, name: "Attempted change" });
    expect(missionRows()[0]).not.toEqual(before);
  });
});
