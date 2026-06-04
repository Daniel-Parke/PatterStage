/** @jest-environment node */

// Tests for the `missionResponse` and `enrichedMission` helpers in
// src/lib/mission-response.ts. These helpers consolidate the
// `enrichMissionCron(getMission(id)!)` pattern that appeared in
// 4 sites in /api/missions/route.ts and 5 sites in
// mission-promote-handler.ts.

const responses: Array<{ data: unknown; init?: ResponseInit }> = [];
jest.mock("next/server", () => {
  class NextResponse {
    ok: boolean;
    status: number;
    private _data: unknown;
    constructor(data: unknown = null, init?: ResponseInit) {
      this._data = data;
      this.status = init?.status ?? 200;
      this.ok = this.status >= 200 && this.status < 300;
    }
    json() {
      return Promise.resolve(this._data);
    }
    static json(data: unknown, init?: ResponseInit) {
      responses.push({ data, init });
      return new NextResponse(data, init);
    }
  }
  return { NextResponse };
});

const mockGetMission = jest.fn();
jest.mock("@/lib/mission-repository", () => ({
  getMission: (id: string) => mockGetMission(id),
}));

const mockEnrichMissionCron = jest.fn();
jest.mock("@/lib/mission-cron-sync", () => ({
  enrichMissionCron: (m: unknown) => mockEnrichMissionCron(m),
}));

import { missionResponse, enrichedMission } from "@/lib/mission-response";

beforeEach(() => {
  responses.length = 0;
  mockGetMission.mockReset();
  mockEnrichMissionCron.mockReset();
  // Default: enrich is identity (callers can override per-test).
  mockEnrichMissionCron.mockImplementation((m) => m);
});

describe("missionResponse", () => {
  it("returns 200 with { data: { mission } } when mission exists", async () => {
    const mission = { id: "m1", name: "Test" };
    mockGetMission.mockReturnValue(mission);

    const res = missionResponse("m1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: { mission } });
    expect(mockEnrichMissionCron).toHaveBeenCalledWith(mission);
  });

  it("accepts a custom status (201 for create-style responses)", async () => {
    mockGetMission.mockReturnValue({ id: "m1" });

    const res = missionResponse("m1", 201);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ data: { mission: { id: "m1" } } });
  });

  it("returns 404 when the mission was deleted between mutation and response", async () => {
    // Guardrail: a race where the mission is deleted after a successful
    // mutation but before the response shape is built. The pre-refactor
    // inline form would have returned { mission: undefined } in a 200
    // body, which the client could not distinguish from a valid mission.
    mockGetMission.mockReturnValue(undefined);

    const res = missionResponse("m1");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "Mission not found" });
  });

  it("passes the mission through enrichMissionCron (preserves cron enrichment)", async () => {
    const mission = { id: "m1", cronJobId: "j1" };
    const enriched = { id: "m1", cronJobId: "j1", cronJob: { id: "j1" } };
    mockGetMission.mockReturnValue(mission);
    mockEnrichMissionCron.mockReturnValue(enriched);

    const res = missionResponse("m1");
    const body = await res.json();
    expect(body).toEqual({ data: { mission: enriched } });
    // The helper calls enrich, not the caller — that's the consolidation.
    expect(mockEnrichMissionCron).toHaveBeenCalledTimes(1);
  });
});

describe("enrichedMission", () => {
  it("returns the enriched mission when it exists", () => {
    const mission = { id: "m1" };
    mockGetMission.mockReturnValue(mission);
    const result = enrichedMission("m1");
    expect(result).toBe(mission);
    expect(mockEnrichMissionCron).toHaveBeenCalledWith(mission);
  });

  it("returns undefined when the mission was deleted (no `!` lie)", () => {
    // The lib-side helper is used inside result-shaped handlers
    // (e.g. { ok: true; mission: Mission }) where the caller historically
    // wrote `enrichMissionCron(getMission(id)!)`. The `!` lies to the
    // type checker if the mission was deleted. The helper returns
    // undefined instead, forcing the caller to keep the defensive branch
    // they would have had to write anyway.
    mockGetMission.mockReturnValue(undefined);
    const result = enrichedMission("m1");
    expect(result).toBeUndefined();
  });
});
