/** @jest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { useMissionsData } from "@/hooks/useMissionsData";
import type { MissionDetail, MissionRow } from "@/hooks/missions-page-types";

const oldId = "oldest-of-201";
const oldMission = {
  id: oldId, name: "Old mission", status: "queued", queuedForRun: false,
} as MissionRow;
const changedMission = { ...oldMission, status: "successful" } as MissionRow;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function detailFor(mission: MissionRow): MissionDetail {
  return { mission, run: null, schedule: null };
}

const fetchMissions = jest.fn(async (): Promise<MissionRow[]> => []);
const fetchTemplates = jest.fn(async () => []);
const fetchCategories = jest.fn(async () => []);
const fetchMissionDetail = jest.fn<Promise<MissionDetail | null>, [string]>();

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
  fetchMissionDetail.mockResolvedValue(detailFor(oldMission));
  showToast.mockClear();
});

afterEach(() => {
  window.history.replaceState({}, "", "/work/missions");
});

describe("overlapping refreshes of a mission retained from an old deep link", () => {
  it("does not restore a deleted row or expanded detail from an earlier stale lookup", async () => {
    const { result } = renderOldLink();
    await waitForOldLink(result);
    fetchMissionDetail.mockClear();

    const earlierLookup = deferred<MissionDetail | null>();
    const laterLookup = deferred<MissionDetail | null>();
    fetchMissionDetail
      .mockImplementationOnce(() => earlierLookup.promise)
      .mockImplementationOnce(() => laterLookup.promise);

    let earlierRefresh!: Promise<void>;
    let laterRefresh!: Promise<void>;
    act(() => {
      earlierRefresh = result.current.fetchData();
      laterRefresh = result.current.fetchData();
    });
    await waitFor(() => expect(fetchMissionDetail).toHaveBeenCalledTimes(2));

    await act(async () => {
      laterLookup.reject(Object.assign(new Error("Mission not found"), { status: 404 }));
      await laterRefresh;
    });
    await waitFor(() => {
      expect(result.current.missions.map((mission) => mission.id)).not.toContain(oldId);
      expect(result.current.expandedId).toBeNull();
      expect(result.current.detail).toBeNull();
    });

    await act(async () => {
      earlierLookup.resolve(detailFor(oldMission));
      await earlierRefresh;
    });
    expect(result.current.missions.map((mission) => mission.id)).not.toContain(oldId);
    expect(result.current.expandedId).toBeNull();
    expect(result.current.detail).toBeNull();
  });

  it("updates the retained row status when overlapping refreshes complete in order", async () => {
    const { result } = renderOldLink();
    await waitForOldLink(result);
    fetchMissionDetail.mockClear();

    const earlierLookup = deferred<MissionDetail | null>();
    const laterLookup = deferred<MissionDetail | null>();
    fetchMissionDetail
      .mockImplementationOnce(() => earlierLookup.promise)
      .mockImplementationOnce(() => laterLookup.promise);

    let earlierRefresh!: Promise<void>;
    let laterRefresh!: Promise<void>;
    act(() => {
      earlierRefresh = result.current.fetchData();
      laterRefresh = result.current.fetchData();
    });
    await waitFor(() => expect(fetchMissionDetail).toHaveBeenCalledTimes(2));

    await act(async () => {
      earlierLookup.resolve(detailFor(oldMission));
      await earlierRefresh;
    });
    expect(result.current.missions.find((mission) => mission.id === oldId)?.status).toBe("queued");

    await act(async () => {
      laterLookup.resolve(detailFor(changedMission));
      await laterRefresh;
    });
    expect(result.current.missions.find((mission) => mission.id === oldId)?.status).toBe("successful");
    expect(result.current.expandedId).toBe(oldId);
  });
});
