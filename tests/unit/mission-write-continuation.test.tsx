/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { useMissionsPage } from "@/hooks/useMissionsPage";
import type { MissionRow } from "@/hooks/missions-page-types";
import { queryWrapper } from "../helpers/render-with-query";
import { fetchMap, jsonResponse, type FetchAnswer } from "../helpers/fetch-map";
import { detail, LIST, missionRow } from "../helpers/mission-link-query-fixture";
import { pendingLookup } from "../helpers/mission-async-deferred";

// Source-informed oracle: useMissionsPage and its actual composer, dispatch,
// data, query and write helpers run together. Only HTTP arrival order is held.
jest.mock("next/navigation", () => ({
  usePathname: () => "/work/missions", useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
type Action = "cancel" | "update" | "promote";
const actions: Action[] = ["cancel", "update", "promote"];
const resources = [LIST, "/api/templates", "/api/mission-categories"];
const originalFetch = global.fetch;
let rows: MissionRow[], answerA: MissionRow, answerB: MissionRow;
let answers: Record<string, FetchAnswer>;
let wire: { url: string; method: string; body: Record<string, unknown> }[];
let unexpected: string[];
let writeReply: ReturnType<typeof pendingLookup<Response>>;
let detailB: ReturnType<typeof pendingLookup<Response>> | undefined;
let refreshes: Map<string, ReturnType<typeof pendingLookup<Response>>>;
let startedAt: number;

async function drain() {
  for (let turn = 0; turn < 5; turn++) {
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
  }
}
const reads = (url: string) => wire.filter(call => call.method === "GET" && call.url === url).length;
const writes = () => wire.filter(call => call.method === "POST");
beforeEach(() => {
  jest.useFakeTimers(); startedAt = Date.now();
  window.history.replaceState({}, "", "/work/missions"); localStorage.clear();
  answerA = { ...missionRow("A", "Original A"), result: "Original result" };
  answerB = missionRow("B", "Current B detail", "Distinct B instruction");
  rows = [answerA, missionRow("B", "Original B list")];
  wire = []; unexpected = []; detailB = undefined;
  writeReply = pendingLookup<Response>(); refreshes = new Map();
  answers = {
    [LIST]: { body: { data: { missions: rows } } },
    "/api/templates": { body: { data: { templates: [] } } },
    "/api/mission-categories": { body: { data: { categories: [] } } },
  };
  const ordinaryRead = fetchMap(answers);
  global.fetch = jest.fn(async (input, init) => {
    const url = String(input), method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    wire.push({ url, method, body });
    if (url === "/api/missions" && method === "POST") return writeReply.promise;
    if (method === "GET") {
      const gate = refreshes.get(url); if (gate) return gate.promise;
      if (url === "/api/missions?id=A") return detail(answerA);
      if (url === "/api/missions?id=B") return detailB?.promise ?? detail(answerB);
      if (url in answers) return ordinaryRead(input, init) as Promise<Response>;
    }
    unexpected.push(`${method} ${url}`);
    throw new Error(`Unexpected continuation transport: ${method} ${url}`);
  });
});
afterEach(() => {
  cleanup(); global.fetch = originalFetch; jest.clearAllTimers(); jest.useRealTimers();
  expect(unexpected).toEqual([]);
});

async function begin(action: Action) {
  if (action === "promote") { answerA = { ...answerA, status: "queued", queuedForRun: false }; rows[0] = answerA; }
  const hook = renderHook(() => useMissionsPage(), { wrapper: queryWrapper() });
  await drain();
  expect(hook.result.current.loading).toBe(false);
  act(() => hook.result.current.setExpandedId("A")); await drain();
  expect(hook.result.current.detail?.mission).toEqual(answerA);
  if (action !== "cancel") {
    act(() => hook.result.current.handleEdit(answerA)); await drain();
    expect(hook.result.current.editingId).toBe("A");
  }
  let operation!: Promise<void>;
  act(() => { operation = action === "cancel" ? hook.result.current.handleCancel("A") : hook.result.current.handleCreate(); });
  await drain();
  // Every outcome assertion is preceded by proof that the intended real branch
  // sent the write. In particular, promote uses a draft and never dispatches.
  expect(writes()).toHaveLength(1);
  expect(writes()[0]).toMatchObject({ url: "/api/missions", method: "POST", body: { action, missionId: "A" } });
  if (action === "cancel") expect(hook.result.current.cancellingMissionId).toBe("A");
  else expect(hook.result.current.dispatching).toBe(true);
  return { hook, operation };
}
type Running = Awaited<ReturnType<typeof begin>>;
async function selectHeldB({ hook }: Running) {
  detailB = pendingLookup<Response>();
  act(() => hook.result.current.setExpandedId("B")); await drain();
  expect(reads("/api/missions?id=B")).toBe(1);
  expect(hook.result.current.detailLoading).toBe(true);
  expect(hook.result.current.expandedId).toBe("B");
}
async function confirmAndRefresh(running: Running, action: Action) {
  const before = resources.map(reads);
  answerA = { ...answerA, name: "Confirmed A", result: "Confirmed result", status: action === "cancel" ? "failed" : answerA.status };
  rows = [answerA, missionRow("B", "Refreshed B list")];
  answers[LIST] = { body: { data: { missions: rows } } };
  answers["/api/templates"] = { body: { data: { templates: [{ id: "T", name: "Refreshed template", instruction: "Owned instruction", dispatchMode: "save" }] } } };
  answers["/api/mission-categories"] = { body: { data: { categories: [{ id: "C", name: "Refreshed category", color: "cyan", missionCount: 2, templateCount: 1 }] } } };
  for (const url of resources) refreshes.set(url, pendingLookup<Response>());
  await act(async () => { writeReply.complete(jsonResponse({ data: { mission: { id: "A" } } })); });
  await drain();
  resources.forEach((url, index) => expect(reads(url)).toBeGreaterThan(before[index]));
  // Cancel/promote await all three; update starts them without awaiting. Drain
  // their actual continuations, including any A-detail request, before B lands.
  for (const url of resources) {
    await act(async () => { refreshes.get(url)!.complete(jsonResponse(answers[url].body)); });
    await drain();
  }
  await act(async () => { await running.operation; }); await drain();
}
function expectCurrent({ hook }: Running, id: "A" | "B") {
  expect(Date.now() - startedAt).toBeLessThan(15_000);
  expect({
    selected: hook.result.current.expandedId, detail: hook.result.current.detail?.mission,
    busy: hook.result.current.detailLoading, detailError: hook.result.current.detailLoadError,
    listError: hook.result.current.missionsLoadError, dispatching: hook.result.current.dispatching,
    cancelling: hook.result.current.cancellingMissionId,
    rows: hook.result.current.missions, template: hook.result.current.templates[0]?.name,
    category: hook.result.current.categories[0]?.name,
  }).toEqual({
    selected: id, detail: id === "A" ? answerA : answerB, busy: false, detailError: null,
    listError: null, dispatching: false, cancelling: null, rows,
    template: "Refreshed template", category: "Refreshed category",
  });
}

it.each(actions)("confirmed %s of A cannot invalidate held B detail after selection changes", async action => {
  const running = await begin(action);
  await selectHeldB(running);
  await confirmAndRefresh(running, action);
  await act(async () => { detailB!.complete(detail(answerB)); }); await drain();
  expectCurrent(running, "B");
});

it.each(actions)("confirmed %s refreshes A detail when selection remains A", async action => {
  const running = await begin(action);
  await confirmAndRefresh(running, action);
  expectCurrent(running, "A");
});

it("refused cancel rolls A back, reports refusal and leaves selected B detail usable", async () => {
  const running = await begin("cancel");
  expect(running.hook.result.current.missions.find(row => row.id === "A")).toMatchObject({ status: "failed", result: "Cancelled by user" });
  await selectHeldB(running);
  const before = resources.map(reads);
  await act(async () => { writeReply.complete(jsonResponse({ error: "Owned cancel refusal" }, 409)); await running.operation; });
  await act(async () => { detailB!.complete(detail(answerB)); }); await drain();
  const state = running.hook.result.current;
  expect(Date.now() - startedAt).toBeLessThan(15_000);
  expect({ selected: state.expandedId, detail: state.detail?.mission, busy: state.detailLoading,
    detailError: state.detailLoadError, listError: state.missionsLoadError, cancelling: state.cancellingMissionId,
    dispatching: state.dispatching, rows: state.missions }).toEqual({
    selected: "B", detail: answerB, busy: false, detailError: null, listError: null,
    cancelling: null, dispatching: false, rows,
  });
  expect(resources.map(reads)).toEqual(before);
  render(<>{state.toastElement}</>);
  expect(screen.getByRole("alert")).toHaveTextContent("Owned cancel refusal");
});
