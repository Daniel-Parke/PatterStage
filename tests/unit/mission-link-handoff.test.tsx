/** @jest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { useMissionsData } from "@/hooks/useMissionsData";
import { jsonResponse } from "../helpers/fetch-map";
import { createMissionLinkQueryFixture, deferred, detail, missionRow, LIST, OLDER } from "../helpers/mission-link-query-fixture";

// Source-informed independent handoff oracle. The real mission hook, facade,
// query bridge and selection effect run; only transport ordering is controlled.
const feedback = jest.fn();
const options = { showToast: feedback, applyTemplateToForm: () => null, setShowCreate: () => undefined };
const mission = (id: string, name = `Owned ${id}`, prompt = `Instruction ${id}`) => missionRow(id, name, prompt);
let dispose: () => void;
let rows: ReturnType<typeof mission>[];
let fresh: ReturnType<typeof mission>;
let calls: string[];
let unexpected: string[];
let intercept: (url: string) => Promise<Response> | undefined;
let Provider: ReturnType<typeof createMissionLinkQueryFixture>["Provider"];
const count = (url: string) => calls.filter(call => call === url).length;
async function settle() {
  for (let turn = 0; turn < 5; turn++) {
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
  }
}
beforeEach(() => {
  jest.useFakeTimers();
  window.history.replaceState({}, "", "/work/missions?mission=older");
  feedback.mockClear();
  rows = [mission("A"), mission("B")];
  fresh = mission("older", "Fresh detail name", "Fresh detail-only instruction");
  intercept = () => undefined;
  ({ dispose, Provider, calls, unexpected } = createMissionLinkQueryFixture({
    rows: () => rows, older: () => fresh, selectedB: () => mission("B"),
    intercept: url => intercept(url),
    writeError: () => "Unexpected mission write",
    readError: url => `Unexpected mission read: ${url}`,
  }));
});
afterEach(() => {
  cleanup(); dispose(); jest.useRealTimers();
  expect(unexpected).toEqual([]);
});
async function pendingLink() {
  const old = deferred<Response>();
  intercept = url => url === OLDER && count(OLDER) === 1 ? old.promise : undefined;
  const hook = renderHook(() => useMissionsData(options), { wrapper: Provider });
  await settle();
  expect(count(OLDER)).toBe(1);
  expect(hook.result.current.expandedId).toBeNull();
  expect(hook.result.current.missions.map(row => row.id)).toEqual(["A", "B"]);
  return { hook, old };
}
async function handoffToList(hook: Awaited<ReturnType<typeof pendingLink>>["hook"]) {
  const before = count(LIST);
  rows = [mission("A"), mission("B"), mission("older", "Current list name")];
  await act(async () => { await hook.result.current.loadMissions(); });
  // Drain React's selection effect BEFORE settling the older transport. Do not
  // mock fetchMissionDetail or require a particular cancellation strategy.
  await settle();
  expect(count(LIST)).toBeGreaterThan(before);
  expect(hook.result.current.expandedId).toBe("older");
  expect(hook.result.current.missions.find(row => row.id === "older")?.name).toBe("Current list name");
  expect(window.location.search).toBe("");
}
async function release(old: ReturnType<typeof deferred<Response>>, response: Response) {
  await act(async () => { old.resolve(response); }); await settle();
}

it.each(["stale success", "old 404", "old 503"])("a refreshed-list handoff obtains current detail instead of adopting the initial lookup [%s]", async outcome => {
  const { hook, old } = await pendingLink();
  await handoffToList(hook);
  await release(old, outcome === "stale success"
    ? detail(mission("older", "Obsolete detail name", "Obsolete instruction"))
    : jsonResponse({ error: outcome === "old 404" ? "Owned obsolete missing" : "Owned obsolete refusal" }, outcome === "old 404" ? 404 : 503));
  expect({
    selected: hook.result.current.expandedId,
    detailName: hook.result.current.detail?.mission.name,
    detailPrompt: hook.result.current.detail?.mission.prompt,
    detailError: hook.result.current.detailLoadError,
    listError: hook.result.current.missionsLoadError,
  }).toEqual({ selected: "older", detailName: fresh.name, detailPrompt: fresh.prompt, detailError: null, listError: null });
  expect(hook.result.current.detailLoading).toBe(false);
  expect(hook.result.current.missions.find(row => row.id === "older")?.name).toBe("Current list name");
  expect(window.location.search).toBe("");
  expect(feedback).not.toHaveBeenCalled();
});

it("a valid original older-ID lookup still opens without a list handoff", async () => {
  const { hook, old } = await pendingLink();
  await release(old, detail(fresh));
  expect(hook.result.current.expandedId).toBe("older");
  expect(hook.result.current.detail?.mission).toEqual(fresh);
  expect(hook.result.current.detailLoadError).toBeNull();
  expect(hook.result.current.missions.map(row => row.id)).toContain("older");
  expect(window.location.search).toBe("");
  expect(feedback).not.toHaveBeenCalled();
});

it("a linked mission already present in the initial list loads its current detail normally", async () => {
  rows.push(mission("older", "Current list name"));
  const hook = renderHook(() => useMissionsData(options), { wrapper: Provider });
  await settle();
  expect(count(OLDER)).toBeGreaterThan(0);
  expect(hook.result.current.expandedId).toBe("older");
  expect(hook.result.current.detail?.mission).toEqual(fresh);
  expect(hook.result.current.detailLoadError).toBeNull();
  expect(window.location.search).toBe("");
  expect(feedback).not.toHaveBeenCalled();
});

it("selecting B after the refreshed-list handoff keeps B when the original older-ID lookup settles", async () => {
  const { hook, old } = await pendingLink();
  await handoffToList(hook);
  act(() => hook.result.current.setExpandedId("B")); await settle();
  expect(hook.result.current.detail?.mission.id).toBe("B");
  await release(old, detail(mission("older", "Obsolete detail name")));
  expect(hook.result.current.expandedId).toBe("B");
  expect(hook.result.current.detail?.mission.id).toBe("B");
  expect(hook.result.current.detailLoadError).toBeNull();
  expect(hook.result.current.missionsLoadError).toBeNull();
  expect(feedback).not.toHaveBeenCalled();
});
