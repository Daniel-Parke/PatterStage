import { renderHook, waitFor } from "@testing-library/react";
import type { MissionDetail, MissionRow } from "@/hooks/missions-page-types";

export const oldId = "oldest-of-201";
export const oldMission = {
  id: oldId, name: "Old mission", status: "queued", queuedForRun: false,
} as MissionRow;
export const changedMission = { ...oldMission, status: "successful" } as MissionRow;

export function detailFor(mission: MissionRow): MissionDetail {
  return { mission, run: null, schedule: null };
}

export const fetchMissions = jest.fn(async (): Promise<MissionRow[]> => []);
const fetchTemplates = jest.fn(async () => []);
const fetchCategories = jest.fn(async () => []);
export const fetchMissionDetail = jest.fn<Promise<MissionDetail | null>, [string]>();

jest.mock("@/hooks/useMissionsApi", () => ({
  useMissionsApi: () => ({ fetchMissions, fetchTemplates, fetchCategories, fetchMissionDetail }),
}));

import { useMissionsData } from "@/hooks/useMissionsData";

export const showToast = jest.fn();
const applyTemplateToForm = jest.fn();
const setShowCreate = jest.fn();

export function renderOldLink() {
  return renderHook(() => useMissionsData({
    showToast,
    applyTemplateToForm,
    setShowCreate,
  }));
}

export async function waitForOldLink(result: ReturnType<typeof renderOldLink>["result"]) {
  await waitFor(() => {
    expect(result.current.missions.map((mission) => mission.id)).toContain(oldId);
    expect(result.current.expandedId).toBe(oldId);
    expect(result.current.detail?.mission.id).toBe(oldId);
  });
}

export function resetOldLinkBoundary(): void {
  window.history.replaceState({}, "", `/work/missions?mission=${oldId}`);
  fetchMissions.mockClear();
  fetchTemplates.mockClear();
  fetchCategories.mockClear();
  fetchMissionDetail.mockReset();
  fetchMissionDetail.mockResolvedValue(detailFor(oldMission));
  showToast.mockClear();
}

export function clearOldLinkBoundary(): void {
  window.history.replaceState({}, "", "/work/missions");
}
