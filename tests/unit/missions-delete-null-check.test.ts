/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Tests for POST /api/missions delete action.
 * Note: the delete action currently calls deleteMission regardless of whether
 * loadMission returned null (route does not guard on loadMission result).
 * This test suite documents current behavior.
 */

import type { NextRequest } from "next/server";
jest.mock("next/server", () => require("../helpers/mocks").nextServerMock());

jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn() }));

jest.mock("@/lib/api/api-auth", () => ({
  isReadOnly: jest.fn(() => false),
}));
jest.mock("@/lib/api/audit-log", () => ({ appendAuditLine: jest.fn() }));

jest.mock("@/lib/orchestration", () => ({
  cancelMissionRun: jest.fn(() => Promise.resolve({ ok: true })),
  dispatchMissionRun: jest.fn(() => Promise.resolve({ ok: true })),
}));

jest.mock("@/lib/schedule/schedules-repository", () => ({
  createSchedule: jest.fn(),
  deleteSchedulesForMission: jest.fn(),
}));

jest.mock("@/lib/missions/mission-repository", () => {
  const getMission = jest.fn();
  const deleteMission = jest.fn();

  return {
    getMission,
    deleteMission,
    listMissions: jest.fn(),
    createMission: jest.fn(),
    updateMission: jest.fn(),
    buildMissionPrompt: jest.fn(),
    __getMission: getMission,
    __deleteMission: deleteMission,
  };
});

const repo = require("@/lib/missions/mission-repository") as Record<string, jest.Mock>;
const mockDeleteMission = repo.__deleteMission;
const mockGetMission = repo.__getMission;

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteMission.mockReturnValue(true);
  mockGetMission.mockImplementation((id: string) =>
    id === "m_existing" ? { id: "m_existing", name: "Test" } : null,
  );
});

async function postRoute(body: Record<string, unknown>) {
  const route = require("@/app/api/missions/route") as { POST: (req: Request) => unknown };
  const req = {
    url: "http://localhost/api/missions",
    method: "POST",
    headers: new Headers({ "content-type": "application/json" }),
    body: JSON.stringify(body),
    json: async () => body,
  } as unknown as NextRequest;
  return route.POST(req) as unknown as { status: number; json(): Promise<Record<string, unknown>> };
}

describe("POST /api/missions — delete action", () => {
  it("successfully deletes an existing mission", async () => {
    // getMission is NOT mocked (it's the real function), so it returns undefined/null
    // The route only checks deleteMission's return value
    mockDeleteMission.mockReturnValue(true);

    const res = await postRoute({ action: "delete", missionId: "m_existing" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect((body as { data: { deleted: string } }).data.deleted).toBe("m_existing");
  });

  it("returns 404 when mission does not exist", async () => {
    // deleteMission returns false for non-existent missions
    mockDeleteMission.mockReturnValue(false);

    const res = await postRoute({ action: "delete", missionId: "m_nonexistent" });
    expect(res.status).toBe(404);
  });

  it("returns 400 when missionId is missing", async () => {
    const res = await postRoute({ action: "delete" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when missionId is an empty string", async () => {
    const res = await postRoute({ action: "delete", missionId: "" });
    expect(res.status).toBe(400);
  });
});
