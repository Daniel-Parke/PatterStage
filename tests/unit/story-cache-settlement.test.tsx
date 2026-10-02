/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StoryReaderPage from "@/app/recroom/story-weaver/[id]/page";
import { useApiResource } from "@/hooks/useApiResource";
import type { StoryState } from "@/modules/rec-room/components/story-reader-types";
import { halfWritten } from "../helpers/story";
import { jsonResponse } from "../helpers/fetch-map";

// Source-informed independent settlement oracle. All reader actions, mutations,
// cancellation and query publication are real; only navigation/icons and HTTP
// transport are controlled. No provider or server is contacted.
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }), useParams: () => ({ id: "S-1" }),
  usePathname: () => "/recroom/story-weaver/S-1", useSearchParams: () => new URLSearchParams(),
}));
jest.mock("lucide-react", () => jest.requireActual("../helpers/story").lucideNullMock());

interface StoryRequest {
  action: string;
  storyId: string;
  chapters?: { number: number; readStatus: string }[];
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const savedFetch = global.fetch;
let client: QueryClient;
let current: StoryState;
let requests: { body: StoryRequest; init?: RequestInit }[];
let unexpected: string[];
let intercept: (body: StoryRequest, init?: RequestInit) => Promise<Response> | undefined;
function Provider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const calls = (action: string) => requests.filter(request => request.body.action === action);
async function settle() {
  // Bounded notification turns, with no wall-clock sleep or runAllTimers loop.
  for (let turn = 0; turn < 5; turn++) {
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
  }
}
beforeEach(() => {
  jest.useFakeTimers(); localStorage.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  current = { ...halfWritten(), updatedAt: "2026-10-02T12:00:00.000Z" };
  requests = []; unexpected = []; intercept = () => undefined;
  global.fetch = jest.fn(async (input, init) => {
    if (String(input) !== "/api/stories" || init?.method !== "POST") {
      unexpected.push(`${init?.method ?? "GET"} ${String(input)}`);
      throw new Error("Unexpected Story transport");
    }
    const body = JSON.parse(String(init.body)) as StoryRequest;
    requests.push({ body, init });
    const held = intercept(body, init);
    if (held) return held;
    if (body.action === "load") return jsonResponse({ data: current });
    if (body.action === "spend") return jsonResponse({ data: { spend: null } });
    unexpected.push(body.action);
    throw new Error(`Unexpected Story action: ${body.action}`);
  });
});
afterEach(() => {
  cleanup(); client.clear(); global.fetch = savedFetch; jest.useRealTimers();
  expect(unexpected).toEqual([]);
});
async function mount() {
  const view = render(<StoryReaderPage />, { wrapper: Provider });
  await settle();
  expect(screen.getByRole("heading", { level: 1, name: current.title })).toBeInTheDocument();
  return view;
}
function observeStory() {
  // A real second projection of the shared raw cache; it does not issue a read.
  return renderHook(() => useApiResource<StoryState>("/api/stories", {
    body: { action: "load", storyId: "S-1" },
    select: data => data as StoryState,
    enabled: false,
  }), { wrapper: Provider });
}
function chapterButton(number: 1 | 2) {
  const sidebar = within(screen.getByRole("complementary", { name: "Chapters" }));
  return sidebar.getByRole("button", { name: number === 1 ? /^The Departure/ : /^The Signal/ });
}
function visibleFlags() {
  return [1, 2].map(number => within(chapterButton(number as 1 | 2)).queryByLabelText("Read") !== null);
}
function cachedFlags(observer: ReturnType<typeof observeStory>) {
  return observer.result.current.data?.chapters.slice(0, 2).map(chapter => chapter.readStatus === "read");
}
function confirmation(number: number) {
  return jsonResponse({ data: { chapters: [{ number, readStatus: "read" }] } });
}
function parkUpdates() {
  const pending = new Map<number, ReturnType<typeof deferred<Response>>>();
  intercept = body => {
    if (body.action !== "update") return;
    const number = body.chapters![0].number;
    const held = deferred<Response>(); pending.set(number, held); return held.promise;
  };
  return pending;
}

it("automatic title repair does not feed itself when placeholder titles remain and updatedAt advances", async () => {
  current = { ...current, chapters: current.chapters.map(chapter => chapter.number === 1 ? { ...chapter, title: "Chapter 1" } : chapter) };
  const pending: ReturnType<typeof deferred<Response>>[] = [];
  intercept = body => {
    if (body.action !== "sync-titles") return;
    const held = deferred<Response>(); pending.push(held); return held.promise;
  };
  await mount();
  expect(calls("sync-titles")).toHaveLength(1);
  // Each answer is a valid, newer server snapshot that could not repair the
  // placeholder. Never automatically answer the next request: cap at 3 releases.
  for (let index = 0; index < 3; index++) {
    const held = pending[index];
    if (!held) break;
    current = { ...current, updatedAt: `2026-10-02T12:00:0${index + 1}.000Z` };
    await act(async () => { held.resolve(jsonResponse({ data: { story: current } })); });
    await settle();
  }
  expect(calls("load")).toHaveLength(1);
  expect(calls("generate-chapter")).toHaveLength(0);
  expect(calls("sync-titles")).toHaveLength(1);
});

it("successful automatic title repair publishes the repaired title once without generating a chapter", async () => {
  current = { ...current, chapters: current.chapters.map(chapter => chapter.number === 1 ? { ...chapter, title: "Chapter 1" } : chapter) };
  intercept = body => {
    if (body.action !== "sync-titles") return;
    current = { ...current, updatedAt: "2026-10-02T12:01:00.000Z", chapters: current.chapters.map(chapter => chapter.number === 1 ? { ...chapter, title: "The Departure" } : chapter) };
    return Promise.resolve(jsonResponse({ data: { story: current } }));
  };
  await mount();
  const observer = observeStory(); await settle();
  expect(chapterButton(1)).toBeInTheDocument();
  expect(observer.result.current.data?.chapters[0].title).toBe("The Departure");
  expect(calls("sync-titles")).toHaveLength(1);
  expect(requests.filter(request => !["load", "spend", "sync-titles"].includes(request.body.action))).toEqual([]);
});

it("failed automatic title repair remains nonfatal and does not retry itself", async () => {
  current = { ...current, chapters: current.chapters.map(chapter => chapter.number === 1 ? { ...chapter, title: "Chapter 1" } : chapter) };
  intercept = body => body.action === "sync-titles" ? Promise.resolve(jsonResponse({ error: "Owned title refusal" }, 503)) : undefined;
  await mount(); await settle();
  expect(calls("sync-titles")).toHaveLength(1);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Write chapter 3" })).toBeEnabled();
  expect(calls("generate-chapter")).toHaveLength(0);
});

it("one confirmed partial read-status save preserves the full story and reaches the shared cache", async () => {
  const pending = parkUpdates(); await mount(); const observer = observeStory();
  fireEvent.click(chapterButton(1)); await settle();
  expect(calls("update").map(request => request.body)).toEqual([{ action: "update", storyId: "S-1", chapters: [{ number: 1, readStatus: "read" }] }]);
  await act(async () => { pending.get(1)!.resolve(confirmation(1)); }); await settle();
  expect({ visible: visibleFlags(), cached: cachedFlags(observer) }).toEqual({ visible: [true, false], cached: [true, false] });
  expect(observer.result.current.data).toMatchObject({ title: current.title, chapterContents: current.chapterContents });
  expect(observer.result.current.data?.chapters).toHaveLength(4);
});

it.each([[1, 2], [2, 1]])("simultaneous confirmations retain both read flags in reader and shared cache [arrival %i then %i]", async (first, second) => {
  const pending = parkUpdates(); await mount(); const observer = observeStory();
  fireEvent.click(chapterButton(1)); fireEvent.click(chapterButton(2)); await settle();
  expect(calls("update").map(request => request.body.chapters)).toEqual([
    [{ number: 1, readStatus: "read" }], [{ number: 2, readStatus: "read" }],
  ]);
  await act(async () => {
    pending.get(first)!.resolve(confirmation(first));
    pending.get(second)!.resolve(confirmation(second));
  });
  await settle();
  expect({ visible: visibleFlags(), cached: cachedFlags(observer) }).toEqual({ visible: [true, true], cached: [true, true] });
  expect(observer.result.current.data?.chapterContents).toEqual(current.chapterContents);
  expect(calls("generate-chapter")).toHaveLength(0);
});

it("separately settled read-status confirmations preserve the earlier confirmed flag", async () => {
  const pending = parkUpdates(); await mount(); const observer = observeStory();
  for (const number of [1, 2] as const) {
    fireEvent.click(chapterButton(number)); await settle();
    await act(async () => { pending.get(number)!.resolve(confirmation(number)); }); await settle();
    expect(cachedFlags(observer)?.[number - 1]).toBe(true);
  }
  expect({ visible: visibleFlags(), cached: cachedFlags(observer) }).toEqual({ visible: [true, true], cached: [true, true] });
});

it("a refused read-status save remains unread and exposes its error without cache corruption", async () => {
  const pending = parkUpdates(); await mount(); const observer = observeStory();
  fireEvent.click(chapterButton(1)); await settle();
  await act(async () => { pending.get(1)!.resolve(jsonResponse({ error: "Owned read-status refusal" }, 503)); }); await settle();
  expect(screen.getByRole("alert")).toHaveTextContent("Owned read-status refusal");
  expect({ visible: visibleFlags(), cached: cachedFlags(observer) }).toEqual({ visible: [false, false], cached: [false, false] });
});

it("mount and cache publication never authorise generation, and explicit Write remains stoppable", async () => {
  const generation = deferred<Response>(); let signal: AbortSignal | undefined;
  intercept = (body, init) => {
    if (body.action === "update") return Promise.resolve(confirmation(body.chapters![0].number));
    if (body.action !== "generate-chapter") return;
    signal = init?.signal ?? undefined;
    signal?.addEventListener("abort", () => generation.reject(new DOMException("Owned stop", "AbortError")), { once: true });
    return generation.promise;
  };
  await mount();
  fireEvent.click(chapterButton(1)); await settle();
  expect(calls("generate-chapter")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Write chapter 3" })); await settle();
  expect(calls("generate-chapter").map(request => request.body)).toEqual([{ action: "generate-chapter", storyId: "S-1" }]);
  expect(signal?.aborted).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: /stop/i })); await settle();
  expect(signal?.aborted).toBe(true);
  expect(calls("generate-chapter")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: /stop/i })).not.toBeInTheDocument();
});
