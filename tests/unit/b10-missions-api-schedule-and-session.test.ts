/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- the route is loaded after the per-test module registry reset, so it must be required rather than imported at the top */
// ═══════════════════════════════════════════════════════════════
// B10 oracle, group missions (D68 and D69, the API half).
//
// Written before the product code moved. Holds contract sections 1.4 and 1.6.
//
// The defect (D68): GET /api/missions?id= answers exactly `{ mission, run }`
// and the list answers `{ missions: [{...m, run}] }`. Nothing anywhere has ever
// put a `cronJob` on either, so MissionEditorPanel's whole "Cron Job" card and
// MissionsList's cron badge sit behind a condition that is never true. And the
// thing they describe is not a Hermes cron job any more: PatterStage owns the
// timer, and the composer's "Schedule" dispatch mode writes a row in the
// `schedules` table.
//
// The contract: the detail branch sends `schedule` (the rename of `cronJob`),
// the list branch sends `scheduleStatus` per row, both built by
// `toMissionScheduleView`, and the list reads every schedule in ONE query
// through `listSchedulesForMissions` — the same rule the run anchor beside it
// already follows, and the reason its own comment says "One extra query for the
// whole page, not one per row".
//
// The doubles are the repositories. The route's own composition (which branch
// calls which reader, with what, and what shape comes back) is what is under
// test, so api-response and the URL parsing are left real.
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from "next/server";

// ── doubles ────────────────────────────────────────────────────

jest.mock("next/server", () => {
  class MockResponse {
    status: number;
    private _data: unknown;
    constructor(data: unknown = null, init?: ResponseInit) {
      this._data = data;
      this.status = init?.status ?? 200;
    }
    json() {
      return Promise.resolve(this._data);
    }
    static json(data: unknown, init?: ResponseInit) {
      return new MockResponse(data, init);
    }
  }
  return { NextRequest: class MockRequest {}, NextResponse: MockResponse };
});

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn((_a: string, _b: string, error: unknown) => {
    throw error;
  }),
}));
jest.mock("@/lib/db", () => ({ ensureDb: jest.fn(), getDb: jest.fn(), inTransaction: jest.fn(), uuid: jest.fn(), now: jest.fn() }));
jest.mock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn() }));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));

const listMissions = jest.fn();
const getMission = jest.fn();
jest.mock("@/lib/missions/mission-repository", () => ({
  listMissions: (...a: unknown[]) => listMissions(...a),
  getMission: (...a: unknown[]) => getMission(...a),
}));

jest.mock("@/lib/missions/mission-category-repository", () => ({ getCategory: jest.fn(() => null) }));

jest.mock("@/lib/runs-repository", () => ({
  getLatestRunForMission: jest.fn(() => null),
  listLatestRunsForMissions: jest.fn(() => new Map()),
}));
jest.mock("@/lib/orchestration/run-deadline", () => ({ buildMissionRunView: jest.fn(() => null) }));

const getScheduleForMission = jest.fn();
const listSchedulesForMissions = jest.fn();
jest.mock("@/lib/schedules-repository", () => ({
  // The two readers the contract names (section 1.4). `listSchedulesForMissions`
  // does not exist yet, which is one of this file's reds.
  getScheduleForMission: (...a: unknown[]) => getScheduleForMission(...a),
  listSchedulesForMissions: (...a: unknown[]) => listSchedulesForMissions(...a),
  createSchedule: jest.fn(),
  deleteSchedulesForMission: jest.fn(),
}));

// ── fixtures ───────────────────────────────────────────────────

const SCHEDULE_ROW = {
  id: "sch-1",
  missionId: "m-1",
  name: "Nightly digest",
  schedule: "every 30m",
  scheduleDisplay: "every 30 minutes",
  enabled: true,
  catchUpPolicy: "fire_once",
  repeatTimes: null,
  repeatDone: 2,
  profileName: null,
  nextRunAt: "2026-09-05T12:00:00.000Z",
  lastRunAt: "2026-09-05T11:30:00.000Z",
  lastRunId: "run-9",
  lastStatus: "dispatched",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-05T11:30:00.000Z",
};

/** What the client is sent for SCHEDULE_ROW — the ten fields, and only those. */
const SCHEDULE_VIEW = {
  id: "sch-1",
  missionId: "m-1",
  name: "Nightly digest",
  schedule: "every 30m",
  scheduleDisplay: "every 30 minutes",
  enabled: true,
  nextRunAt: "2026-09-05T12:00:00.000Z",
  lastRunAt: "2026-09-05T11:30:00.000Z",
  lastStatus: "dispatched",
  repeatTimes: null,
  repeatDone: 2,
};

