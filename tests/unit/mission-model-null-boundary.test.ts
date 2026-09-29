/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- Jest hoists the isolated database mock. */

import { NextRequest } from "next/server";
import { openBaselineDb } from "../helpers/baseline-db";
import { applyMissionQueueMigration } from "@/lib/db/apply-mission-queue-migration";

let database: import("better-sqlite3").Database | null = null;
const findModel = jest.fn();

jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => database));
jest.mock("@/lib/models/models-repository", () => ({ findModelByModelId: (...args: unknown[]) => findModel(...args) }));
jest.mock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn() }));
jest.mock("@/lib/api/api-auth", () => ({ isReadOnly: () => false }));
jest.mock("@/lib/api/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: () => new Response(JSON.stringify({ error: "Internal server error" }), {
    status: 500, headers: { "content-type": "application/json" },
  }),
}));
jest.mock("@/lib/api/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/missions/mission-dispatch", () => ({ dispatchMissionNow: jest.fn() }));
jest.mock("@/lib/missions/mission-queue-tick", () => ({ runMissionQueueTick: jest.fn() }));

import { POST } from "@/app/api/missions/route";

function missionRows(): Record<string, unknown>[] {
  return database!.prepare("SELECT * FROM missions ORDER BY id").all() as Record<string, unknown>[];
}

async function post(body: Record<string, unknown>) {
  return POST(new NextRequest("http://localhost/api/missions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  database = openBaselineDb([applyMissionQueueMigration]);
  findModel.mockReset();
  findModel.mockReturnValue(null);
});

afterEach(() => {
  database?.close();
  database = null;
});

describe("POST /api/missions explicit null modelId boundary", () => {
  it.each(["dispatch", "promote", "update"])(
    "rejects explicit null modelId for %s before any mission row changes",
    async (action) => {
      const saved = await post({ action: "dispatch", dispatchMode: "save", name: "Existing", instruction: "Original task" });
      expect(saved.status).toBe(201);
      const existing = missionRows()[0];
      if (action === "update") {
        database!.prepare("UPDATE missions SET status = 'dispatched' WHERE id = ?").run(String(existing.id));
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
    database!.prepare("UPDATE missions SET status = 'dispatched' WHERE id = ?").run(missionId);
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
