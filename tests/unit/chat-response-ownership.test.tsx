/** @jest-environment jsdom */
import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useChatPage } from "@/hooks/useChatPage";
import type { ChatConversation, ChatMessage } from "@/types/chat";
import { jsonResponse } from "../helpers/fetch-map";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const conversation = (id: string, title = `Conversation ${id}`): ChatConversation => ({ id, title, model: "fixture", sessionId: null, profileName: null, previousResponseId: null, createdAt: "2026-10-02", updatedAt: "2026-10-02" });
const message = (id: string): ChatMessage => ({ id: `saved-${id}`, conversationId: id, role: "assistant", content: `Saved transcript ${id}`, status: "complete", createdAt: "2026-10-02", updatedAt: "2026-10-02" });
// Delivery deliberately remains possible after close: already-queued browser
// callbacks must be rejected by the consumer, not silently eaten by this fake.
class ControlledSource {
  static all: ControlledSource[] = [];
  listeners = new Map<string, EventListener[]>();
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  constructor(readonly url: string) { ControlledSource.all.push(this); }
  addEventListener(type: string, listener: EventListener) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  close() { this.closed = true; }
  emit(type: string, data: unknown) { for (const listener of this.listeners.get(type) ?? []) listener(new MessageEvent(type, { data: JSON.stringify(data) })); }
  fail() { this.onerror?.(new Event("error")); }
}
const originalFetch = global.fetch, originalSource = global.EventSource;
let client: QueryClient;
let rows: ChatConversation[];
let override: (url: string, init?: RequestInit) => Promise<Response> | undefined;
let calls: { url: string; method: string; body: unknown }[];
function Wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  rows = [conversation("A"), conversation("B")]; calls = []; override = () => undefined;
  ControlledSource.all = []; global.EventSource = ControlledSource as unknown as typeof EventSource;
  global.fetch = jest.fn(async (input, init) => {
    const url = String(input), method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    const held = override(url, init); if (held) return held;
    if (url === "/api/chat" && method === "GET") return jsonResponse({ data: { conversations: rows } });
    if (url === "/api/chat" && method === "POST") return jsonResponse({ data: { conversation: conversation("N", "New Chat") } }, 201);
    const detail = url.match(/^\/api\/chat\/([^/]+)$/);
    if (detail && method === "GET") return jsonResponse({ data: { conversation: conversation(detail[1]), messages: [message(detail[1])] } });
    const send = url.match(/^\/api\/chat\/([^/]+)\/messages$/);
    if (send && method === "POST") return jsonResponse({ data: { runId: `run-${send[1]}`, userMessageId: `user-${send[1]}`, assistantMessageId: `reply-${send[1]}` } });
    if (url.startsWith("/api/chat/") && method !== "GET") return jsonResponse({ data: {} });
    if (url === "/api/gateway/health") return jsonResponse({ data: { online: true, authConfigured: true } });
    if (url === "/api/models/defaults") return jsonResponse({ data: { defaults: {}, modelReadiness: { ready: true, detail: "Fixture ready" } } });
    if (url === "/api/models" || url === "/api/gateway/models") return jsonResponse({ data: { models: [] } });
    throw new Error(`Unexpected chat boundary: ${method} ${url}`);
  });
});
afterEach(() => { client.clear(); global.fetch = originalFetch; global.EventSource = originalSource; jest.useRealTimers(); });
async function mount() {
  const hook = renderHook(() => useChatPage(), { wrapper: Wrapper });
  await waitFor(() => expect(hook.result.current.gatewayOnline).toBe(true));
  if (rows.length) await waitFor(() => expect(hook.result.current.messages[0]?.content).toBe(`Saved transcript ${rows[0].id}`));
  return hook;
}
type Chat = Awaited<ReturnType<typeof mount>>;
async function select(hook: Chat, id: string) {
  act(() => hook.result.current.handleSelectConversation(id));
  await waitFor(() => expect(hook.result.current.messages[0]?.content).toBe(`Saved transcript ${id}`));
}
async function send(hook: Chat) {
  act(() => hook.result.current.setInput("Explicit operator message"));
  await act(async () => { await hook.result.current.handleSend(); });
  return ControlledSource.all.at(-1)!;
}
function state(hook: Chat) { const h = hook.result.current; return { activeId: h.activeId, input: h.input, messages: h.messages, approval: h.pendingApproval, streaming: h.isStreaming }; }

