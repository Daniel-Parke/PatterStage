/** @jest-environment jsdom */
import { within } from "@testing-library/react";
import { act, render } from "@testing-library/react";
import GenerateOverlay from "@/modules/rec-room/components/GenerateOverlay";

describe("T0191 truthful Story progress", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it("elapsed time never invents percentage or completion for pending work", () => {
    const complete = jest.fn();
    const { container } = render(<GenerateOverlay title="Writing chapter" visible done={false} onComplete={complete} />);
    for (const elapsed of [1000, 10000, 120000]) {
      act(() => jest.advanceTimersByTime(elapsed));
      expect(container.textContent).not.toMatch(/\d+\s*%/);
      expect(container.querySelector('[aria-valuenow]')).toBeNull();
      expect(complete).not.toHaveBeenCalled();
    }
  });
  it("confirmed completion invokes exactly one callback after 2000ms", () => {
    const complete = jest.fn();
    render(<GenerateOverlay title="Writing chapter" visible done onComplete={complete} />);
    act(() => jest.advanceTimersByTime(1999));
    expect(complete).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(complete).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(10000));
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it.each(["hidden", "unmounted"])("%s work cannot deliver an obsolete completion", (mode) => {
    const complete = jest.fn();
    const view = render(<GenerateOverlay title="Writing chapter" visible done onComplete={complete} />);
    act(() => jest.advanceTimersByTime(1000));
    if (mode === "hidden") view.rerender(<GenerateOverlay title="Writing chapter" visible={false} done onComplete={complete} />);
    else view.unmount();
    act(() => jest.advanceTimersByTime(10000));
    expect(complete).not.toHaveBeenCalled();
  });
});

import { fireEvent, screen, waitFor, cleanup, renderHook } from "@testing-library/react";
import StoryReaderPage from "@/app/recroom/story-weaver/[id]/page";
import { halfWritten, story, type Body } from "../helpers/story";
import { jsonResponse } from "../helpers/fetch-map";
import { queryWrapper } from "../helpers/render-with-query";
import { pendingLookup } from "../helpers/mission-async-deferred";
import { useToast } from "@/components/ui/Toast";
import { FeedbackProvider } from "@/components/providers/FeedbackProvider";
import { useMissionsPage } from "@/hooks/useMissionsPage";
import { detail, LIST, missionRow } from "../helpers/mission-link-query-fixture";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "S-1" }), usePathname: () => "/work/missions",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

import { useApiResource } from "@/hooks/useApiResource";
import type { StoryState } from "@/modules/rec-room/components/story-reader-types";
const previousFetch = globalThis.fetch;
let ReaderQuery = queryWrapper();
type StoryAction = "edit-chapter" | "continue";
const completedStory = () => story([{ number: 1, title: "The Departure", status: "complete", wordCount: 100 }], { status: "complete" });
let currentStory = completedStory();
let storyRequests: { body: Body; init?: RequestInit }[];
let reply: (action: string, init?: RequestInit) => Promise<Response> | undefined;

async function mountReader(initial = completedStory()) {
  currentStory = initial;
  render(<StoryReaderPage />, { wrapper: ReaderQuery });
  await screen.findByRole("heading", { level: 1, name: initial.title });
}
function requestStoryAction(action: StoryAction) {
  const edit = action === "edit-chapter";
  fireEvent.click(screen.getByTitle(edit ? "Edit this chapter" : "Continue this story"));
  fireEvent.change(screen.getByPlaceholderText(edit ? /Make the dialogue/i : /A new threat/i), { target: { value: "An explicit synthetic request" } });
  fireEvent.click(screen.getByRole("button", { name: edit ? /^Edit chapter$/i : /^Continue story$/i }));
}
const storyCalls = (action: string) => storyRequests.filter(request => request.body.action === action);

