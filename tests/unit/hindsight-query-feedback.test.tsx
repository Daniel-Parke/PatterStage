/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import HindsightBrowser from "@/components/memory/HindsightBrowser";
import { useHindsightMemories } from "@/components/memory/hindsight/useHindsightMemories";
import { useHindsightModels } from "@/components/memory/hindsight/useHindsightModels";
import { useHindsightDirectives } from "@/components/memory/hindsight/useHindsightDirectives";
import type { Directive, MentalModel, Tab } from "@/components/memory/hindsight/types";
import { jsonResponse } from "../helpers/fetch-map";

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const directive: Directive = { id: "d", name: "Owned directive", content: "Do careful work", priority: 3, is_active: true, tags: ["owned"], created_at: "2026-10-02" };
const model: MentalModel = { id: "m", name: "Owned model", source_query: "Owned question", content: "Owned model answer", tags: ["owned"], created_at: "2026-10-02", last_refreshed_at: "2026-10-02" };
const previousFetch = global.fetch;
let client: QueryClient, items: { directives: Directive[]; models: MentalModel[] };
let override: (action: string, method: string, body: Record<string, unknown>) => Promise<Response> | undefined;
let calls: { action: string; method: string; body: Record<string, unknown>; url: string }[];
const showToast = jest.fn();
function Wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  items = { directives: [directive], models: [model] }; calls = []; override = () => undefined; showToast.mockClear();
  global.fetch = jest.fn(async (input, init) => {
    const url = String(input), method = init?.method ?? "GET", body = init?.body ? JSON.parse(String(init.body)) : {};
    if (!url.startsWith("/api/memory/hindsight")) throw new Error(`Unexpected Hindsight boundary: ${url}`);
    const action = String(body.action ?? new URL(url, "http://fixture").searchParams.get("action") ?? "add");
    calls.push({ action, method, body, url }); const held = override(action, method, body); if (held) return held;
    if (method !== "GET") return jsonResponse({ data: { success: true } });
    if (action === "directives") return jsonResponse({ data: { directives: items.directives } });
    if (action === "mental-models") return jsonResponse({ data: { models: items.models } });
    if (action === "health") return jsonResponse({ data: { available: true, mode: "ok" } });
    if (action === "reflect") return jsonResponse({ data: { response: "Explicit reflection" } });
    return jsonResponse({ data: { memories: [{ id: "fresh", content: "Fresh fact", created_at: new Date().toISOString() }, { id: "old", content: "Old fact", created_at: "2000-01-01" }], total: 500, mode: "ok" } });
  });
});
afterEach(() => { client.clear(); global.fetch = previousFetch; focusManager.setFocused(undefined); });
const tabs: Tab[] = ["memories", "directives", "mental-models"];
function actionFor(tab: Tab) { return tab === "memories" ? "list" : tab; }
function open(tab: Tab) { render(<Wrapper><HindsightBrowser /></Wrapper>); if (tab !== "memories") fireEvent.click(screen.getByRole("button", { name: tab === "directives" ? /^Directives/ : /^Mental Models/i })); }

it.each(tabs.flatMap(tab => ["HTTP", "network", "application"].map(failure => ({ tab, failure }))))("active Hindsight reads expose failure instead of successful emptiness [$tab, $failure]", async ({ tab, failure }) => {
  override = (action, method) => {
    if (action !== actionFor(tab) || method !== "GET") return;
    if (failure === "network") return Promise.reject(new Error("Owned read failure"));
    return Promise.resolve(jsonResponse({ data: { error: "Owned read failure" } }, failure === "HTTP" ? 503 : 200));
  };
  open(tab); await waitFor(() => expect(calls.some(c => c.action === actionFor(tab))).toBe(true));
  await waitFor(() => expect(screen.getAllByRole("alert").some(el => /fail|error|unavailable|unable/i.test(el.textContent ?? ""))).toBe(true));
  expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  expect(screen.queryByText(/Hindsight returned no (directives|mental models)/i)).not.toBeInTheDocument();
});

