/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMissionsData } from "@/hooks/useMissionsData";
import { useMissionsPage } from "@/hooks/useMissionsPage";
import { useChatPage } from "@/hooks/useChatPage";
import type { ChatConversation, ChatMessage } from "@/types/chat";
import type { MissionRow } from "@/hooks/missions-page-types";
import { jsonResponse } from "../helpers/fetch-map";
import StoryReaderPage from "@/app/recroom/story-weaver/[id]/page";
import { halfWritten } from "../helpers/story";
import { apiQueryKey } from "@/hooks/useApiResource";
import { useHindsightDirectives } from "@/components/memory/hindsight/useHindsightDirectives";
import { useHindsightModels } from "@/components/memory/hindsight/useHindsightModels";
import { useHindsightMemories } from "@/components/memory/hindsight/useHindsightMemories";
import { useOperatorPrefs } from "@/hooks/useOperatorPrefs";
import { runWriteResult } from "@/lib/api/api-write";

// Independent supplementary oracle: real ownership hooks and query cache.
// Only transport arrival order is controlled; no production implementation mock.
jest.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useParams: () => ({ id: "S-1" }),
}));
function parked<T>() {
  let release!: (answer: T) => void;
  const promise = new Promise<T>(resolve => { release = resolve; });
  return { promise, release };
}
class QueuedEvents {
  static instances: QueuedEvents[] = [];
  private handlers = new Map<string, EventListener[]>();
  closed = false;
  onerror: ((event: Event) => void) | null = null;
  constructor(readonly url: string) { QueuedEvents.instances.push(this); }
  addEventListener(kind: string, callback: EventListener) {
    this.handlers.set(kind, [...(this.handlers.get(kind) ?? []), callback]);
  }
  close() { this.closed = true; }
  deliver(kind: string, value: unknown) {
    // A queued event can still arrive after close; ownership belongs to the hook.
    this.handlers.get(kind)?.forEach(callback => callback(new MessageEvent(kind, { data: JSON.stringify(value) })));
  }
}
const savedFetch = global.fetch;
const savedEvents = global.EventSource;
const mission = (id: string, name = `Owned mission ${id}`): MissionRow =>
  ({ id, name, status: "dispatched", prompt: `Instruction ${id}`, queuedForRun: false } as MissionRow);
