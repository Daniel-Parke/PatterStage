/* eslint-disable @typescript-eslint/no-require-imports -- Jest hoists the isolated database mock. */

import { NextRequest } from "next/server";
import { openBaselineDb } from "./baseline-db";
import { applyMissionQueueMigration } from "@/lib/db/apply-mission-queue-migration";

let database: import("better-sqlite3").Database | null = null;
const findModel = jest.fn();

jest.mock("@/lib/db", () => require("./baseline-db").dbSingletonMock(() => database));
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

export function missionDatabase(): import("better-sqlite3").Database {
  return database!;
}

export function missionRows(): Record<string, unknown>[] {
  return missionDatabase().prepare("SELECT * FROM missions ORDER BY id").all() as Record<string, unknown>[];
}

export async function post(body: Record<string, unknown>) {
  return POST(new NextRequest("http://localhost/api/missions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

export function openMissionModelBoundaryDb(): void {
  database = openBaselineDb([applyMissionQueueMigration]);
  findModel.mockReset();
}

export function setFindModel(implementation: (modelId: string) => unknown): void {
  findModel.mockImplementation(implementation);
}

export function closeMissionModelBoundaryDb(): void {
  database?.close();
  database = null;
}
