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
  findModel.mockImplementation((modelId: string) =>
    modelId === "catalogue/valid" ? { modelId, provider: "catalogue" } : null,
  );
});

afterEach(() => {
  database?.close();
  database = null;
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
