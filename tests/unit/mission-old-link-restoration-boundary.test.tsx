/** @jest-environment jsdom */

import { act, waitFor } from "@testing-library/react";
import type { MissionDetail } from "@/hooks/missions-page-types";
import { pendingLookup } from "../helpers/mission-async-deferred";
import * as oldLink from "../helpers/mission-old-link-boundary";

async function finishRefresh(refresh: Promise<void>, finishLookup: () => void) {
  await act(async () => {
    finishLookup();
    await refresh;
  });
}

beforeEach(oldLink.resetOldLinkBoundary);
afterEach(oldLink.clearOldLinkBoundary);

async function startOverlappingRefreshes() {
  const { result } = oldLink.renderOldLink();
  await oldLink.waitForOldLink(result);
  oldLink.fetchMissionDetail.mockClear();

  const earlierLookup = pendingLookup<MissionDetail | null>();
  const laterLookup = pendingLookup<MissionDetail | null>();
  const lookups = [earlierLookup.promise, laterLookup.promise];
  oldLink.fetchMissionDetail.mockImplementation(() =>
    lookups.shift() ?? Promise.resolve(oldLink.detailFor(oldLink.oldMission)));

  let refreshes!: [Promise<void>, Promise<void>];
  act(() => {
    refreshes = [result.current.fetchData(), result.current.fetchData()];
  });
  await waitFor(() => expect(oldLink.fetchMissionDetail).toHaveBeenCalledTimes(2));
  return { result, earlierLookup, laterLookup, earlierRefresh: refreshes[0], laterRefresh: refreshes[1] };
}

describe("retained old mission after overlapping lookups", () => {
  it("does not fetch or restore a deleted deep-link mission on a later board refresh", async () => {
    const { result, earlierLookup, laterLookup, earlierRefresh, laterRefresh } =
      await startOverlappingRefreshes();

    await finishRefresh(laterRefresh, () =>
      laterLookup.fail(Object.assign(new Error("Mission not found"), { status: 404 })));
    await finishRefresh(earlierRefresh, () =>
      earlierLookup.complete(oldLink.detailFor(oldLink.oldMission)));
    expect(result.current.missions.map((mission) => mission.id)).not.toContain(oldLink.oldId);

    await act(async () => {
      await result.current.fetchData();
    });
    expect(oldLink.fetchMissionDetail).toHaveBeenCalledTimes(2);
    expect(result.current.missions.map((mission) => mission.id)).not.toContain(oldLink.oldId);
    expect(result.current.expandedId).toBeNull();
    expect(result.current.detail).toBeNull();
  });

  it("keeps a valid old deep-link mission through a later board refresh", async () => {
    const { result, earlierLookup, laterLookup, earlierRefresh, laterRefresh } =
      await startOverlappingRefreshes();

    await finishRefresh(earlierRefresh, () =>
      earlierLookup.complete(oldLink.detailFor(oldLink.oldMission)));
    expect(result.current.missions.find((mission) => mission.id === oldLink.oldId)?.status).toBe("queued");
    await finishRefresh(laterRefresh, () =>
      laterLookup.complete(oldLink.detailFor(oldLink.changedMission)));
    oldLink.fetchMissionDetail.mockResolvedValue(oldLink.detailFor(oldLink.changedMission));

    await act(async () => {
      await result.current.fetchData();
    });
    expect(oldLink.fetchMissionDetail).toHaveBeenCalledTimes(3);
    expect(result.current.missions.find((mission) => mission.id === oldLink.oldId)?.status).toBe("successful");
    expect(result.current.expandedId).toBe(oldLink.oldId);
  });
});