const chat = (id: string): ChatConversation => ({
  id, title: `Owned chat ${id}`, model: "fixture", profileName: null, sessionId: null,
  previousResponseId: null, createdAt: "2026-10-02", updatedAt: "2026-10-02",
});
const turn = (id: string, content = `Saved ${id}`): ChatMessage => ({
  id: `saved-${id}`, conversationId: id, content, role: "assistant", status: "complete",
  createdAt: "2026-10-02", updatedAt: "2026-10-02",
});
const detail = (row: MissionRow) => jsonResponse({ data: { mission: row, run: null, schedule: null } });
let client: QueryClient;
let missionRows: MissionRow[];
let chatRows: ChatConversation[];
let chatTurns: Record<string, ChatMessage[]>;
let arrivals: { url: string; method: string }[];
let intercept: (url: string, method: string, init?: RequestInit) => Promise<Response> | undefined;
const feedback = jest.fn();
const dataOptions = { showToast: feedback, applyTemplateToForm: () => null, setShowCreate: () => undefined };
function Provider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  window.history.replaceState({}, "", "/work/missions");
  localStorage.clear(); feedback.mockClear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  missionRows = [mission("A"), mission("B")];
  chatRows = [chat("A"), chat("B")]; chatTurns = { A: [turn("A")], B: [turn("B")] };
  arrivals = []; intercept = () => undefined; QueuedEvents.instances = [];
  global.EventSource = QueuedEvents as unknown as typeof EventSource;
  global.fetch = jest.fn(async (input, init) => {
    const url = String(input), method = init?.method ?? "GET";
    arrivals.push({ url, method });
    const answer = intercept(url, method, init); if (answer) return answer;
    if (url === "/api/missions?limit=200") return jsonResponse({ data: { missions: missionRows } });
    if (url.startsWith("/api/missions?id=")) return detail(mission(new URL(url, "http://owned").searchParams.get("id")!));
    if (url === "/api/missions" && method === "POST") return jsonResponse({ data: { success: true } });
    if (url === "/api/chat") return jsonResponse({ data: { conversations: chatRows } });
    const route = url.match(/^\/api\/chat\/([^/]+)(.*)$/);
    if (route) {
      const [, id, suffix] = route;
      if (!suffix && method === "GET") return jsonResponse({ data: { conversation: chat(id), messages: chatTurns[id] } });
      if (suffix === "/messages" && method === "POST") return jsonResponse({ data: { runId: `run-${id}`, assistantMessageId: `reply-${id}`, userMessageId: `user-${id}` } });
      if (method !== "GET") return jsonResponse({ data: {} });
    }
    const payloads: Record<string, unknown> = {
      "/api/templates": { templates: [] }, "/api/mission-categories": { categories: [] },
      "/api/models": { models: [] }, "/api/gateway/models": { models: [] },
      "/api/models/defaults": { defaults: {}, modelReadiness: { ready: true } },
      "/api/gateway/health": { online: true, authConfigured: true },
    };
    if (url in payloads) return jsonResponse({ data: payloads[url] });
    throw new Error(`Unclaimed supplemental transport: ${method} ${url}`);
  });
});
afterEach(() => {
  cleanup(); client.clear();
  global.fetch = savedFetch; global.EventSource = savedEvents;
});
const count = (url: string) => arrivals.filter(call => call.url === url).length;
async function pendingOldLink() {
  window.history.replaceState({}, "", "/work/missions?mission=older");
  const old = parked<Response>();
  intercept = url => url === "/api/missions?id=older" ? old.promise : undefined;
  const hook = renderHook(() => useMissionsData(dataOptions), { wrapper: Provider });
  await waitFor(() => expect(count("/api/missions?id=older")).toBe(1));
  expect(hook.result.current.missions.map(row => row.id)).toEqual(["A", "B"]);
  return { hook, old };
}
const lateAnswer = (outcome: string) => outcome === "found"
  ? detail(mission("older"))
  : jsonResponse({ error: outcome === "missing" ? "Owned missing mission" : "Owned stale refusal" }, outcome === "missing" ? 404 : 503);

it.each(["found", "missing", "refused"])("superseded initial mission deep-link cannot change selected B or its URL/error [%s]", async outcome => {
  const { hook, old } = await pendingOldLink();
  act(() => hook.result.current.setExpandedId("B"));
  await waitFor(() => expect(hook.result.current.detail?.mission.id).toBe("B"));
  const before = { url: window.location.href, rows: hook.result.current.missions, detail: hook.result.current.detail };
  await act(async () => { old.release(lateAnswer(outcome)); });
  expect({ selected: hook.result.current.expandedId, detail: hook.result.current.detail, rows: hook.result.current.missions,
    error: hook.result.current.missionsLoadError, url: window.location.href, feedback: feedback.mock.calls }).toEqual({
    selected: "B", detail: before.detail, rows: before.rows, error: null, url: before.url, feedback: [],
  });
});

it("older deep-link refusal cannot overwrite a newer successful list refresh", async () => {
  const { hook, old } = await pendingOldLink();
  missionRows = [mission("A", "New server name"), mission("B"), mission("older", "Current older row")];
  await act(async () => { await hook.result.current.loadMissions(); });
  expect(hook.result.current.missions[0].name).toBe("New server name");
  expect(hook.result.current.missionsLoadError).toBeNull();
  await act(async () => { old.release(lateAnswer("refused")); });
  expect(hook.result.current.missionsLoadError).toBeNull();
  expect(hook.result.current.missions).toEqual(missionRows);
});