it.each(tabs)("Hindsight retry clears the error only after a successful read [%s]", async tab => {
  let failed = true;
  override = (action, method) => action === actionFor(tab) && method === "GET" && failed ? Promise.resolve(jsonResponse({ error: "Owned retry failure" }, 503)) : undefined;
  open(tab); const retry = await screen.findByRole("button", { name: /retry/i });
  failed = false; fireEvent.click(retry);
  await screen.findByText(tab === "memories" ? "Fresh fact" : tab === "directives" ? "Owned directive" : "Owned model");
  expect(screen.queryByText("Owned retry failure")).not.toBeInTheDocument();
  if (tab === "memories") expect(calls.filter(c => c.action === "directives" || c.action === "mental-models")).toEqual([]);
});

it.each(tabs)("successful empty Hindsight reads remain an empty result [%s]", async tab => {
  items = { directives: [], models: [] };
  override = action => action === "list" ? Promise.resolve(jsonResponse({ data: { memories: [], total: 0, mode: "ok" } })) : undefined;
  open(tab); await waitFor(() => expect(calls.some(c => c.action === actionFor(tab))).toBe(true));
  await waitFor(() => expect(screen.getAllByText(tab === "memories" ? /No memories yet/i : tab === "directives" ? /No directives/i : /No mental models/i).length).toBeGreaterThan(0));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it.each(["create", "save", "delete"])("Hindsight CRUD preserves drafts and updates readers only after success [%s]", async operation => {
  const h = renderHook(() => useHindsightDirectives(showToast, "directives"), { wrapper: Wrapper });
  await waitFor(() => expect(h.result.current.directives).toHaveLength(1));
  act(() => { h.result.current.openDirectiveModal(); h.result.current.setDirForm({ name: "Draft name", content: "Draft content", priority: "7", tags: "first, second" }); h.result.current.openEditDirective(directive); });
  act(() => h.result.current.setEditDirForm({ name: "Edited name", content: "Edited content", priority: "9", tags: "edited" }));
  const invoke = () => operation === "create" ? h.result.current.handleCreateDirective() : operation === "save" ? h.result.current.handleSaveDirective() : h.result.current.handleDeleteDirective("d");
  const held = deferred<Response>(); override = (_a, method) => method !== "GET" ? held.promise : undefined;
  let pending!: Promise<unknown>; act(() => { pending = invoke(); });
  if (operation === "create") expect(calls.find(c => c.method === "POST")?.body).toEqual({ action: "create-directive", name: "Draft name", content: "Draft content", priority: 7, tags: ["first", "second"] });
  if (operation === "save") expect(calls.find(c => c.method === "POST")?.body).toEqual({ action: "update-directive", id: "d", name: "Edited name", content: "Edited content", priority: 9, tags: ["edited"] });
  if (operation === "create") expect(h.result.current.creatingDirective).toBe(true);
  if (operation === "save") expect(h.result.current.savingDirective).toBe(true);
  const reads = calls.filter(c => c.method === "GET").length;
  await act(async () => { held.resolve(jsonResponse({ error: "Owned write refusal" }, 409)); await pending; });
  expect(showToast).toHaveBeenCalledWith("Owned write refusal", "error"); expect(h.result.current.directives).toEqual([directive]);
  expect(calls.filter(c => c.method === "GET")).toHaveLength(reads);
  expect(h.result.current.dirForm.name).toBe("Draft name"); expect(h.result.current.editDirForm.name).toBe("Edited name");
  override = () => undefined; items.directives = operation === "delete" ? [] : [{ ...directive, name: "Server accepted" }];
  await act(async () => { await invoke(); });
  expect(h.result.current.directives).toEqual(items.directives);
});

it.each(["create", "save", "delete"])("model CRUD preserves drafts and updates readers only after success [%s]", async operation => {
  const h = renderHook(() => useHindsightModels(showToast, "mental-models"), { wrapper: Wrapper });
  await waitFor(() => expect(h.result.current.mentalModels).toHaveLength(1));
  act(() => { h.result.current.openModelModal(); h.result.current.setModelForm({ name: "Draft model", query: "Draft question", tags: "first, second" }); h.result.current.openEditModel(model); });
  act(() => h.result.current.setEditModelForm({ name: "Edited model", query: "Edited question", tags: "edited" }));
  const invoke = () => operation === "create" ? h.result.current.handleCreateModel() : operation === "save" ? h.result.current.handleSaveModel() : h.result.current.handleDeleteModel("m");
  const held = deferred<Response>(); override = (_a, method) => method !== "GET" ? held.promise : undefined;
  let pending!: Promise<unknown>; act(() => { pending = invoke(); });
  if (operation === "create") { expect(h.result.current.creatingModel).toBe(true); expect(calls.find(c => c.method === "POST")?.body).toEqual({ action: "create-model", name: "Draft model", query: "Draft question", tags: ["first", "second"] }); }
  if (operation === "save") { expect(h.result.current.savingModel).toBe(true); expect(calls.find(c => c.method === "POST")?.body).toEqual({ action: "update-model", id: "m", name: "Edited model", query: "Edited question", tags: ["edited"] }); }
  const reads = calls.filter(c => c.method === "GET").length;
  await act(async () => { held.resolve(jsonResponse({ error: "Owned model refusal" }, 409)); await pending; });
  expect(showToast).toHaveBeenCalledWith("Owned model refusal", "error"); expect(h.result.current.mentalModels).toEqual([model]);
  expect(calls.filter(c => c.method === "GET")).toHaveLength(reads);
  expect(h.result.current.modelForm.name).toBe("Draft model"); expect(h.result.current.editModelForm.name).toBe("Edited model");
  override = () => undefined; items.models = operation === "delete" ? [] : [{ ...model, name: "Server accepted model" }];
  await act(async () => { await invoke(); }); expect(h.result.current.mentalModels).toEqual(items.models);
});

it("adding a memory preserves failed drafts and refreshes the active search only after success", async () => {
  const h = renderHook(() => useHindsightMemories(showToast), { wrapper: Wrapper });
  await waitFor(() => expect(h.result.current.loadingInitial).toBe(false));
  act(() => { h.result.current.setSearch("active search"); h.result.current.openAddModal(); h.result.current.setNewContent("Owned memory"); h.result.current.setNewTags("first, second"); });
  const held = deferred<Response>(); override = (_a, method) => method !== "GET" ? held.promise : undefined;
  let pending!: Promise<boolean>; act(() => { pending = h.result.current.handleAdd(); });
  expect(h.result.current.adding).toBe(true); expect(calls.find(c => c.method === "POST")?.body).toEqual({ content: "Owned memory", tags: ["first", "second"] });
  const reads = calls.filter(c => c.method === "GET").length;
  await act(async () => { held.resolve(jsonResponse({ error: "Owned memory refusal" }, 409)); expect(await pending).toBe(false); });
  expect(h.result.current.adding).toBe(false); expect(h.result.current.showAddModal).toBe(true); expect(h.result.current.newContent).toBe("Owned memory"); expect(h.result.current.newTags).toBe("first, second");
  expect(calls.filter(c => c.method === "GET")).toHaveLength(reads); expect(showToast).toHaveBeenCalledWith("Owned memory refusal", "error");
  override = () => undefined;
  await act(async () => { expect(await h.result.current.handleAdd()).toBe(true); });
  expect(h.result.current.showAddModal).toBe(false); expect(h.result.current.newContent).toBe(""); expect(h.result.current.newTags).toBe("");
  expect(calls.filter(c => c.action === "recall").map(c => c.url)).toEqual(["/api/memory/hindsight?action=recall&query=active+search"]);
});

it("memory queries preserve health total count and stale filtering", async () => {
  const h = renderHook(() => useHindsightMemories(showToast), { wrapper: Wrapper });
  await waitFor(() => expect(h.result.current.loadingInitial).toBe(false));
  expect(h.result.current.totalFacts).toBe(500); expect(h.result.current.hiddenStaleCount).toBe(1);
  expect(h.result.current.displayedMemories.map(m => m.content)).toEqual(["Fresh fact"]);
  act(() => h.result.current.setShowStaleMemories(true)); expect(h.result.current.displayedMemories).toHaveLength(2);
  act(() => h.result.current.setSearch("owned query")); await act(async () => { await h.result.current.runRecall(); });
  expect(calls.find(c => c.action === "recall")?.url).toContain("query=owned+query");
  override = action => action === "list" ? Promise.resolve(jsonResponse({ error: "Unavailable" }, 503)) : action === "health" ? Promise.resolve(jsonResponse({ data: { available: false, mode: "unreachable" } })) : undefined;
  await act(async () => { await h.result.current.loadRecentMemories(); }); expect(h.result.current.health?.available).toBe(false);
});

it("reflection runs only after explicit operator intent", async () => {
  const h = renderHook(() => useHindsightMemories(showToast), { wrapper: Wrapper }); await waitFor(() => expect(h.result.current.loadingInitial).toBe(false));
  act(() => { h.result.current.setSearch("Reflect deliberately"); focusManager.setFocused(false); focusManager.setFocused(true); });
  await act(async () => { await client.invalidateQueries(); }); expect(calls.filter(c => c.action === "reflect")).toEqual([]);
  await act(async () => { await h.result.current.handleReflect(); }); expect(h.result.current.reflectResult).toBe("Explicit reflection");
  await act(async () => { await client.invalidateQueries(); }); expect(calls.filter(c => c.action === "reflect")).toHaveLength(1);
});

it("model refresh preserves the busy model identity and failure", async () => {
  const h = renderHook(() => useHindsightModels(showToast, "mental-models"), { wrapper: Wrapper }); await waitFor(() => expect(h.result.current.mentalModels).toHaveLength(1));
  const held = deferred<Response>(); override = action => action === "refresh-model" ? held.promise : undefined;
  let pending!: Promise<void>; act(() => { pending = h.result.current.handleRefreshModel("m"); }); expect(h.result.current.refreshingModelId).toBe("m");
  await act(async () => { held.resolve(jsonResponse({ error: "Refresh refused" }, 409)); await pending; });
  expect(h.result.current.refreshingModelId).toBeNull(); expect(h.result.current.mentalModels[0].tags).toEqual(["owned"]); expect(showToast).toHaveBeenCalledWith("Refresh refused", "error");
  override = () => undefined; items.models = [{ ...model, content: "Refreshed answer" }];
  await act(async () => { await h.result.current.handleRefreshModel("m"); }); expect(h.result.current.mentalModels[0].content).toBe("Refreshed answer");
});

it("directive activation preserves tags priority and failed-write state", async () => {
  const h = renderHook(() => useHindsightDirectives(showToast, "directives"), { wrapper: Wrapper }); await waitFor(() => expect(h.result.current.directives).toHaveLength(1));
  override = (_a, method) => method !== "GET" ? Promise.resolve(jsonResponse({ error: "Toggle refused" }, 403)) : undefined;
  await act(async () => { await h.result.current.handleToggleDirective(directive); }); expect(h.result.current.directives[0]).toEqual(directive);
  expect(calls.find(c => c.method === "POST")?.body).toEqual({ action: "update-directive", id: "d", is_active: false });
  expect(showToast).toHaveBeenCalledWith("Toggle refused", "error");
  override = () => undefined; items.directives = [{ ...directive, is_active: false }];
  await act(async () => { await h.result.current.handleToggleDirective(directive); }); expect(h.result.current.directives[0]).toMatchObject({ is_active: false, priority: 3, tags: ["owned"] });
});