describe("T0191 actual Reader edit and continue lifecycle", () => {
  beforeEach(() => {
    ReaderQuery = queryWrapper(); localStorage.clear(); storyRequests = []; reply = () => undefined;
    globalThis.fetch = jest.fn(async (input, init) => {
      if (String(input) !== "/api/stories") throw new Error(`Unexpected Reader HTTP: ${String(input)}`);
      const body = JSON.parse(String(init?.body ?? "{}")) as Body;
      storyRequests.push({ body, init });
      const held = reply(String(body.action), init); if (held) return held;
      if (body.action === "load") return jsonResponse({ data: currentStory });
      if (body.action === "spend") return jsonResponse({ data: { spend: null } });
      if (body.action === "update" || body.action === "sync-titles") return jsonResponse({ data: { story: currentStory } });
      throw new Error(`Unexpected Reader action: ${String(body.action)}`);
    });
  });
  afterEach(() => { cleanup(); globalThis.fetch = previousFetch; jest.useRealTimers(); });
  it.each((["edit-chapter", "continue"] as const).flatMap(action => ["HTTP", "network"].map(failure => ({ action, failure }))))("$action $failure failure retains chapter data and never announces ready", async ({ action, failure }) => {
    reply = operation => operation === action ? failure === "HTTP" ? Promise.resolve(jsonResponse({ error: "Owned request refused" }, 503)) : Promise.reject(new Error("Owned request refused")) : undefined;
    await mountReader();
    jest.useFakeTimers();
    requestStoryAction(action);
    await act(async () => { await jest.advanceTimersByTimeAsync(0); });
    expect(storyCalls(action)).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Owned request refused");
    expect(document.body.textContent).toContain("Text of chapter 1.");
    expect(document.body.textContent).not.toMatch(/your story is ready|ready to read/i);
    await act(async () => { await jest.advanceTimersByTimeAsync(2500); });
    expect(document.body.textContent).not.toMatch(/your story is ready|ready to read/i);
    expect(storyCalls("generate-chapter")).toHaveLength(0);
  });
  it.each(["edit-chapter", "continue"] as const)("held %s registers a client abort, clears its overlay and rereads truth neutrally", async action => {
    const held = pendingLookup<Response>();
    reply = (operation, init) => {
      if (operation !== action) return;
      init?.signal?.addEventListener("abort", () => held.fail(new DOMException("Owned cancellation", "AbortError")), { once: true });
      return held.promise;
    };
    await mountReader(); requestStoryAction(action);
    await waitFor(() => expect(storyCalls(action)).toHaveLength(1));
    const request = storyCalls(action)[0];
    const stop = screen.getByRole("button", { name: /^Stop$/i });
    expect(stop).toBeEnabled();
    const reads = storyCalls("load").length;
    currentStory = { ...currentStory, title: "Confirmed server truth" };
    fireEvent.click(stop); fireEvent.click(stop);
    await waitFor(() => expect(request.init?.signal?.aborted).toBe(true));
    await screen.findByRole("heading", { level: 1, name: "Confirmed server truth" });
    expect(storyCalls("load").length).toBeGreaterThan(reads);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/your story is ready|ready to read|muse is visiting/i);
    expect(storyCalls(action)).toHaveLength(1);
    expect(storyCalls("generate-chapter")).toHaveLength(0);
  });
  it("reselecting the current chapter resets the reading container to the top", async () => {
    await mountReader(halfWritten());
    await screen.findByText("Text of chapter 1.");
    const chapter = within(screen.getAllByRole("group", { name: "Chapters" })[0]).getByRole("button", { name: "Chapter 1: The Departure (complete)" });
    expect(chapter).toBeEnabled();
    expect(chapter).toHaveAttribute("aria-current", "true");
    const heading = screen.getByRole("heading", { level: 2, name: /The Departure/ });
    const readingContainer = heading.closest<HTMLElement>(".overflow-y-auto");
    expect(readingContainer).not.toBeNull();
    if (!readingContainer) throw new Error("The chapter heading must belong to the actual reading container");
    expect(readingContainer).toHaveTextContent("Text of chapter 1.");
    readingContainer.scrollTop = 240;
    expect(readingContainer.scrollTop).toBe(240);
    fireEvent.click(chapter);
    expect(readingContainer.isConnected).toBe(true);
    expect(screen.getByRole("heading", { level: 2, name: /The Departure/ }).closest(".overflow-y-auto")).toBe(readingContainer);
    expect(readingContainer.scrollTop).toBe(0);
    expect(chapter).toHaveAttribute("aria-current", "true");
    expect(readingContainer).toHaveTextContent("Text of chapter 1.");
    for (const action of ["generate-chapter", "retry-chapter", "edit-chapter", "continue"]) expect(storyCalls(action)).toHaveLength(0);
  });
  it("generate plus edit retains Stop when one settles and suppresses late reactivation after Stop", async () => {
    const generation = pendingLookup<Response>(), edit = pendingLookup<Response>();
    reply = operation => operation === "generate-chapter" ? generation.promise : operation === "edit-chapter" ? edit.promise : undefined;
    await mountReader(halfWritten());
    fireEvent.click(screen.getByRole("button", { name: "Write chapter 3" }));
    requestStoryAction("edit-chapter");
    await waitFor(() => expect(storyCalls("edit-chapter")).toHaveLength(1));
    await act(async () => { generation.complete(jsonResponse({ data: { story: currentStory } })); });
    const stop = screen.getByRole("button", { name: /^Stop$/i });
    fireEvent.click(stop);
    expect(storyCalls("edit-chapter")[0].init?.signal?.aborted).toBe(true);
    await act(async () => { edit.complete(jsonResponse({ data: { story: currentStory } })); });
    expect(storyCalls("generate-chapter")).toHaveLength(1);
    expect(storyCalls("edit-chapter")).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/your story is ready|ready to read|muse is visiting/i);
  });
  it("edit-first settlement retains operable Stop while generation remains outstanding", async () => {
    const generation = pendingLookup<Response>(), edit = pendingLookup<Response>();
    reply = operation => operation === "generate-chapter" ? generation.promise : operation === "edit-chapter" ? edit.promise : undefined;
    await mountReader(halfWritten());
    const observer = renderHook(() => useApiResource<StoryState>("/api/stories", { body: { action: "load", storyId: "S-1" }, enabled: false, select: data => data as StoryState }), { wrapper: ReaderQuery });
    jest.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "Write chapter 3" }));
      requestStoryAction("edit-chapter");
      await act(async () => { await jest.advanceTimersByTimeAsync(0); });
      expect(storyCalls("generate-chapter")).toHaveLength(1);
      expect(storyCalls("edit-chapter")).toHaveLength(1);
      const signal = storyCalls("generate-chapter")[0].init?.signal;
      expect(signal).toBeDefined();
      currentStory = { ...currentStory, chapterContents: { ...currentStory.chapterContents, "1": "Confirmed reverse-settlement edit." } };
      await act(async () => { edit.complete(jsonResponse({ data: { story: currentStory } })); await jest.advanceTimersByTimeAsync(0); });
      expect(observer.result.current.data?.chapterContents?.["1"]).toBe("Confirmed reverse-settlement edit.");
      expect(signal?.aborted).toBe(false);
      expect(screen.getByRole("button", { name: /^Stop$/i })).toBeVisible();
      expect(screen.getByRole("button", { name: /^Stop$/i })).toBeEnabled();
      await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
      const stop = screen.getByRole("button", { name: /^Stop$/i });
      expect(stop).toBeVisible();
      expect(stop).toBeEnabled();
      expect(signal?.aborted).toBe(false);
      fireEvent.click(stop);
      expect(signal?.aborted).toBe(true);
      await act(async () => { generation.complete(jsonResponse({ data: { story: currentStory } })); await jest.advanceTimersByTimeAsync(2500); });
      expect(storyCalls("generate-chapter")).toHaveLength(1);
      expect(storyCalls("edit-chapter")).toHaveLength(1);
      expect(storyCalls("continue")).toHaveLength(0);
      expect(document.body.textContent).not.toMatch(/your story is ready|ready to read|muse is visiting/i);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      await act(async () => { edit.complete(jsonResponse({ data: { story: currentStory } })); generation.complete(jsonResponse({ data: { story: currentStory } })); await jest.advanceTimersByTimeAsync(0); });
    }
  });
  it.each(["edit-chapter", "continue"] as const)("successful %s publishes confirmed data and completes its overlay", async action => {
    const held = pendingLookup<Response>();
    reply = operation => operation === action ? held.promise : undefined;
    await mountReader();
    const observer = renderHook(() => useApiResource<StoryState>("/api/stories", { body: { action: "load", storyId: "S-1" }, enabled: false, select: data => data as StoryState }), { wrapper: ReaderQuery });
    jest.useFakeTimers(); requestStoryAction(action);
    await act(async () => { await jest.advanceTimersByTimeAsync(0); });
    expect(storyCalls(action)).toHaveLength(1);
    currentStory = action === "continue" ? { ...currentStory, status: "active", chapters: [...currentStory.chapters, ...[2, 3, 4].map(number => ({ number, title: "Continuation " + number, status: "pending", wordCount: 0 }))] } : { ...currentStory, chapterContents: { "1": "Confirmed edited chapter." } };
    reply = operation => operation === "generate-chapter" ? new Promise<Response>(() => {}) : undefined;
    await act(async () => { held.complete(jsonResponse({ data: action === "continue" ? currentStory : { story: currentStory } })); await jest.advanceTimersByTimeAsync(1); });
    expect(observer.result.current.data?.chapters).toEqual(currentStory.chapters);
    expect(observer.result.current.data?.chapterContents).toEqual(currentStory.chapterContents);
    expect(document.body.textContent).toMatch(/your story is ready/i);
    await act(async () => { await jest.advanceTimersByTimeAsync(2000); });
    expect(document.body.textContent).not.toMatch(/your story is ready/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(storyCalls(action)).toHaveLength(1);
  });
  it("Stop aborts both concurrent generate and edit requests before either settles", async () => {
    const generation = pendingLookup<Response>(), edit = pendingLookup<Response>();
    reply = operation => operation === "generate-chapter" ? generation.promise : operation === "edit-chapter" ? edit.promise : undefined;
    await mountReader(halfWritten());
    fireEvent.click(screen.getByRole("button", { name: "Write chapter 3" }));
    requestStoryAction("edit-chapter");
    await waitFor(() => expect(storyCalls("edit-chapter")).toHaveLength(1));
    const stop = screen.getByRole("button", { name: /^Stop$/i });
    fireEvent.click(stop);
    for (const operation of ["generate-chapter", "edit-chapter"]) expect(storyCalls(operation)[0].init?.signal?.aborted).toBe(true);
    await act(async () => { generation.complete(jsonResponse({ data: { story: currentStory } })); });
    expect(screen.getByRole("button", { name: /^Stop$/i })).toBeEnabled();
    await act(async () => { edit.complete(jsonResponse({ data: { story: currentStory } })); });
    expect(storyCalls("generate-chapter")).toHaveLength(1);
    expect(storyCalls("edit-chapter")).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/your story is ready|muse is visiting/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("T0191 Mission cancellation owns pending feedback", () => {
  afterEach(() => { cleanup(); globalThis.fetch = previousFetch; jest.useRealTimers(); });
  it.each(["success", "refusal"].flatMap(outcome => [true, false].map(provider => ({ outcome, provider }))))("$outcome settlement clears only its pending message before normal expiry [provider=$provider]", async ({ outcome, provider }) => {
    jest.useFakeTimers();
    const held = pendingLookup<Response>();
    const row = missionRow("A", "Owned mission");
    let current = row;
    const wire: string[] = [];
    globalThis.fetch = jest.fn(async (input, init) => {
      const url = String(input); wire.push(`${init?.method ?? "GET"} ${url}`);
      if (init?.method === "POST" && url === "/api/missions") return held.promise;
      if (url === LIST) return jsonResponse({ data: { missions: [current] } });
      if (url === "/api/templates") return jsonResponse({ data: { templates: [] } });
      if (url === "/api/mission-categories") return jsonResponse({ data: { categories: [] } });
      if (url === "/api/missions?id=A") return detail(current);
      throw new Error(`Unexpected Mission HTTP ${url}`);
    });
    const Query = queryWrapper();
    const hook = renderHook(() => ({ ...useMissionsPage(), feedback: useToast() }), { wrapper: ({ children }) => <Query>{provider ? <FeedbackProvider>{children}</FeedbackProvider> : children}</Query> });
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
    expect(hook.result.current.missions).toHaveLength(1);
    if (provider) act(() => hook.result.current.feedback.showToast("Unrelated persistent error", "error"));
    let pending!: Promise<void>;
    act(() => { pending = hook.result.current.handleCancel("A"); });
    const fallbackView = provider ? null : render(<>{hook.result.current.toastElement}</>);
    expect(wire).toContain("POST /api/missions");
    expect(screen.getByText(/cancelling/i)).toBeInTheDocument();
    if (outcome === "success") current = { ...row, status: "failed", result: "Cancelled by user" };
    await act(async () => { held.complete(outcome === "success" ? jsonResponse({ data: { mission: current, cancel: { accepted: true, processKillPending: true } } }) : jsonResponse({ error: "Owned cancel refusal" }, 409)); await pending; await jest.advanceTimersByTimeAsync(400); });
    fallbackView?.rerender(<>{hook.result.current.toastElement}</>);
    if (provider) expect(screen.getByText("Unrelated persistent error")).toBeInTheDocument();
    expect(screen.queryAllByTestId("toast").length).toBeLessThanOrEqual(3);
    expect(screen.queryByText(/cancelling/i)).not.toBeInTheDocument();
    expect(document.body.textContent).toMatch(outcome === "success" ? /cancelled/i : /Owned cancel refusal/);
    expect(hook.result.current.missions[0].status).toBe(outcome === "success" ? "failed" : row.status);
  });
});

it("T0191 later Mission cancellation keeps its pending feedback when an earlier operation settles", async () => {
  jest.useFakeTimers();
  const rows = [missionRow("A", "Mission A"), missionRow("B", "Mission B")];
  const held = { A: pendingLookup<Response>(), B: pendingLookup<Response>() };
  const transport = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === LIST) return jsonResponse({ data: { missions: rows } });
    if (url === "/api/templates") return jsonResponse({ data: { templates: [] } });
    if (url === "/api/mission-categories") return jsonResponse({ data: { categories: [] } });
    if (url === "/api/missions" && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { action: string; missionId: "A" | "B" };
      expect(body.action).toBe("cancel"); return held[body.missionId].promise;
    }
    throw new Error(`Unexpected overlapping Mission HTTP: ${url}`);
  });
  globalThis.fetch = transport;
  const Query = queryWrapper();
  try {
    const hook = renderHook(() => ({ missions: useMissionsPage(), feedback: useToast() }), { wrapper: ({ children }) => <Query><FeedbackProvider>{children}</FeedbackProvider></Query> });
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });

    let first!: Promise<void>, second!: Promise<void>;
    act(() => { first = hook.result.current.missions.handleCancel("A"); });
    act(() => { second = hook.result.current.missions.handleCancel("B"); });
    expect(transport.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(2);
    rows[0] = { ...rows[0], status: "failed", result: "Cancelled by user" };
    await act(async () => { held.A.complete(jsonResponse({ data: { mission: rows[0], cancel: { accepted: true, processKillPending: true } } })); await first; await jest.advanceTimersByTimeAsync(400); });
    expect(screen.getAllByText(/cancelling mission/i)).toHaveLength(1);
    expect(screen.queryAllByTestId("toast").length).toBeLessThanOrEqual(3);
    await act(async () => { held.B.complete(jsonResponse({ error: "Second owned refusal" }, 409)); await second; await jest.advanceTimersByTimeAsync(400); });
    expect(screen.queryByText(/cancelling mission/i)).not.toBeInTheDocument();
    expect(screen.getByText("Second owned refusal")).toBeInTheDocument();
  } finally { cleanup(); globalThis.fetch = previousFetch; jest.useRealTimers(); }
});