it.each(["found", "missing"])("unmounted mission deep-link cannot rewrite the next page or emit feedback [%s]", async outcome => {
  const { hook, old } = await pendingOldLink();
  hook.unmount(); window.history.replaceState({}, "", "/work/chat?owned=next");
  const nextPage = window.location.href;
  await act(async () => { old.release(lateAnswer(outcome)); });
  expect({ url: window.location.href, feedback: feedback.mock.calls }).toEqual({ url: nextPage, feedback: [] });
});

it("current older mission deep-link still opens its detail and consumes its URL", async () => {
  const { hook, old } = await pendingOldLink();
  intercept = () => undefined;
  await act(async () => { old.release(detail(mission("older"))); });
  await waitFor(() => expect(hook.result.current.detail?.mission.id).toBe("older"));
  expect(hook.result.current.expandedId).toBe("older");
  expect(hook.result.current.missions.map(row => row.id)).toContain("older");
  expect(window.location.search).toBe(""); expect(feedback).not.toHaveBeenCalled();
});

it("current missing mission deep-link reports absence and consumes its URL", async () => {
  const { hook, old } = await pendingOldLink();
  await act(async () => { old.release(lateAnswer("missing")); });
  expect(hook.result.current.expandedId).toBeNull();
  expect(feedback).toHaveBeenCalledWith(expect.stringContaining("no longer exists"), "error");
  expect(window.location.search).toBe("");
});

it.each([true, false])("mission deletion settling after selecting B preserves B [accepted=%s]", async accepted => {
  const hook = renderHook(() => useMissionsPage(), { wrapper: Provider });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  act(() => hook.result.current.setExpandedId("A"));
  await waitFor(() => expect(hook.result.current.detail?.mission.id).toBe("A"));
  const deletion = parked<Response>(); intercept = (url, method) => url === "/api/missions" && method === "POST" ? deletion.promise : undefined;
  let pending!: Promise<void>; act(() => { pending = hook.result.current.handleDelete("A"); });
  await waitFor(() => expect(count("/api/missions")).toBe(1));
  act(() => hook.result.current.setExpandedId("B"));
  await waitFor(() => expect(hook.result.current.detail?.mission.id).toBe("B"));
  if (accepted) missionRows = [mission("B")];
  await act(async () => { deletion.release(jsonResponse(accepted ? { data: { success: true } } : { error: "Owned delete refusal" }, accepted ? 200 : 409)); await pending; });
  expect({ selected: hook.result.current.expandedId, detail: hook.result.current.detail?.mission.id }).toEqual({ selected: "B", detail: "B" });
});

async function openChat() {
  const hook = renderHook(() => useChatPage(), { wrapper: Provider });
  await waitFor(() => expect(hook.result.current.messages[0]?.content).toBe("Saved A"));
  await waitFor(() => expect(hook.result.current.gatewayOnline).toBe(true));
  return hook;
}
type ChatHook = Awaited<ReturnType<typeof openChat>>;
async function startTurn(hook: ChatHook) {
  act(() => hook.result.current.setInput("Owned explicit turn"));
  await act(async () => { await hook.result.current.handleSend(); });
  const source = QueuedEvents.instances.at(-1);
  expect(source).toBeDefined(); expect(hook.result.current.isStreaming).toBe(true);
  return source!;
}