it("New Chat completion cannot replace a later selected conversation", async () => {
  const hook = await mount(), held = deferred<Response>();
  override = (url, init) => url === "/api/chat" && init?.method === "POST" ? held.promise : undefined;
  let pending!: Promise<void>; act(() => { pending = hook.result.current.handleNewChat(); });
  await select(hook, "B"); act(() => hook.result.current.setInput("Fresh B draft")); const before = state(hook);
  await act(async () => { held.resolve(jsonResponse({ data: { conversation: conversation("N", "New Chat") } }, 201)); await pending; });
  expect(state(hook)).toEqual(before);
});

it("New Chat completion preserves text typed after creation began", async () => {
  const hook = await mount(), held = deferred<Response>();
  override = (url, init) => url === "/api/chat" && init?.method === "POST" ? held.promise : undefined;
  let pending!: Promise<void>; act(() => { pending = hook.result.current.handleNewChat(); });
  act(() => hook.result.current.setInput("Fresh draft while creating"));
  await act(async () => { held.resolve(jsonResponse({ data: { conversation: conversation("N", "New Chat") } }, 201)); await pending; });
  expect(hook.result.current.input).toBe("Fresh draft while creating");
});

it("send preflight creation cannot clear a newer conversation draft", async () => {
  rows = []; const hook = await mount(), held = deferred<Response>();
  override = (url, init) => url === "/api/chat" && init?.method === "POST" ? held.promise : undefined;
  act(() => hook.result.current.setInput("First send"));
  let pending!: Promise<void>; act(() => { pending = hook.result.current.handleSend(); });
  rows = [conversation("B")]; await act(async () => { await hook.result.current.reloadConversations(); });
  await select(hook, "B"); act(() => hook.result.current.setInput("B owns this draft")); const before = state(hook);
  await act(async () => { held.resolve(jsonResponse({ data: { conversation: conversation("N") } }, 201)); await pending; });
  expect(state(hook)).toEqual(before);
  expect(calls.filter(c => c.method === "POST" && c.url.endsWith("/messages"))).toEqual([]);
});

it("first-chat detail cannot erase a live turn after automatic conversation creation", async () => {
  rows = []; const hook = await mount(), emptyDetail = deferred<Response>();
  expect(hook.result.current.activeId).toBeNull(); expect(hook.result.current.messages).toEqual([]);
  override = (url, init) => {
    if (url === "/api/chat" && init?.method === "POST") rows = [conversation("N", "New Chat")];
    if (url === "/api/chat/N" && (init?.method ?? "GET") === "GET") return emptyDetail.promise;
  };
  const source = await send(hook);
  await waitFor(() => expect(calls.some(c => c.url === "/api/chat/N" && c.method === "GET")).toBe(true));
  expect(hook.result.current.activeId).toBe("N");
  expect(calls.filter(c => c.url === "/api/chat/N/messages" && c.method === "POST")).toHaveLength(1);
  act(() => source.emit("message.delta", { delta: "Current first answer" }));
  expect(hook.result.current.messages.map(m => m.content)).toEqual(["Explicit operator message", "Current first answer"]);
  const live = state(hook); expect(live.streaming).toBe(true);
  await act(async () => { emptyDetail.resolve(jsonResponse({ data: { conversation: conversation("N", "New Chat"), messages: [] } })); });
  expect(state(hook)).toEqual(live); expect(source.closed).toBe(false);
  act(() => source.emit("message.delta", { delta: " continues" }));
  expect(hook.result.current.messages.at(-1)?.content).toBe("Current first answer continues");
});

it("late send failure cannot change the current conversation state", async () => {
  const hook = await mount(), held = deferred<Response>();
  override = (url, init) => url === "/api/chat/A/messages" && init?.method === "POST" ? held.promise : undefined;
  act(() => hook.result.current.setInput("Send A")); let pending!: Promise<void>;
  act(() => { pending = hook.result.current.handleSend(); }); await select(hook, "B");
  act(() => hook.result.current.setInput("Fresh B")); const before = state(hook);
  await act(async () => { held.resolve(jsonResponse({ error: "A refused" }, 500)); await pending; });
  expect(state(hook)).toEqual(before);
});

it.each(["message.delta", "tool.approval_required", "run.completed"])("queued agent events cannot change state after conversation selection [%s]", async type => {
  const hook = await mount(), source = await send(hook); await select(hook, "B");
  expect(source.closed).toBe(true); const before = state(hook);
  act(() => source.emit(type, { delta: "obsolete", name: "obsolete-tool", output: "obsolete" }));
  expect(state(hook)).toEqual(before);
});

