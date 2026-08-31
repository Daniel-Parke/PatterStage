/** @jest-environment node */

// T-0071 · F6 — two refusals that name a verb and not a call.
//
// The reporter described a loop: `update` says use promote, promote says use
// update. That is not quite right and the correction matters — the two guards
// are complementary, not circular, and one of them (promote + save) is the
// rename that actually works. But the messages are what made it read as a trap:
//
//   update:  "Use promote for draft or queued missions; update is for running missions"
//   promote: "Use update for running missions; promote applies to drafts and queued missions"
//   promote: "Use re-dispatch for completed missions"
//
// Each names a WORD. None says what to send. `dispatchMode` is required by
// promote and is not mentioned in either, so an operator who follows the advice
// literally gets a third 400 telling them so — and that one does not enumerate
// the four legal values either.
//
// The bar is: a person holding only the refusal can compose the next request.

const mockGetMission = jest.fn();
const mockUpdateMission = jest.fn();
jest.mock("@/lib/missions/mission-repository", () => ({
  getMission: (...a: unknown[]) => mockGetMission(...a),
  updateMission: (...a: unknown[]) => mockUpdateMission(...a),
}));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/schedules-repository", () => ({ createSchedule: jest.fn(() => ({ id: "s1" })) }));
jest.mock("@/lib/missions/mission-dispatch", () => ({
  dispatchMissionNow: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("@/lib/missions/mission-queue-tick", () => ({ runMissionQueueTick: jest.fn() }));
jest.mock("@/lib/missions/mission-category-repository", () => ({ getCategory: jest.fn(() => null) }));

import type { Mission } from "@/lib/missions/mission-types";
import { handleUpdateMission } from "@/lib/missions/mission-handlers/update";
import { promoteMission } from "@/lib/missions/mission-promote-handler";

function mission(over: Partial<Mission> = {}): Mission {
  return {
    id: "m1",
    name: "Demo",
    prompt: "do the thing",
    status: "queued",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateMission.mockImplementation((_id: string, u: Record<string, unknown>) => ({
    ...mission(),
    ...u,
  }));
});

async function updateError(status: Mission["status"]): Promise<string> {
  mockGetMission.mockReturnValue(mission({ status }));
  const res = handleUpdateMission({ id: "m1", name: "x" });
  return ((await res.json()) as { error: string }).error;
}
async function promoteError(
  status: Mission["status"],
  body: Record<string, unknown> = {},
): Promise<string> {
  mockGetMission.mockReturnValue(mission({ status }));
  const r = await promoteMission({ missionId: "m1", ...body } as never);
  return (r as { error: string }).error;
}

describe("update's refusal composes the request that would work", () => {
  it("names the action, the mode and the mission", async () => {
    const err = await updateError("queued");
    // The whole call, not the words in it. Mutation found the hole: deleting
    // the clause that carries the JSON left /promote/, /dispatchMode/ and
    // /save/ all still matching elsewhere in the sentence, so the assertion
    // passed on a message that no longer told anyone what to send.
    expect(err).toContain('{"action":"promote"');
    expect(err).toContain('"dispatchMode":"save"');
    expect(err).toContain('"missionId":"m1"');
  });

  it("says which state it saw, so the advice is checkable", async () => {
    expect(await updateError("queued")).toMatch(/queued/);
    expect(await updateError("successful")).toMatch(/successful/);
  });
});

describe("promote's refusals do the same", () => {
  it("tells a running mission's caller what update needs", async () => {
    const err = await promoteError("dispatched", { dispatchMode: "save" });
    expect(err).toMatch(/update/);
    expect(err).toMatch(/dispatched/);
  });

  it("does not send a completed mission to a verb that does not exist", async () => {
    // "Use re-dispatch for completed missions" names an action the API has no
    // case for: the switch is dispatch | promote | update | cancel | delete.
    // An operator searching the docs for `re-dispatch` finds nothing.
    const err = await promoteError("successful", { dispatchMode: "save" });
    expect(err).not.toMatch(/re-dispatch/);
    expect(err).toMatch(/dispatch/);
  });

  it("enumerates the legal modes when the mode is missing", async () => {
    const err = await promoteError("queued");
    for (const mode of ["save", "now", "cron", "queue"]) expect(err).toContain(mode);
  });
});

describe("GREEN CONTROLS: the guards still guard", () => {
  it("update still refuses a queued mission", async () => {
    mockGetMission.mockReturnValue(mission({ status: "queued" }));
    expect(handleUpdateMission({ id: "m1", name: "x" }).status).toBe(400);
  });

  it("promote still accepts the queued mission update refused", async () => {
    // The pair is complementary, not circular, and this is the assertion that
    // says so. The reporter read it as a trap; the messages were the trap.
    mockGetMission.mockReturnValue(mission({ status: "queued" }));
    const r = await promoteMission({
      missionId: "m1",
      dispatchMode: "save",
      name: "A better name",
    } as never);
    expect((r as { ok: boolean }).ok).toBe(true);
  });
});