it.each(["A", "B"])("deleting B invalidates only B's later stream, preserving another conversation [stream=%s]", async streamId => {
  const hook = await openChat(), deletion = parked<Response>();
  intercept = (url, method) => url === "/api/chat/B" && method === "DELETE" ? deletion.promise : undefined;
  let pending!: Promise<void>; act(() => { pending = hook.result.current.handleDeleteConversation("B"); });
  if (streamId === "B") {
    act(() => hook.result.current.handleSelectConversation("B"));
    await waitFor(() => expect(hook.result.current.messages[0]?.content).toBe("Saved B"));
  }
  const source = await startTurn(hook);
  act(() => source.deliver("message.delta", { delta: "Live owned answer" }));
  chatRows = [chat("A")];
  await act(async () => { deletion.release(jsonResponse({ data: {} })); await pending; });
  expect(hook.result.current.activeId).toBe("A");
  if (streamId === "B") {
    await waitFor(() => expect(hook.result.current.messages[0]?.content).toBe("Saved A"));
    const messages = hook.result.current.messages;
    act(() => { source.deliver("tool.approval_required", { name: "Deleted B tool" }); source.deliver("message.delta", { delta: " obsolete" }); });
    expect({ messages: hook.result.current.messages, approval: hook.result.current.pendingApproval,
      streaming: hook.result.current.isStreaming, closed: source.closed }).toEqual({ messages, approval: null, streaming: false, closed: true });
  } else {
    expect(source.closed).toBe(false);
    act(() => source.deliver("message.delta", { delta: " continues" }));
    expect(hook.result.current.messages.at(-1)?.content).toBe("Live owned answer continues");
    expect(hook.result.current.isStreaming).toBe(true);
  }
});

it.each([false, true])("explicit same-conversation reload consumes fresh transcript [after completed turn=%s]", async completed => {
  const hook = await openChat();
  if (completed) {
    const source = await startTurn(hook);
    act(() => { source.deliver("message.delta", { delta: "Finished answer" }); source.deliver("run.completed", {}); });
    expect(hook.result.current.isStreaming).toBe(false); expect(source.closed).toBe(true);
    expect(hook.result.current.messages.at(-1)?.content).toBe("Finished answer");
  }
  const refreshed = [turn("A", "Fresh server transcript")], read = parked<Response>();
  intercept = (url, method) => url === "/api/chat/A" && method === "GET" ? read.promise : undefined;
  const priorReads = count("/api/chat/A");
  act(() => hook.result.current.reloadActiveConversation());
  await waitFor(() => expect(count("/api/chat/A")).toBeGreaterThan(priorReads));
  await act(async () => { read.release(jsonResponse({ data: { conversation: chat("A"), messages: refreshed } })); });
  expect(hook.result.current.messages).toEqual(refreshed);
  expect(hook.result.current.activeId).toBe("A"); expect(hook.result.current.conversationError).toBeNull();
});

const storyKey = () => apiQueryKey("/api/stories", { action: "load", storyId: "S-1" });
function storyTransport(answer: (action: string, init?: RequestInit) => Promise<Response> | undefined) {
  intercept = (url, _method, init) => {
    if (url !== "/api/stories") return undefined;
    const action = JSON.parse(String(init?.body)).action as string;
    const result = answer(action, init);
    if (result) return result;
    if (action === "spend") return Promise.resolve(jsonResponse({ data: { spend: null } }));
    throw new Error(`Unclaimed Story action: ${action}`);
  };
}
async function reader() {
  const view = render(<Provider><StoryReaderPage /></Provider>);
  await screen.findByRole("button", { name: "Write chapter 3" });
  return view;
}

it.each([false, true])("Story keeps Stop usable during a held paid call after background load [failed=%s]", async failed => {
  const initial = halfWritten(), generation = parked<Response>();
  let background = false, signal: AbortSignal | null | undefined, writes = 0;
  storyTransport((action, init) => {
    if (action === "load") return Promise.resolve(background && failed ? jsonResponse({ error: "Owned background refusal" }, 503) : jsonResponse({ data: initial }));
    if (action === "generate-chapter") { writes++; signal = init?.signal; return generation.promise; }
  });
  const view = await reader();
  try {
    fireEvent.click(screen.getByRole("button", { name: "Write chapter 3" }));
    await screen.findByRole("button", { name: "Stop" });
    expect(signal).toBeDefined(); expect(signal!.aborted).toBe(false);
    background = true;
    await act(async () => { await client.invalidateQueries({ queryKey: storyKey(), exact: true }); });
    if (failed) await screen.findByText("Owned background refusal");
    // A failed read can show feedback, but cannot remove the live cancellation control.
    const stop = screen.queryByRole("button", { name: "Stop" });
    expect(stop).not.toBeNull();
    expect(stop).toBeInTheDocument();
    fireEvent.click(stop!); expect(signal!.aborted).toBe(true); expect(writes).toBe(1);
  } finally {
    await act(async () => { generation.release(jsonResponse({ data: { story: initial } })); });
    view.unmount();
  }
});

