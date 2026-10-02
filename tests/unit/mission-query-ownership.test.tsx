/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMissionsPage } from "@/hooks/useMissionsPage";
import { useMissionCategories } from "@/hooks/useMissionCategories";
import { useDashboard } from "@/hooks/useDashboard";
import MissionsPage from "@/app/work/missions/page";
import type { MissionRow } from "@/hooks/missions-page-types";
import type { MissionTemplate } from "@/components/missions/TemplateModals";
import type { ManagedCategory } from "@/components/missions/CategoryManagerModal";
import { jsonResponse } from "../helpers/fetch-map";

jest.mock("next/navigation", () => ({ usePathname: () => "/work/missions", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const row = (id: string, name = `Mission ${id}`): MissionRow => ({ id, name, status: "dispatched", queuedForRun: false, prompt: `Instruction ${id}` } as MissionRow);
const template = (dispatchMode = "save"): MissionTemplate => ({ id: "t", name: "Fixture template", icon: "Zap", color: "cyan", instruction: "Template instruction", description: "", dispatchMode } as MissionTemplate);
const previousFetch = global.fetch;
let client: QueryClient, missions: MissionRow[], templates: MissionTemplate[], categories: ManagedCategory[];
let override: (url: string, init?: RequestInit) => Promise<Response> | undefined;
let calls: { url: string; method: string; body: Record<string, unknown> }[];
function Wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
beforeEach(() => {
  window.history.replaceState({}, "", "/work/missions"); localStorage.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  missions = [row("A"), row("B")]; templates = [template()]; categories = [{ id: "c", name: "Old category", color: "cyan", missionCount: 0, templateCount: 1 }]; calls = []; override = () => undefined;
  global.fetch = jest.fn(async (input, init) => {
    const url = String(input), method = init?.method ?? "GET", body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ url, method, body }); const held = override(url, init); if (held) return held;
    if (method !== "GET") return jsonResponse({ data: { success: true, category: { id: "c" }, mission: row("A") } });
    if (url.startsWith("/api/missions?limit=")) return jsonResponse({ data: { missions } });
    if (url.startsWith("/api/missions?id=")) { const mission = missions.find(m => m.id === new URL(url, "http://fixture").searchParams.get("id")); return mission ? jsonResponse({ data: { mission, run: null, schedule: null } }) : jsonResponse({ error: "Not found" }, 404); }
    if (url === "/api/templates") return jsonResponse({ data: { templates } });
    if (url === "/api/mission-categories") return jsonResponse({ data: { categories } });
    if (url === "/api/models") return jsonResponse({ data: { models: [] } });
    if (url === "/api/models/defaults") return jsonResponse({ data: { defaults: {}, modelReadiness: { ready: true } } });
    if (url === "/api/stats") return jsonResponse({ data: { stats: {} } });
    return jsonResponse({ data: { profiles: [], skills: [], templates: [], categories: [], schedules: [], sessions: [], flags: {} } });
  });
});
afterEach(() => { client.clear(); global.fetch = previousFetch; jest.useRealTimers(); });
async function mount() {
  const h = renderHook(() => useMissionsPage(), { wrapper: Wrapper });
  await waitFor(() => expect(h.result.current.loading).toBe(false)); expect(h.result.current.missions).toHaveLength(2); return h;
}

it("late detail cannot replace the newly selected mission", async () => {
  const h = await mount(), held = deferred<Response>();
  override = url => url === "/api/missions?id=A" ? held.promise : undefined;
  act(() => h.result.current.setExpandedId("A")); await waitFor(() => expect(calls.some(c => c.url.endsWith("?id=A"))).toBe(true));
  act(() => h.result.current.setExpandedId("B")); await waitFor(() => expect(h.result.current.detail?.mission.id).toBe("B"));
  await act(async () => held.resolve(jsonResponse({ data: { mission: row("A"), run: null, schedule: null } })));
  expect(h.result.current.expandedId).toBe("B"); expect(h.result.current.detail?.mission.id).toBe("B"); expect(h.result.current.detailLoading).toBe(false);
});

it.each(["collapsed", "deleted"])("late detail cannot reopen a collapsed or deleted mission [%s]", async action => {
  const h = await mount(), held = deferred<Response>(); override = url => url === "/api/missions?id=A" ? held.promise : undefined;
  act(() => h.result.current.setExpandedId("A")); await waitFor(() => expect(calls.some(c => c.url.endsWith("?id=A"))).toBe(true));
  if (action === "collapsed") act(() => h.result.current.setExpandedId(null));
  else { missions = [row("B")]; await act(async () => { await h.result.current.handleDelete("A"); }); }
  await act(async () => held.resolve(jsonResponse({ data: { mission: row("A"), run: null, schedule: null } })));
  expect(h.result.current.expandedId).toBeNull(); expect(h.result.current.detail).toBeNull();
  if (action === "deleted") expect(h.result.current.missions.map(m => m.id)).toEqual(["B"]);
});

it("obsolete list failure cannot replace a newer successful list", async () => {
  const h = await mount(), old = deferred<Response>(); let started = 0;
  override = url => url.startsWith("/api/missions?limit=") && ++started === 1 ? old.promise : undefined;
  let first!: Promise<void>; act(() => { first = h.result.current.fetchData(); });
  await waitFor(() => expect(started).toBe(1)); missions = [row("A", "Current server name"), row("B")];
  // Supported cancellation/invalidation supersedes the old refresh without
  // bypassing the cache or requiring ordinary simultaneous reads to duplicate I/O.
  await act(async () => { await client.cancelQueries(); await client.invalidateQueries(); });
  await act(async () => { await h.result.current.fetchData(); });
  expect(started).toBeGreaterThan(1);
  expect(h.result.current.missions[0].name).toBe("Current server name"); expect(h.result.current.missionsLoadError).toBeNull();
  await act(async () => { old.resolve(jsonResponse({ error: "Obsolete list failure" }, 500)); await first; });
  expect(h.result.current.missions[0].name).toBe("Current server name"); expect(h.result.current.missionsLoadError).toBeNull();
});

it("simultaneous mission refreshes may share the same successful response", async () => {
  const h = await mount(), held = deferred<Response>();
  override = url => url.startsWith("/api/missions?limit=") ? held.promise : undefined;
  let first!: Promise<void>, second!: Promise<void>;
  act(() => { first = h.result.current.fetchData(); second = h.result.current.fetchData(); });
  await act(async () => { held.resolve(jsonResponse({ data: { missions: [row("A", "Shared answer"), row("B")] } })); await Promise.all([first, second]); });
  expect(h.result.current.missions[0].name).toBe("Shared answer"); expect(h.result.current.missionsLoadError).toBeNull();
});

it.each(["list", "templates", "categories", "detail"])("mission read failures remain visible without repeated read toasts [%s]", async resource => {
  jest.useFakeTimers();
  const target = { list: "/api/missions?limit=200", templates: "/api/templates", categories: "/api/mission-categories", detail: "/api/missions?id=A" }[resource]!;
  override = url => url === target ? Promise.resolve(jsonResponse({ error: `Owned ${resource} failure` }, 500)) : undefined;
  render(<Wrapper><MissionsPage /></Wrapper>);
  if (resource === "detail") { await screen.findByText("Mission A"); fireEvent.click(screen.getByText("Mission A")); }
  await waitFor(() => expect(screen.getAllByText(`Owned ${resource} failure`).length).toBeGreaterThan(0));
  expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
  const initialReads = calls.filter(c => c.url === target).length;
  await act(async () => { await jest.advanceTimersByTimeAsync(15001); });
  expect(calls.filter(c => c.url === target).length).toBeGreaterThan(initialReads);
  expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
  expect(screen.getAllByText(`Owned ${resource} failure`)).toHaveLength(1);
  const retry = screen.getAllByRole("button", { name: /retry/i })[0]; expect(retry).toBeDefined();
  const beforeRetry = calls.filter(c => c.url === target).length;
  fireEvent.click(retry);
  await waitFor(() => expect(calls.filter(c => c.url === target).length).toBeGreaterThan(beforeRetry));
  expect(screen.getAllByText(`Owned ${resource} failure`)).toHaveLength(1);
});

it("mission polling pauses while hidden and refreshes on return", async () => {
  jest.useFakeTimers();
  const visibility = jest.spyOn(document, "visibilityState", "get"); visibility.mockReturnValue("visible");
  const h = await mount();
  try {
    const count = () => calls.filter(c => c.url === "/api/missions?limit=200").length;
    const initial = count(); await act(async () => { await jest.advanceTimersByTimeAsync(15001); }); expect(count()).toBeGreaterThan(initial);
    act(() => { visibility.mockReturnValue("hidden"); document.dispatchEvent(new Event("visibilitychange")); });
    const hidden = count(); await act(async () => { await jest.advanceTimersByTimeAsync(45000); }); expect(count()).toBe(hidden);
    missions = [row("A", "Returned server name"), row("B")];
    await act(async () => { visibility.mockReturnValue("visible"); document.dispatchEvent(new Event("visibilitychange")); });
    await waitFor(() => expect(h.result.current.missions[0].name).toBe("Returned server name"));
  } finally { h.unmount(); visibility.mockRestore(); }
});

it.each(["list", "templates", "categories", "detail"])("a mission read retry refreshes only the relevant error state [%s]", async resource => {
  const target = { list: "/api/missions?limit=200", templates: "/api/templates", categories: "/api/mission-categories", detail: "/api/missions?id=A" }[resource]!;
  override = url => url === target ? Promise.resolve(jsonResponse({ error: `Retry ${resource}` }, 500)) : undefined;
  render(<Wrapper><MissionsPage /></Wrapper>);
  if (resource === "detail") { await screen.findByText("Mission A"); fireEvent.click(screen.getByText("Mission A")); }
  const error = await screen.findByText(`Retry ${resource}`);
  const banner = error.closest<HTMLElement>('[role="alert"]'); expect(banner).not.toBeNull();
  const retry = within(banner!).getByRole("button", { name: /retry/i });
  if (resource === "templates" || resource === "categories") { fireEvent.click(screen.getByText("Mission B")); await screen.findByText("Instruction B"); }
  expect(screen.getByRole("button", { name: /new mission/i })).toBeEnabled();
  const held = deferred<Response>(), beforeRetry = calls.filter(c => c.url === target).length;
  override = url => url === target ? held.promise : undefined;
  fireEvent.click(retry);
  await waitFor(() => expect(calls.filter(c => c.url === target).length).toBeGreaterThan(beforeRetry));
  expect(screen.getByText(`Retry ${resource}`)).toBeInTheDocument();
  if (resource === "templates" || resource === "categories") expect(screen.getByText("Instruction B")).toBeInTheDocument();
  if (resource === "detail") expect(screen.getByText("Mission B")).toBeInTheDocument();
  const data = resource === "list" ? { missions } : resource === "templates" ? { templates } : resource === "categories" ? { categories } : { mission: row("A"), run: null, schedule: null };
  await act(async () => { held.resolve(jsonResponse({ data })); });
  await waitFor(() => expect(screen.queryByText(`Retry ${resource}`)).not.toBeInTheDocument());
  expect(screen.getByText("Mission A")).toBeInTheDocument(); expect(screen.getByText("Mission B")).toBeInTheDocument();
});

it.each(["template", "category"])("board writes refresh dashboard template and category readers [%s]", async kind => {
  const h = renderHook(() => ({ board: useMissionsPage(), dashboard: useDashboard() }), { wrapper: Wrapper });
  await waitFor(() => expect(h.result.current.dashboard.categories[0]?.name).toBe("Old category"));
  if (kind === "category") {
    override = (url, init) => { if (url === "/api/mission-categories" && init?.method === "PUT") { categories = [{ ...categories[0], name: "New category" }]; return Promise.resolve(jsonResponse({ data: {} })); } };
    await act(async () => { await h.result.current.board.handleUpdateCategory("c", { name: "New category" }); });
    await waitFor(() => expect(h.result.current.dashboard.categories[0]?.name).toBe("New category"));
  } else {
    override = (url, init) => { if (url === "/api/templates" && init?.method === "POST") { templates = []; return Promise.resolve(jsonResponse({ data: {} })); } };
    await act(async () => { await h.result.current.board.handleDeleteTemplate("t"); });
    await waitFor(() => expect(h.result.current.dashboard.templates).toEqual([]));
  }
});

it("failed cancellation rolls back its optimistic change without losing unrelated updates", async () => {
  const h = await mount(), held = deferred<Response>();
  override = (url, init) => url === "/api/missions" && init?.method === "POST" ? held.promise : undefined;
  let pending!: Promise<void>; act(() => { pending = h.result.current.handleCancel("A"); });
  expect(h.result.current.missions.find(m => m.id === "A")?.status).toBe("failed");
  missions = [row("A", "New same-row name"), row("B", "New other-row name")];
  await act(async () => { await h.result.current.fetchData(); });
  await act(async () => { held.resolve(jsonResponse({ error: "Cancellation refused" }, 409)); await pending; });
  expect(h.result.current.missions.find(m => m.id === "A")).toMatchObject({ name: "New same-row name", status: "dispatched" });
  expect(h.result.current.missions.find(m => m.id === "B")?.name).toBe("New other-row name");
});

it("injected category reads remain effective after cache migration", async () => {
  const fetchCategories = jest.fn(async () => categories), showToast = jest.fn();
  const h = renderHook(() => useMissionCategories({ fetchCategories, showToast, onMissionsReassigned: async () => {} }));
  await act(async () => { await h.result.current.loadCategories(); }); expect(h.result.current.categories).toEqual(categories);
  fetchCategories.mockRejectedValueOnce(new Error("Injected read refusal"));
  await act(async () => { await h.result.current.loadCategories(); }); expect(h.result.current.categoriesLoadError).toBe("Injected read refusal");
  expect(showToast).not.toHaveBeenCalled();
});

it("template editing preserves the independent composer draft and acknowledgement", async () => {
  const h = await mount();
  act(() => { h.result.current.setNewInstruction("Composer draft"); h.result.current.setFormField("newDispatch", "queue"); });
  expect(h.result.current.dispatchAcknowledged).toBe(true);
  act(() => h.result.current.handleEditTemplate(template()));
  act(() => h.result.current.setTemplateInstruction("Editor draft"));
  expect(h.result.current.newInstruction).toBe("Composer draft"); expect(h.result.current.templateInstruction).toBe("Editor draft");
  expect(h.result.current.dispatchAcknowledged).toBe(true);
});

it.each(["save", "now", "queue", "cron", "malformed"])("template dispatch modes preserve valid values and reject invalid values [%s]", async mode => {
  const h = await mount(); act(() => h.result.current.setFormField("newDispatch", "queue"));
  act(() => h.result.current.handleTemplateSelect(template(mode)));
  expect(h.result.current.formState.newDispatch).toBe(mode === "malformed" ? "queue" : mode);
  if (mode === "malformed") {
    render(<>{h.result.current.toastElement}</>);
    expect(screen.getByRole("alert")).toHaveTextContent(/dispatch|mode|invalid/i);
    act(() => { h.result.current.setFormField("newName", "Validated mission"); h.result.current.setNewInstruction("Explicit valid instruction"); h.result.current.setFormField("newDispatch", "queue"); });
    expect(h.result.current.dispatchAcknowledged).toBe(true);
    await act(async () => { await h.result.current.handleCreate(); });
    const writes = calls.filter(c => c.url === "/api/missions" && c.method === "POST");
    expect(writes.length).toBeGreaterThan(0); expect(writes.every(c => c.body.dispatchMode === "queue")).toBe(true);
  }
});
