/** @jest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { useMissionsData } from "@/hooks/useMissionsData";
import { jsonResponse } from "../helpers/fetch-map";
import { createMissionLinkQueryFixture, deferred, detail, missionRow, LIST, OLDER } from "../helpers/mission-link-query-fixture";

// Source-informed independent oracle. The real hook, interval, facade and query
// bridge run together; only HTTP responses and elapsed time are controlled.
const feedback = jest.fn();
const options = {
  showToast: feedback,
  applyTemplateToForm: () => null,
  setShowCreate: () => undefined,
};
const mission = (id: string, name = `Owned mission ${id}`) => missionRow(id, name);
let dispose: () => void;
let rows: ReturnType<typeof mission>[];
let olderRow: ReturnType<typeof mission>;
let calls: string[];
let unexpected: string[];
let intercept: (url: string) => Promise<Response> | undefined;
let Provider: ReturnType<typeof createMissionLinkQueryFixture>["Provider"];
const count = (url: string) => calls.filter(call => call === url).length;
async function advance(ms = 0) {
  await act(async () => { await jest.advanceTimersByTimeAsync(ms); });
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  window.history.replaceState({}, "", "/work/missions?mission=older");
  feedback.mockClear();
  rows = [mission("A"), mission("B")]; olderRow = mission("older");
  intercept = () => undefined;
  ({ dispose, Provider, calls, unexpected } = createMissionLinkQueryFixture({
    rows: () => rows, older: () => olderRow, selectedB: () => mission("B"),
    intercept: url => intercept(url),
    writeError: (method, url) => `Unexpected write: ${method} ${url}`,
    readError: url => `Unexpected read: ${url}`,
  }));
});
afterEach(() => {
  cleanup(); dispose();
  jest.restoreAllMocks(); jest.useRealTimers();
  expect(unexpected).toEqual([]);
});
async function pendingLink() {
  const held = deferred<Response>();
  // Hold only the first transport. A legitimate refreshed lookup is allowed.
  intercept = url => url === OLDER && count(OLDER) === 1 ? held.promise : undefined;
  const hook = renderHook(() => useMissionsData(options), { wrapper: Provider });
  await advance();
  expect(count(OLDER)).toBe(1);
  expect(hook.result.current.missions.map(row => row.id)).toEqual(["A", "B"]);
  expect(hook.result.current.expandedId).toBeNull();
  return { hook, held };
}
async function release(held: ReturnType<typeof deferred<Response>>, answer: Response) {
  await act(async () => { held.resolve(answer); });
  await advance();
}
async function pollWithFreshList() {
  const before = count(LIST);
  rows = [mission("A", "Fresh polling row"), mission("B")];
  await advance(15_000);
  expect(count(LIST)).toBeGreaterThan(before);
}
function expectOpened(hook: Awaited<ReturnType<typeof pendingLink>>["hook"]) {
  expect(hook.result.current.expandedId).toBe("older");
  expect(hook.result.current.deepLinkedMissionId).toBe("older");
  expect(hook.result.current.detail?.mission.id).toBe("older");
  expect(hook.result.current.missions.filter(row => row.id === "older")).toHaveLength(1);
  expect(hook.result.current.missionsLoadError).toBeNull();
  expect(window.location.search).toBe("");
  expect(feedback).not.toHaveBeenCalled();
}

it("a successful original older-ID lookup opens the linked mission before polling", async () => {
  const { hook, held } = await pendingLink();
  await release(held, detail(olderRow));
  expectOpened(hook);
});

it.each([1, 2])("an unchanged older-ID link eventually opens when its initial lookup spans %i real polling ticks", async ticks => {
  const { hook, held } = await pendingLink();
  for (let tick = 0; tick < ticks; tick++) await pollWithFreshList();
  expect(hook.result.current.missions.find(row => row.id === "A")?.name).toBe("Fresh polling row");
  await release(held, detail(olderRow));
  // Permit a repair to complete through a fresh lookup on the next poll,
  // without prescribing request count, cancellation or cache internals.
  await pollWithFreshList();
  expectOpened(hook);
});

it("a successfully opened older-ID mission accepts refreshed detail and a user collapse survives polling", async () => {
  const { hook, held } = await pendingLink();
  await release(held, detail(olderRow));
  expectOpened(hook);
  const before = count(OLDER);
  olderRow = mission("older", "Refreshed older mission");
  await pollWithFreshList();
  expect(count(OLDER)).toBeGreaterThan(before);
  expect(hook.result.current.detail?.mission.name).toBe("Refreshed older mission");
  expect(hook.result.current.missions.find(row => row.id === "older")?.name).toBe("Refreshed older mission");
  act(() => hook.result.current.setExpandedId(null));
  await pollWithFreshList();
  expect(hook.result.current.expandedId).toBeNull();
  expect(hook.result.current.detail).toBeNull();
  expect(feedback).not.toHaveBeenCalled();
});

const outcomes = ["found", "missing", "refused"] as const;
function answer(outcome: typeof outcomes[number]) {
  return outcome === "found" ? detail(olderRow)
    : jsonResponse({ error: outcome === "missing" ? "Owned missing mission" : "Owned lookup unavailable" }, outcome === "missing" ? 404 : 503);
}
it.each(outcomes)("a polled initial lookup cannot replace newer selected B or its URL and feedback [%s]", async outcome => {
  const { hook, held } = await pendingLink();
  act(() => hook.result.current.setExpandedId("B"));
  await advance();
  expect(hook.result.current.detail?.mission.id).toBe("B");
  await pollWithFreshList();
  const beforeUrl = window.location.href;
  await release(held, answer(outcome));
  expect(hook.result.current.expandedId).toBe("B");
  expect(hook.result.current.detail?.mission.id).toBe("B");
  expect(hook.result.current.deepLinkedMissionId).toBeNull();
  expect(hook.result.current.missions.map(row => row.id)).toEqual(["A", "B"]);
  expect(hook.result.current.missionsLoadError).toBeNull();
  expect(window.location.href).toBe(beforeUrl);
  expect(feedback).not.toHaveBeenCalled();
});

it.each(outcomes)("an unmounted polled lookup cannot consume the next page URL or emit feedback [%s]", async outcome => {
  const { hook, held } = await pendingLink();
  await pollWithFreshList();
  hook.unmount();
  window.history.replaceState({}, "", "/work/chat?owned=next");
  const beforeUrl = window.location.href;
  const beforeCalls = calls.length;
  await release(held, answer(outcome));
  await advance(15_000);
  expect(window.location.href).toBe(beforeUrl);
  expect(feedback).not.toHaveBeenCalled();
  expect(calls).toHaveLength(beforeCalls);
});

it.each([0, 1])("a current missing older-ID lookup reports absence and consumes only its own link [polls=%i]", async polls => {
  const { hook, held } = await pendingLink();
  if (polls) await pollWithFreshList();
  intercept = url => url === OLDER ? Promise.resolve(answer("missing")) : undefined;
  await release(held, answer("missing"));
  expect(feedback).toHaveBeenCalledTimes(1);
  expect(feedback).toHaveBeenCalledWith(expect.stringContaining("no longer exists"), "error");
  expect(window.location.search).toBe("");
  expect(hook.result.current.expandedId).toBeNull();
  expect(hook.result.current.missions.map(row => row.id)).toEqual(["A", "B"]);
});

it.each([0, 1])("a current refused older-ID lookup keeps its URL and exposes a retryable error [polls=%i]", async polls => {
  const { hook, held } = await pendingLink();
  if (polls) await pollWithFreshList();
  await release(held, answer("refused"));
  expect(hook.result.current.missionsLoadError).toBe("Owned lookup unavailable");
  expect(window.location.search).toBe("?mission=older");
  expect(feedback).not.toHaveBeenCalled();
  const before = count(OLDER);
  await act(async () => { await hook.result.current.loadMissions(); });
  await advance();
  expect(count(OLDER)).toBeGreaterThan(before);
  expectOpened(hook);
});
