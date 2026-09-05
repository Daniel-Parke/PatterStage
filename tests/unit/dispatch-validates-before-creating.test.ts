/** @jest-environment node */

// T-0088: the schedule is judged BEFORE the row exists. dispatch.ts's own
// comment admitted the cron-schedule 400 fired after createMission, leaving
// a Draft the operator never asked for. The dispatchMode refusal moved up in
// T-0067 for exactly this reason; the schedule refusal joins it. And the
// timeout refusal is a 400 here, not a silent drop.

const mockCreateMission = jest.fn();
jest.mock("@/lib/missions/mission-repository", () => ({
  ...(jest.requireActual("@/lib/missions/mission-repository") as object),
  createMission: (...a: unknown[]) => mockCreateMission(...a),
  updateMission: jest.fn(),
  getMission: jest.fn(),
}));
jest.mock("@/lib/models-repository", () => ({ findModelByModelId: () => null }));
jest.mock("@/lib/schedules-repository", () => ({ createSchedule: jest.fn(() => ({ id: "sch_1" })) }));
jest.mock("@/lib/missions/mission-dispatch", () => ({ dispatchMissionNow: jest.fn() }));
jest.mock("@/lib/missions/mission-queue-tick", () => ({ runMissionQueueTick: jest.fn() }));
jest.mock("@/lib/missions/mission-response", () => ({ missionResponse: (m: unknown) => ({ mission: m }) }));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn(), serverErrorFromCatch: jest.fn() }));
jest.mock("@/lib/agents/roster", () => ({ resolveAgentSlug: (s: string) => s }));
jest.mock("@/lib/missions/mission-category-repository", () => ({ getMissionCategory: () => null }));
jest.mock("@/lib/db", () => ({ getDb: jest.fn(), ensureDb: jest.fn(), now: () => "t", uuid: () => "u", inTransaction: <T,>(fn: () => T) => fn() }));

import { handleDispatchMission } from "@/lib/missions/mission-handlers/dispatch";

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateMission.mockImplementation((input: { name: string }) => ({ id: "m_1", name: input.name, status: "draft", profileName: null }));
});

describe("a schedule that can never fire creates nothing", () => {
  it("400s on the 30th of February with no row written", async () => {
    const res = await handleDispatchMission({ instruction: "Do it", dispatchMode: "cron", schedule: "0 0 30 2 *" });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/never fire/);
    expect(mockCreateMission).not.toHaveBeenCalled();
  });

  it("400s on an unrecognised schedule with no row written", async () => {
    const res = await handleDispatchMission({ instruction: "Do it", dispatchMode: "cron", schedule: "whenever" });

    expect(res.status).toBe(400);
    expect(mockCreateMission).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: a real leap-year date creates the mission", async () => {
    const res = await handleDispatchMission({ instruction: "Do it", dispatchMode: "cron", schedule: "0 0 29 2 *" });

    expect(res.status).not.toBe(400);
    expect(mockCreateMission).toHaveBeenCalledTimes(1);
  });
});

describe("an out-of-range timeout is refused, not quietly dropped", () => {
  it("400s on timeoutMinutes 1e9, naming the range, with no row written", async () => {
    const res = await handleDispatchMission({ instruction: "Do it", timeoutMinutes: 1e9 });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/timeoutMinutes.*4320/);
    expect(mockCreateMission).not.toHaveBeenCalled();
  });

  it("400s on a string timeout", async () => {
    const res = await handleDispatchMission({ instruction: "Do it", missionTimeMinutes: "60" });

    expect(res.status).toBe(400);
    expect(mockCreateMission).not.toHaveBeenCalled();
  });
});
