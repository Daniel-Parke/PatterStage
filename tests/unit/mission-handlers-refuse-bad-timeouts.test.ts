/** @jest-environment node */

// T-0088, found by mutation: the dispatch oracle pinned its 400, and the
// same two lines in update and promote had none. A guard that exists in
// three handlers and is tested in one can lose two of them silently.

jest.mock("@/lib/models-repository", () => ({ findModelByModelId: () => null }));
jest.mock("@/lib/db", () => ({ getDb: jest.fn(), ensureDb: jest.fn(), now: () => "t", uuid: () => "u", inTransaction: <T,>(fn: () => T) => fn() }));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/missions/mission-response", () => ({ missionResponse: (m: unknown) => ({ mission: m }) }));

const mockUpdateMission = jest.fn();
jest.mock("@/lib/missions/mission-repository", () => ({
  ...(jest.requireActual("@/lib/missions/mission-repository") as object),
  updateMission: (...a: unknown[]) => mockUpdateMission(...a),
  getMission: () => ({ id: "m_1", name: "M", status: "running", prompt: "p", localDirs: [], references: [], skills: [], suggestedToolsets: [], goals: [] }),
}));
const mockPromote = jest.fn();
jest.mock("@/lib/missions/mission-promote-handler", () => ({ promoteMission: (...a: unknown[]) => mockPromote(...a) }));
jest.mock("@/lib/missions/mission-category-repository", () => ({ getMissionCategory: () => null }));

import { handleUpdateMission } from "@/lib/missions/mission-handlers/update";
import { handlePromoteMission } from "@/lib/missions/mission-handlers/promote";

beforeEach(() => jest.clearAllMocks());

it("update refuses timeoutMinutes 1e9 with a 400 and writes nothing", async () => {
  const res = await handleUpdateMission({ id: "m_1", timeoutMinutes: 1e9 });

  expect(res.status).toBe(400);
  expect(((await res.json()) as { error: string }).error).toMatch(/timeoutMinutes.*4320/);
  expect(mockUpdateMission).not.toHaveBeenCalled();
});

it("promote refuses a string missionTimeMinutes with a 400 and promotes nothing", async () => {
  const res = await handlePromoteMission({ missionId: "m_1", dispatchMode: "save", missionTimeMinutes: "60" });

  expect(res.status).toBe(400);
  expect(((await res.json()) as { error: string }).error).toMatch(/missionTimeMinutes/);
  expect(mockPromote).not.toHaveBeenCalled();
});
