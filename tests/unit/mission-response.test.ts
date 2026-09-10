/** @jest-environment node */

// Tests for the `missionResponse` and `enrichedMission` helpers in
// src/lib/mission-response.ts. These helpers consolidate the
// `enrichMissionCron(getMission(id)!)` pattern that appeared in
// 4 sites in /api/missions/route.ts and 5 sites in
// mission-promote-handler.ts.

// eslint-disable-next-line @typescript-eslint/no-require-imports -- hoisting-safe inside jest.mock
jest.mock("next/server", () => require("../helpers/mocks").nextServerMock());
const { __responses: responses } = jest.requireMock("next/server") as {
  __responses: Array<{ data: unknown; init?: ResponseInit }>;
};

const mockGetMission = jest.fn();
jest.mock("@/lib/missions/mission-repository", () => ({
  getMission: (id: string) => mockGetMission(id),
}));

import { missionResponse, enrichedMission } from "@/lib/missions/mission-response";

beforeEach(() => {
  responses.length = 0;
  mockGetMission.mockReset();
});

describe("missionResponse", () => {
  it("returns 200 with { data: { mission } } when mission exists", async () => {
    const mission = { id: "m1", name: "Test" };
    mockGetMission.mockReturnValue(mission);

    const res = missionResponse("m1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: { mission } });
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
    // mutation but before the response shape is built.
    mockGetMission.mockReturnValue(undefined);

    const res = missionResponse("m1");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "Mission not found" });
  });
});

describe("enrichedMission", () => {
  it("returns the mission when it exists", () => {
    const mission = { id: "m1" };
    mockGetMission.mockReturnValue(mission);
    expect(enrichedMission("m1")).toBe(mission);
  });

  it("returns undefined when the mission was deleted (no `!` lie)", () => {
    mockGetMission.mockReturnValue(undefined);
    expect(enrichedMission("m1")).toBeUndefined();
  });
});
