/** @jest-environment jsdom */

import { act, waitFor } from "@testing-library/react";
import type { MissionDetail } from "@/hooks/missions-page-types";
import {
  changedMission, clearOldLinkBoundary, detailFor, fetchMissionDetail, oldId, oldMission,
  renderOldLink, resetOldLinkBoundary, waitForOldLink,
} from "../helpers/mission-old-link-boundary";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  resetOldLinkBoundary();
});

afterEach(() => {
  clearOldLinkBoundary();
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