const MISSION = {
  id: "m-1",
  name: "Nightly digest",
  prompt: "Triage the queue",
  status: "successful",
  // The field D69 is about: it has been read out of the DB and carried on the
  // Mission type all along, and no surface has ever linked to what it names.
  sessionId: "sess-abc",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-05T11:30:00.000Z",
};

function request(url: string): NextRequest {
  return { url } as unknown as NextRequest;
}

interface Envelope {
  data: Record<string, unknown>;
}

async function get(url: string): Promise<Envelope> {
  const { GET } = require("@/app/api/missions/route") as {
    GET: (r: NextRequest) => Promise<{ json: () => Promise<Envelope> }>;
  };
  const res = await GET(request(url));
  return res.json();
}

beforeEach(() => {
  jest.clearAllMocks();
  getMission.mockReturnValue(MISSION);
  listMissions.mockReturnValue([MISSION]);
  getScheduleForMission.mockReturnValue(null);
  listSchedulesForMissions.mockReturnValue(new Map());
});

// ── the detail branch ──────────────────────────────────────────

describe("GET /api/missions?id= sends the mission's schedule", () => {
  it("sends the schedule as `schedule`, built from the schedules repository", async () => {
    getScheduleForMission.mockReturnValue(SCHEDULE_ROW);

    const body = await get("http://localhost/api/missions?id=m-1");

    expect(getScheduleForMission).toHaveBeenCalledWith("m-1");
    expect(body.data.schedule).toEqual(SCHEDULE_VIEW);
  });

  it("sends null, not an absent key, for a one-shot mission", async () => {
    const body = await get("http://localhost/api/missions?id=m-1");

    expect(body.data).toHaveProperty("schedule");
    expect(body.data.schedule).toBeNull();
  });

  it("never sends `cronJob` again", async () => {
    getScheduleForMission.mockReturnValue(SCHEDULE_ROW);

    const body = await get("http://localhost/api/missions?id=m-1");

    // The rename is the point: the thing is a PatterStage schedule, not a
    // Hermes cron job, and the old name is what the dead card was keyed on.
    expect(body.data).not.toHaveProperty("cronJob");
  });

  it("still carries the mission and its run, and the session it produced", async () => {
    const body = await get("http://localhost/api/missions?id=m-1");

    expect(body.data.mission).toMatchObject({ id: "m-1", sessionId: "sess-abc" });
    expect(body.data).toHaveProperty("run");
  });
});

// ── the list branch ────────────────────────────────────────────

describe("GET /api/missions sends each row's schedule", () => {
  it("attaches `scheduleStatus` to the row that has one", async () => {
    listSchedulesForMissions.mockReturnValue(new Map([["m-1", SCHEDULE_ROW]]));

    const body = await get("http://localhost/api/missions?limit=200");
    const missions = body.data.missions as Array<Record<string, unknown>>;

    expect(missions).toHaveLength(1);
    expect(missions[0].scheduleStatus).toEqual(SCHEDULE_VIEW);
  });

  it("attaches null for a row with no schedule, so the badge has an answer either way", async () => {
    const body = await get("http://localhost/api/missions?limit=200");
    const missions = body.data.missions as Array<Record<string, unknown>>;

    expect(missions[0]).toHaveProperty("scheduleStatus");
    expect(missions[0].scheduleStatus).toBeNull();
    expect(missions[0]).not.toHaveProperty("cronJob");
  });

  it("reads every schedule in ONE query, with the whole id list", async () => {
    listMissions.mockReturnValue([
      { ...MISSION, id: "m-1" },
      { ...MISSION, id: "m-2" },
      { ...MISSION, id: "m-3" },
    ]);

    await get("http://localhost/api/missions?limit=200");

    // The run anchor beside it already works this way, and its comment says
    // why: "One extra query for the whole page, not one per row". A per-row
    // getScheduleForMission would be the same regression in a new field.
    expect(listSchedulesForMissions).toHaveBeenCalledTimes(1);
    expect(listSchedulesForMissions).toHaveBeenCalledWith(["m-1", "m-2", "m-3"]);
    expect(getScheduleForMission).not.toHaveBeenCalled();
  });

  it("asks for nothing when the page is empty", async () => {
    listMissions.mockReturnValue([]);

    const body = await get("http://localhost/api/missions?limit=200");

    expect(body.data.missions).toEqual([]);
    expect(listSchedulesForMissions).toHaveBeenCalledWith([]);
  });
});