it("an obsolete terminal event cannot close the current stream", async () => {
  const hook = await mount(), old = await send(hook); await select(hook, "B"); const current = await send(hook);
  act(() => current.emit("tool.approval_required", { name: "current-tool" }));
  const before = state(hook); act(() => old.emit("run.completed", { output: "obsolete" }));
  expect(current.closed).toBe(false); expect(state(hook)).toEqual(before);
  act(() => current.emit("message.delta", { delta: "Current output" }));
  expect(hook.result.current.messages.at(-1)?.content).toBe("Current output");
});

it("returning to a conversation does not reactivate its obsolete work", async () => {
  const hook = await mount(), old = await send(hook); await select(hook, "B"); await select(hook, "A");
  act(() => hook.result.current.setInput("New A draft")); const before = state(hook);
  act(() => old.emit("tool.approval_required", { name: "obsolete A approval" }));
  expect(state(hook)).toEqual(before);
});

it("late fast-stream output cannot change the selected conversation", async () => {
  const hook = await mount(); const chunk = deferred<{ done: boolean; value?: Uint8Array }>(); let read = false;
  override = url => url === "/api/orchestration/chat" ? Promise.resolve({ ok: true, body: { getReader: () => ({ read: () => { if (read) return Promise.resolve({ done: true }); read = true; return chunk.promise; }, releaseLock: () => {} }) } } as unknown as Response) : undefined;
  act(() => { hook.result.current.handleModeChange("fast"); hook.result.current.setInput("Fast A"); });
  let pending!: Promise<void>; act(() => { pending = hook.result.current.handleSend(); });
  await waitFor(() => expect(read).toBe(true)); await select(hook, "B"); const before = state(hook);
  await act(async () => { chunk.resolve({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"obsolete"}}]}\n\n') }); await pending; });
  expect(state(hook)).toEqual(before);
});

it.each(["before recovery starts", "while recovery is pending"])("stream recovery cannot replace a conversation selected %s", async phase => {
  jest.useFakeTimers(); const hook = await mount(), source = await send(hook), held = deferred<Response>(); let recoveryStarted = false;
  override = (url, init) => url === "/api/chat/A" && !init?.method ? (recoveryStarted = true, held.promise) : undefined;
  act(() => source.fail());
  if (phase === "while recovery is pending") { await act(async () => { await jest.advanceTimersByTimeAsync(1500); }); expect(recoveryStarted).toBe(true); }
  await select(hook, "B"); const before = state(hook);
  await act(async () => { await jest.advanceTimersByTimeAsync(1500); held.resolve(jsonResponse({ data: { conversation: conversation("A"), messages: [message("A")] } })); });
  expect(state(hook)).toEqual(before);
});

it("late Stop reconciliation cannot replace the selected conversation", async () => {
  const hook = await mount(); await send(hook); const held = deferred<Response>();
  override = url => url === "/api/chat/A/stop" ? held.promise : undefined;
  let pending!: Promise<void>; act(() => { pending = hook.result.current.handleStop(); }); await select(hook, "B"); const before = state(hook);
  await act(async () => { held.resolve(jsonResponse({ data: {} })); await pending; }); expect(state(hook)).toEqual(before);
});

it("late approval completion cannot clear a newer approval", async () => {
  const hook = await mount(), old = await send(hook), held = deferred<Response>();
  act(() => old.emit("tool.approval_required", { name: "A-tool" }));
  override = url => url === "/api/chat/A/approval" ? held.promise : undefined;
  let pending!: Promise<void>; act(() => { pending = hook.result.current.handleApproval(true); });
  await select(hook, "B"); const current = await send(hook); act(() => current.emit("tool.approval_required", { name: "B-tool" }));
  const approval = hook.result.current.pendingApproval;
  await act(async () => { held.resolve(jsonResponse({ data: {} })); await pending; });
  expect(hook.result.current.pendingApproval).toEqual(approval);
});

it("current generation completion still reconciles its own conversation", async () => {
  const hook = await mount(), source = await send(hook);
  act(() => source.emit("message.delta", { delta: "Owned answer" })); act(() => source.emit("run.completed", {}));
  expect(hook.result.current.messages.at(-1)).toMatchObject({ content: "Owned answer", status: "complete" });
  expect(hook.result.current.isStreaming).toBe(false); expect(source.closed).toBe(true);
  await waitFor(() => expect(calls.some(c => c.url === "/api/chat/A/messages/reply-A" && c.method === "PATCH")).toBe(true));
});

it("New Chat reuses an existing blank conversation without posting", async () => {
  rows.push(conversation("blank", "New Chat")); const hook = await mount();
  await act(async () => { await hook.result.current.handleNewChat(); });
  expect(hook.result.current.activeId).toBe("blank");
  expect(calls.filter(c => c.url === "/api/chat" && c.method === "POST")).toEqual([]);
});
