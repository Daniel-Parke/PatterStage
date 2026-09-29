/** @jest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { useMissionsData } from "@/hooks/useMissionsData";
import type { MissionDetail, MissionRow } from "@/hooks/missions-page-types";

const oldId = "oldest-of-201";
const oldMission = {
  id: oldId, name: "Old mission", status: "queued", queuedForRun: false,
} as MissionRow;
const changedMission = { ...oldMission, status: "successful" } as MissionRow;

const fetchMissions = jest.fn(async (): Promise<MissionRow[]> => []);
const fetchTemplates = jest.fn(async () => []);
const fetchCategories = jest.fn(async () => []);
const fetchMissionDetail = jest.fn(async (_id: string): Promise<MissionDetail | null> => ({
  mission: oldMission, run: null, schedule: null,
}));

jest.mock("@/hooks/useMissionsApi", () => ({
  useMissionsApi: () => ({ fetchMissions, fetchTemplates, fetchCategories, fetchMissionDetail }),
}));

const showToast = jest.fn();
const applyTemplateToForm = jest.fn();
const setShowCreate = jest.fn();

function renderOldLink() {
  return renderHook(() => useMissionsData({
    showToast,
    applyTemplateToForm,
    setShowCreate,
  }));
}

async function waitForOldLink(result: ReturnType<typeof renderOldLink>["result"]) {
  await waitFor(() => {
    expect(result.current.missions.map((mission) => mission.id)).toContain(oldId);
    expect(result.current.expandedId).toBe(oldId);
    expect(result.current.detail?.mission.id).toBe(oldId);
  });
}

beforeEach(() => {
  window.history.replaceState({}, "", `/work/missions?mission=${oldId}`);
  fetchMissions.mockClear();
  fetchTemplates.mockClear();
  fetchCategories.mockClear();
  fetchMissionDetail.mockReset();
  fetchMissionDetail.mockResolvedValue({ mission: oldMission, run: null, schedule: null });
  showToast.mockClear();
});

afterEach(() => {
  window.history.replaceState({}, "", "/work/missions");
});

describe("a mission retained from an old published deep link", () => {
  it("opens a by-ID mission outside the first 200 list rows", async () => {
    const { result } = renderOldLink();
    await waitForOldLink(result);
    expect(fetchMissions).toHaveBeenCalled();
    expect(fetchMissionDetail).toHaveBeenCalledWith(oldId);
  });

  it("removes the retained row and expanded detail after a by-ID 404 on board refresh", async () => {
    const { result } = renderOldLink();
    await waitForOldLink(result);
    fetchMissionDetail.mockRejectedValue(Object.assign(new Error("Mission not found"), { status: 404 }));

    await act(async () => {
      await result.current.fetchData();
      result.current.fetchDetail(oldId, false);
    });

    await waitFor(() => {
      expect(result.current.missions.map((mission) => mission.id)).not.toContain(oldId);
      expect(result.current.expandedId).toBeNull();
      expect(result.current.detail).toBeNull();
    });
  });

  it("refreshes the retained row's visible status from the by-ID response", async () => {
    const { result } = renderOldLink();
    await waitForOldLink(result);
    fetchMissionDetail.mockResolvedValue({ mission: changedMission, run: null, schedule: null });

    await act(async () => {
      await result.current.fetchData();
      result.current.fetchDetail(oldId, false);
    });

    await waitFor(() => {
      expect(result.current.missions.find((mission) => mission.id === oldId)?.status).toBe("successful");
    });
  });

  it("does not silently show a retained row as current after a temporary by-ID 5xx", async () => {
    const { result } = renderOldLink();
    await waitForOldLink(result);
    fetchMissionDetail.mockRejectedValue(Object.assign(new Error("Mission lookup failed"), { status: 503 }));

    await act(async () => {
      await result.current.fetchData();
      result.current.fetchDetail(oldId, false);
    });

    await waitFor(() => {
      const stillShown = result.current.missions.some((mission) => mission.id === oldId);
      const errorToastShown = showToast.mock.calls.some(([, type]) => type === "error");
      expect(stillShown && !result.current.missionsLoadError && !errorToastShown).toBe(false);
    });
  });
});
