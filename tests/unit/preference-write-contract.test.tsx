/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOperatorPrefs } from "@/hooks/useOperatorPrefs";
import Sidebar from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { jsonResponse } from "../helpers/fetch-map";

jest.mock("next/navigation", () => ({ usePathname: () => "/" }));
jest.mock("@/components/layout/RailFooter", () => ({ RailFooter: () => null }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const originalFetch = global.fetch;
let client: QueryClient;
let prefs: Record<string, unknown>;
let write: (body: { key: string; value: unknown }) => Promise<Response>;
let calls: { url: string; method: string; body?: { key: string; value: unknown } }[];
function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  prefs = { "quests.skipped": ["old"], "sidebar.collapsed": false };
  calls = [];
  write = async ({ key, value }) => { prefs = { ...prefs, [key]: value }; return jsonResponse({ data: { prefs } }); };
  global.fetch = jest.fn(async (input, init) => {
    const url = String(input), method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    if (url === "/api/prefs") return method === "PUT" ? write(body) : jsonResponse({ data: { prefs } });
    if (url === "/api/stats") return jsonResponse({ data: { stats: { quests: { total: 0, completed: 0 } } } });
    if (url.includes("flags")) return jsonResponse({ data: { flags: {} } });
    throw new Error(`Unexpected preference boundary: ${method} ${url}`);
  });
});
afterEach(() => { client.clear(); global.fetch = originalFetch; });

it("preference success refreshes every observer of the shared preference key", async () => {
  const { result } = renderHook(() => ({ a: useOperatorPrefs(), b: useOperatorPrefs() }), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.b.prefs["quests.skipped"]).toEqual(["old"]));
  act(() => result.current.a.setPref("quests.skipped", ["old", "new"]));
  await waitFor(() => expect(result.current.b.prefs["quests.skipped"]).toEqual(["old", "new"]));
  expect(result.current.a.prefs).toEqual(result.current.b.prefs);
  expect(calls.filter(c => c.method === "PUT")).toEqual([{ url: "/api/prefs", method: "PUT", body: { key: "quests.skipped", value: ["old", "new"] } }]);
});

it("preference failure exposes pending and error without pretending persistence", async () => {
  const pending = deferred<Response>(); write = () => pending.promise;
  const { result } = renderHook(() => useOperatorPrefs(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.prefs["quests.skipped"]).toEqual(["old"]));
  act(() => result.current.setPref("quests.skipped", ["new"]));
  await waitFor(() => expect(result.current.saving).toBe(true));
  await act(async () => pending.resolve(jsonResponse({ error: "Read-only preference refusal" }, 403)));
  await waitFor(() => expect(result.current.saveError).toBe("Read-only preference refusal"));
  expect(result.current.saving).toBe(false);
  expect(result.current.prefs["quests.skipped"]).toEqual(["old"]);
  write = async () => { prefs = { "quests.skipped": ["new"] }; return jsonResponse({ data: { prefs } }); };
  act(() => result.current.setPref("quests.skipped", ["new"]));
  await waitFor(() => expect(result.current.prefs["quests.skipped"]).toEqual(["new"]));
  expect(result.current.saveError).toBeNull();
});

it.each(["offline", "read-only"])("Sidebar preference failure preserves its local choice without a toast [%s]", async (failure) => {
  write = async () => { if (failure === "offline") throw new Error("Offline"); return jsonResponse({ error: "Read only" }, 403); };
  render(<Wrapper><SidebarProvider><Sidebar initialCollapsed={false} /></SidebarProvider></Wrapper>);
  fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
  await waitFor(() => expect(calls.filter(c => c.method === "PUT")).toHaveLength(1));
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByRole("button", { name: /expand sidebar/i })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(prefs["sidebar.collapsed"]).toBe(false);
});

it("Sidebar uses its server initial value without adding a preference read", async () => {
  render(<Wrapper><SidebarProvider><Sidebar initialCollapsed /></SidebarProvider></Wrapper>);
  expect(screen.getByRole("button", { name: /expand sidebar/i })).toBeInTheDocument();
  await act(async () => { await Promise.resolve(); });
  expect(calls.filter(c => c.url === "/api/prefs")).toEqual([]);
});