it("T0191 settled Mission timers cannot clear a newer held cancellation or unrelated error", async () => {
  jest.useFakeTimers();
  const records = [missionRow("timer-A", "Earlier A"), missionRow("timer-B", "Earlier B"), missionRow("timer-C", "Current C")];
  const responses = records.map(() => pendingLookup<Response>());
  const posted: string[] = [];
  globalThis.fetch = jest.fn(async (input, init) => {
    const address = String(input);
    if (address === LIST) return jsonResponse({ data: { missions: records } });
    if (address === "/api/templates") return jsonResponse({ data: { templates: [] } });
    if (address === "/api/mission-categories") return jsonResponse({ data: { categories: [] } });
    if (address !== "/api/missions" || init?.method !== "POST") throw new Error(`Unexpected timer-ownership request: ${address}`);
    const { action, missionId } = JSON.parse(String(init.body)) as { action: string; missionId: string };
    expect(action).toBe("cancel");
    posted.push(missionId);
    const index = records.findIndex(record => record.id === missionId);
    expect(index).toBeGreaterThanOrEqual(0);
    return responses[index].promise;
  });
  const Query = queryWrapper();
  let newest: Promise<void> | undefined;
  try {
    const handle = renderHook(() => ({ page: useMissionsPage(), feedback: useToast() }), { wrapper: ({ children }) => <Query><FeedbackProvider>{children}</FeedbackProvider></Query> });
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
    const epoch = Date.now();
    act(() => handle.result.current.feedback.showToast("Persistent independent timer error", "error"));
    // A starts at 0, settles at 100; B starts at 500, settles at 600.
    // Their ordinary 4000ms timers and bounded exits end before 5000.
    for (const index of [0, 1]) {
      let operation!: Promise<void>;
      act(() => { operation = handle.result.current.page.handleCancel(records[index].id); });
      await act(async () => { await jest.advanceTimersByTimeAsync(100); });
      records[index] = { ...records[index], status: "failed", result: "Cancelled by user" };
      await act(async () => { responses[index].complete(jsonResponse({ data: { mission: records[index], cancel: { accepted: true, processKillPending: true } } })); await operation; await jest.advanceTimersByTimeAsync(400); });
    }
    await act(async () => { await jest.advanceTimersByTimeAsync(500); });
    expect(Date.now() - epoch).toBe(1500);
    act(() => { newest = handle.result.current.page.handleCancel("timer-C"); });
    expect(posted).toEqual(["timer-A", "timer-B", "timer-C"]);
    const pending = screen.getByText(/cancelling mission/i);
    for (const deadline of [3999, 4001, 4101, 4501, 4601, 5000]) {
      await act(async () => { await jest.advanceTimersByTimeAsync(deadline - (Date.now() - epoch)); });
      expect(pending).toBeVisible();
      expect(screen.getAllByText(/cancelling mission/i)).toEqual([pending]);
      expect(screen.getByText("Persistent independent timer error")).toBeVisible();
      expect(handle.result.current.page.cancellingMissionId).toBe("timer-C");
    }
    // C is still within its own ordinary 4000ms lifetime throughout.
    expect(Date.now() - epoch - 1500).toBe(3500);
  } finally {
    if (newest) await act(async () => { responses[2].complete(jsonResponse({ data: { mission: { ...records[2], status: "failed", result: "Cancelled by user" }, cancel: { accepted: true, processKillPending: true } } })); await newest; });
    cleanup(); globalThis.fetch = previousFetch; jest.useRealTimers();
  }
});
