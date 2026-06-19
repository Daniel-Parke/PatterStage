/** @jest-environment node */

/**
 * Tests for the /api/schedules routes (list/create, get/update/delete, run-now)
 * with the repository + dispatch mocked. parseSchedule/computeNextRun are left
 * real (covered elsewhere) so the create/patch next_run_at recompute is exercised
 * end-to-end. requireAuth is stubbed to "authenticated".
 */

import type { NextRequest } from "next/server";

const listSchedules = jest.fn();
const createSchedule = jest.fn();
const getSchedule = jest.fn();
const updateSchedule = jest.fn();
const deleteSchedule = jest.fn();
const recordScheduleRun = jest.fn();
const dispatchMissionRun = jest.fn();

jest.mock("@/lib/schedules-repository", () => ({
  listSchedules: (...a: unknown[]) => listSchedules(...a),
  createSchedule: (...a: unknown[]) => createSchedule(...a),
  getSchedule: (...a: unknown[]) => getSchedule(...a),
  updateSchedule: (...a: unknown[]) => updateSchedule(...a),
  deleteSchedule: (...a: unknown[]) => deleteSchedule(...a),
  recordScheduleRun: (...a: unknown[]) => recordScheduleRun(...a),
}));
jest.mock("@/lib/api-auth", () => ({ requireAuth: () => null }));
jest.mock("@/lib/orchestration", () => ({
  dispatchMissionRun: (...a: unknown[]) => dispatchMissionRun(...a),
}));

import { GET as listGET, POST as createPOST } from "@/app/api/schedules/route";
import { GET as idGET, PATCH as idPATCH, DELETE as idDELETE } from "@/app/api/schedules/[id]/route";
import { POST as runPOST } from "@/app/api/schedules/[id]/run/route";

function req(body?: unknown): NextRequest {
  return { json: async () => body ?? {} } as unknown as NextRequest;
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}
async function jsonOf(res: Response) {
  return (await res.json()) as { data?: unknown; error?: string };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/schedules", () => {
  it("returns the schedule list", async () => {
    listSchedules.mockReturnValue([{ id: "s1" }]);
    const res = await listGET();
    expect(res.status).toBe(200);
    expect(await jsonOf(res)).toEqual({ data: { schedules: [{ id: "s1" }] } });
  });
});

describe("POST /api/schedules", () => {
  it("creates a schedule (201) with a computed next_run_at", async () => {
    createSchedule.mockImplementation((input) => ({ id: "s1", ...input }));
    const res = await createPOST(req({ missionId: "m1", schedule: "every 30m" }));
    expect(res.status).toBe(201);
    expect(createSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ missionId: "m1", schedule: "every 30m", nextRunAt: expect.any(String) }),
    );
  });

  it("rejects an unrecognized schedule string (400)", async () => {
    const res = await createPOST(req({ missionId: "m1", schedule: "total garbage" }));
    expect(res.status).toBe(400);
    expect(createSchedule).not.toHaveBeenCalled();
  });

  it("rejects a missing missionId (400, zod)", async () => {
    const res = await createPOST(req({ schedule: "every 5m" }));
    expect(res.status).toBe(400);
    expect(createSchedule).not.toHaveBeenCalled();
  });
});

describe("GET/PATCH/DELETE /api/schedules/[id]", () => {
  it("GET returns the schedule, or 404 when missing", async () => {
    getSchedule.mockReturnValueOnce({ id: "s1" });
    expect((await idGET(req(), ctx("s1"))).status).toBe(200);
    getSchedule.mockReturnValueOnce(null);
    expect((await idGET(req(), ctx("missing"))).status).toBe(404);
  });

  it("PATCH updates an existing schedule", async () => {
    getSchedule.mockReturnValue({ id: "s1" });
    updateSchedule.mockReturnValue({ id: "s1", enabled: false });
    const res = await idPATCH(req({ enabled: false }), ctx("s1"));
    expect(res.status).toBe(200);
    expect(updateSchedule).toHaveBeenCalledWith("s1", expect.objectContaining({ enabled: false }));
  });

  it("PATCH recomputes next_run_at when the schedule expression changes", async () => {
    getSchedule.mockReturnValue({ id: "s1" });
    updateSchedule.mockReturnValue({ id: "s1" });
    await idPATCH(req({ schedule: "every 10m" }), ctx("s1"));
    expect(updateSchedule).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ schedule: "every 10m", nextRunAt: expect.any(String) }),
    );
  });

  it("PATCH returns 404 when the schedule is missing", async () => {
    getSchedule.mockReturnValue(null);
    expect((await idPATCH(req({ enabled: false }), ctx("missing"))).status).toBe(404);
  });

  it("DELETE returns 200 when removed, 404 when nothing was deleted", async () => {
    deleteSchedule.mockReturnValueOnce(true);
    expect((await idDELETE(req(), ctx("s1"))).status).toBe(200);
    deleteSchedule.mockReturnValueOnce(false);
    expect((await idDELETE(req(), ctx("missing"))).status).toBe(404);
  });
});

describe("POST /api/schedules/[id]/run", () => {
  it("404 when the schedule is missing", async () => {
    getSchedule.mockReturnValue(null);
    expect((await runPOST(req(), ctx("missing"))).status).toBe(404);
    expect(dispatchMissionRun).not.toHaveBeenCalled();
  });

  it("400 when the schedule has no linked mission", async () => {
    getSchedule.mockReturnValue({ id: "s1", missionId: null });
    expect((await runPOST(req(), ctx("s1"))).status).toBe(400);
    expect(dispatchMissionRun).not.toHaveBeenCalled();
  });

  it("dispatches + records the run WITHOUT advancing (manual run-now)", async () => {
    getSchedule.mockReturnValue({ id: "s1", missionId: "m1" });
    dispatchMissionRun.mockResolvedValue({ ok: true, runId: "r1", backendRunId: "b1" });
    const res = await runPOST(req(), ctx("s1"));
    expect(res.status).toBe(200);
    expect(dispatchMissionRun).toHaveBeenCalledWith("m1", expect.objectContaining({ scheduleId: "s1" }));
    expect(recordScheduleRun).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ lastRunId: "b1", lastStatus: "dispatched" }),
    );
  });

  it("maps a dispatch failure to 500 (still records the attempt)", async () => {
    getSchedule.mockReturnValue({ id: "s1", missionId: "m1" });
    dispatchMissionRun.mockResolvedValue({ ok: false, error: "backend down" });
    const res = await runPOST(req(), ctx("s1"));
    expect(res.status).toBe(500);
    expect(recordScheduleRun).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ lastStatus: "error: backend down" }),
    );
  });
});
