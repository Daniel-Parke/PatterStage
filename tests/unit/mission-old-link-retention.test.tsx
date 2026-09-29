/** @jest-environment jsdom */

import { act, waitFor } from "@testing-library/react";
import {
  changedMission, clearOldLinkBoundary, fetchMissionDetail, fetchMissions, oldId,
  renderOldLink, resetOldLinkBoundary, showToast, waitForOldLink,
} from "../helpers/mission-old-link-boundary";

beforeEach(() => {
  resetOldLinkBoundary();
});

afterEach(() => {
  clearOldLinkBoundary();
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