it.each([false, true])("confirmed Story chapter survives same-ID remount and older reads [prewrite read=%s]", async prewriteRead => {
  const initial = halfWritten();
  const confirmed = { ...initial, chapters: initial.chapters.map(c => c.number === 3 ? { ...c, status: "complete", title: "Confirmed third chapter" } : c),
    chapterContents: { ...initial.chapterContents, "3": "Confirmed new chapter text" } };
  const older = parked<Response>(), reopening = parked<Response>();
  let stage: "initial" | "older" | "reopen" = "initial", loads = 0, writes = 0;
  let olderStarted = false;
  storyTransport(action => {
    if (action === "load") {
      loads++;
      if (stage === "reopen") return reopening.promise;
      if (stage === "older" && !olderStarted) { olderStarted = true; return older.promise; }
      return Promise.resolve(jsonResponse({ data: writes ? confirmed : initial }));
    }
    if (action === "generate-chapter") { writes++; return Promise.resolve(jsonResponse({ data: { story: confirmed } })); }
  });
  let view = await reader();
  let refresh: Promise<void> | undefined;
  try {
    if (prewriteRead) {
      stage = "older";
      act(() => { refresh = client.invalidateQueries({ queryKey: storyKey(), exact: true }); });
      await waitFor(() => expect(loads).toBe(2));
    }
    fireEvent.click(screen.getByRole("button", { name: "Write chapter 3" }));
    await screen.findByRole("button", { name: "Write chapter 4" });
    if (prewriteRead) {
      await act(async () => {
        older.release(jsonResponse({ data: { ...initial, title: "Earlier in-flight title" } }));
        await refresh;
        // Drain the query observer notification after this particular response.
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(screen.queryByRole("button", { name: "Write chapter 3" })).not.toBeInTheDocument();
    }
    view.unmount(); stage = "reopen";
    const previousLoads = loads;
    view = render(<Provider><StoryReaderPage /></Provider>);
    await waitFor(() => expect(loads).toBeGreaterThan(previousLoads));
    // The refresh is still held. The last confirmed write must remain available.
    expect(screen.queryByRole("button", { name: "Write chapter 4" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Write chapter 4" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Write chapter 3" })).not.toBeInTheDocument();
    expect(writes).toBe(1);
  } finally {
    await act(async () => { older.release(jsonResponse({ data: initial })); reopening.release(jsonResponse({ data: confirmed })); await refresh; });
    view.unmount();
  }
});

it("already-confirmed cached Story remains readable during a held same-ID remount refresh", async () => {
  const saved = halfWritten();
  saved.chapters[2] = { ...saved.chapters[2], status: "complete", title: "Saved third chapter" };
  const refresh = parked<Response>(); let held = false;
  storyTransport(action => action === "load" ? held ? refresh.promise : Promise.resolve(jsonResponse({ data: saved })) : undefined);
  let view = render(<Provider><StoryReaderPage /></Provider>);
  await screen.findByRole("button", { name: "Write chapter 4" });
  view.unmount(); held = true;
  view = render(<Provider><StoryReaderPage /></Provider>);
  try {
    expect(screen.queryByRole("button", { name: "Write chapter 4" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Write chapter 3" })).not.toBeInTheDocument();
  } finally {
    await act(async () => { refresh.release(jsonResponse({ data: saved })); }); view.unmount();
  }
});

it.each((["directives", "models"] as const).flatMap(kind => [false, true].map(held => ({ kind, held }))))("Hindsight create retains server truth across initial read [$kind, held=$held]", async ({ kind, held }) => {
  const initial = parked<Response>();
  let firstRead = true, written = false;
  const created = kind === "directives"
    ? { id: "new", name: "New owned directive", content: "Only owned content", priority: 0, tags: [], is_active: true, created_at: "2026-10-02" }
    : { id: "new", name: "New owned model", source_query: "Owned question", content: "", tags: [], created_at: "2026-10-02", last_refreshed_at: "2026-10-02" };
  const endpoint = `/api/memory/hindsight?action=${kind === "directives" ? kind : "mental-models"}`;
  intercept = (url, method) => {
    if (url === endpoint && method === "GET") {
      if (firstRead) { firstRead = false; if (held) return initial.promise; }
      return Promise.resolve(jsonResponse({ data: { [kind]: written ? [created] : [] } }));
    }
    if (url === "/api/memory/hindsight" && method === "POST") { written = true; return Promise.resolve(jsonResponse({ data: {} })); }
  };
  // Both public hooks execute normally; the inactive tab must not fetch.
  const hook = renderHook(() => ({
    directives: useHindsightDirectives(feedback, kind === "directives" ? "directives" : "memories"),
    models: useHindsightModels(feedback, kind === "models" ? "mental-models" : "memories"),
  }), { wrapper: Provider });
  await waitFor(() => expect(count(endpoint)).toBe(1));
  if (!held) await waitFor(() => expect(kind === "directives" ? hook.result.current.directives.loadingDirectives : hook.result.current.models.loadingModels).toBe(false));
  act(() => {
    if (kind === "directives") hook.result.current.directives.setDirForm({ name: created.name, content: "Only owned content", priority: "0", tags: "" });
    else hook.result.current.models.setModelForm({ name: created.name, query: "Owned question", tags: "" });
  });
  let write!: Promise<boolean>;
  act(() => { write = kind === "directives" ? hook.result.current.directives.handleCreateDirective() : hook.result.current.models.handleCreateModel(); });
  await waitFor(() => expect(feedback).toHaveBeenCalledWith(expect.stringContaining("created"), "success"));
  expect(written).toBe(true);
  await act(async () => { initial.release(jsonResponse({ data: { [kind]: [] } })); expect(await write).toBe(true); });
  const current = () => kind === "directives" ? hook.result.current.directives.directives : hook.result.current.models.mentalModels;
  await waitFor(() => expect(current()).toEqual([created]));
  expect(arrivals.filter(c => c.method === "POST")).toHaveLength(1);
});

it.each([false, true])("adding a memory retains server truth across initial read [held=%s]", async held => {
  const initial = parked<Response>();
  const entry = { content: "Confirmed owned memory", tags: ["owned"], created_at: "2026-10-02" };
  let reads = 0, written = false;
  intercept = (url, method) => {
    if (url.includes("action=list")) {
      reads++; if (reads === 1 && held) return initial.promise;
      return Promise.resolve(jsonResponse({ data: { memories: written ? [entry] : [], total: written ? 1 : 0, mode: "ok" } }));
    }
    if (url === "/api/memory/hindsight" && method === "POST") { written = true; return Promise.resolve(jsonResponse({ data: {} })); }
  };
  const hook = renderHook(() => useHindsightMemories(feedback), { wrapper: Provider });
  await waitFor(() => expect(reads).toBe(1));
  if (!held) await waitFor(() => expect(hook.result.current.loadingInitial).toBe(false));
  act(() => { hook.result.current.setNewContent(entry.content); hook.result.current.setNewTags("owned"); });
  let write!: Promise<boolean>; act(() => { write = hook.result.current.handleAdd(); });
  await waitFor(() => expect(feedback).toHaveBeenCalledWith("Memory stored", "success"));
  await act(async () => { initial.release(jsonResponse({ data: { memories: [], total: 0, mode: "ok" } })); expect(await write).toBe(true); });
  await waitFor(() => expect(hook.result.current.memories).toEqual([entry]));
  expect(hook.result.current.totalFacts).toBe(1);
});

it.each([false, true])("preference write reaches both readers despite a prewrite initial response [held=%s]", async held => {
  const initial = parked<Response>(); let reads = 0, written = false;
  intercept = (url, method) => {
    if (url !== "/api/prefs") return undefined;
    if (method === "PUT") { written = true; return Promise.resolve(jsonResponse({ data: { prefs: { "sidebar.collapsed": true } } })); }
    reads++; if (reads === 1 && held) return initial.promise;
    return Promise.resolve(jsonResponse({ data: { prefs: { "sidebar.collapsed": written } } }));
  };
  const hook = renderHook(() => ({ first: useOperatorPrefs(), second: useOperatorPrefs() }), { wrapper: Provider });
  await waitFor(() => expect(reads).toBe(1));
  if (!held) await waitFor(() => expect(hook.result.current.first.isLoading).toBe(false));
  act(() => hook.result.current.first.setPref("sidebar.collapsed", true));
  await waitFor(() => { expect(written).toBe(true); expect(hook.result.current.first.saving).toBe(false); });
  await act(async () => { initial.release(jsonResponse({ data: { prefs: { "sidebar.collapsed": false } } })); });
  await waitFor(() => expect([hook.result.current.first.prefs["sidebar.collapsed"], hook.result.current.second.prefs["sidebar.collapsed"]]).toEqual([true, true]));
  expect(arrivals.filter(c => c.method === "PUT")).toHaveLength(1);
});

it.each(["HTTP", "network", "success-false"])("runWriteResult preserves transport classification and one call [%s]", async outcome => {
  const responseBody = { error: "Owned conflict", data: { revision: 7 }, details: ["retained"] };
  const successBody = { data: { success: false, error: "Application-owned outcome" } };
  intercept = () => outcome === "network" ? Promise.reject(new Error("Owned network refusal"))
    : Promise.resolve(jsonResponse(outcome === "HTTP" ? responseBody : successBody, outcome === "HTTP" ? 409 : 200));
  const answer = await runWriteResult("/api/owned-write", { method: "POST", body: { owned: true } });
  expect(answer).toEqual(outcome === "HTTP" ? { ok: false, error: "Owned conflict", status: 409, body: responseBody }
    : outcome === "network" ? { ok: false, error: "Owned network refusal" } : { ok: true, data: successBody });
  expect(arrivals).toEqual([{ url: "/api/owned-write", method: "POST" }]);
});

it.each(["caller", "default", "explicit"])("runWriteResult preserves cancellation/deadline selection [%s]", async mode => {
  const controller = new AbortController();
  const timeout = jest.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  let observed: RequestInit | undefined;
  intercept = (_url, _method, init) => new Promise<Response>((_resolve, reject) => {
    observed = init;
    init?.signal?.addEventListener("abort", () => reject(new Error("Owned abort")), { once: true });
  });
  try {
    const pending = runWriteResult("/api/owned-write", { method: "PATCH", body: { value: 1 },
      ...(mode === "caller" ? { signal: controller.signal, timeoutMs: 1234 } : mode === "explicit" ? { timeoutMs: 1234 } : {}) });
    expect(observed?.signal).toBe(controller.signal); expect(observed?.body).toBe('{"value":1}');
    if (mode === "caller") expect(timeout).not.toHaveBeenCalled();
    else expect(timeout).toHaveBeenCalledWith(mode === "default" ? 45000 : 1234);
    controller.abort();
    expect(await pending).toEqual({ ok: false, error: mode === "caller" ? "Owned abort" : `No response after ${mode === "default" ? 45 : 1}s (/api/owned-write)` });
    expect(arrivals).toHaveLength(1);
  } finally { timeout.mockRestore(); }
});
