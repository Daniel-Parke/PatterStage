/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import CreateStoryPage from "@/app/recroom/story-weaver/create/page";
import StoryReaderPage from "@/app/recroom/story-weaver/[id]/page";
import { renderWithQuery } from "../helpers/render-with-query";
import { halfWritten, oneFailedTwoPending, story } from "../helpers/story";
import { jsonResponse } from "../helpers/fetch-map";

const push = jest.fn();
let mockStoryId = "S-1";
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }), useParams: () => ({ id: mockStoryId }), usePathname: () => `/recroom/story-weaver/${mockStoryId}`, useSearchParams: () => new URLSearchParams() }));
// Rendering decoration is not an oracle boundary; all page and reader actions remain real.
jest.mock("lucide-react", () => jest.requireActual("../helpers/story").lucideNullMock());
const previousFetch = global.fetch;
const key = "story-weaver-draft";
let current: ReturnType<typeof story>;
let calls: { body: Record<string, unknown>; init?: RequestInit }[];
let override: (body: Record<string, unknown>, init?: RequestInit) => Promise<Response> | undefined;
let storageSpy: jest.SpyInstance | undefined;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  localStorage.clear(); push.mockClear(); mockStoryId = "S-1"; calls = []; current = halfWritten(); override = () => undefined;
  global.fetch = jest.fn(async (input, init) => {
    const url = String(input), body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url === "/api/models") return jsonResponse({ data: { models: [] } });
    if (url === "/api/models/defaults") return jsonResponse({ data: { defaults: { agent: null } } });
    if (url !== "/api/stories") throw new Error(`Unexpected Story boundary: ${url}`);
    calls.push({ body, init }); const held = override(body, init); if (held) return held;
    if (body.action === "themes") return jsonResponse({ data: { themes: [] } });
    if (body.action === "characters") return jsonResponse({ data: { characters: [] } });
    if (body.action === "load") return jsonResponse({ data: current });
    if (body.action === "spend") return jsonResponse({ data: { spend: null } });
    if (body.action === "create") return jsonResponse({ data: { id: "S-new" } }, 201);
    if (body.action === "sync-titles") return jsonResponse({ data: { story: current } });
    return jsonResponse({ error: "Owned write refusal" }, 503);
  });
});
afterEach(() => { storageSpy?.mockRestore(); storageSpy = undefined; global.fetch = previousFetch; jest.useRealTimers(); });
function deny(operation: "getItem" | "setItem" | "removeItem") {
  const original = Storage.prototype[operation];
  storageSpy = jest.spyOn(Storage.prototype, operation).mockImplementation(function (this: Storage, name: string, value?: string) {
    if (name === key) throw new DOMException(`Owned ${operation} refusal`, operation === "setItem" ? "QuotaExceededError" : "SecurityError");
    return operation === "setItem" ? (original as Storage["setItem"]).call(this, name, value ?? "") : (original as Storage["getItem"]).call(this, name);
  });
}
async function mountCreate() { const view = renderWithQuery(<CreateStoryPage />); await waitFor(() => expect(calls.some(c => c.body.action === "themes")).toBe(true)); return view; }
function fill() { fireEvent.change(screen.getByLabelText("Story title"), { target: { value: "Owned story" } }); fireEvent.change(screen.getByLabelText("Premise"), { target: { value: "An independently authored premise" } }); }
async function mountReader() { const view = renderWithQuery(<StoryReaderPage />); await screen.findByRole("heading", { level: 1, name: current.title }); return view; }

it("denied draft detection leaves Story creation usable", async () => {
  deny("getItem"); expect(() => renderWithQuery(<CreateStoryPage />)).not.toThrow(); fill(); expect(screen.getByRole("button", { name: "Begin Writing" })).toBeEnabled();
});
it("failed draft autosave preserves the current form", async () => {
  await mountCreate(); deny("setItem"); expect(() => fill()).not.toThrow();
  expect(screen.getByLabelText("Premise")).toHaveValue("An independently authored premise"); expect(screen.getByRole("button", { name: "Begin Writing" })).toBeEnabled();
});
it("denied Load Draft preserves the current form", async () => {
  localStorage.setItem(key, "{}"); await mountCreate(); fill(); deny("getItem");
  const errors: string[] = []; const capture = (event: ErrorEvent) => { if (event.error?.message === "Owned getItem refusal") { errors.push(event.error.message); event.preventDefault(); } };
  window.addEventListener("error", capture);
  try { fireEvent.click(screen.getByRole("button", { name: /load draft/i })); expect(errors).toEqual([]); expect(screen.getByLabelText("Premise")).toHaveValue("An independently authored premise"); }
  finally { window.removeEventListener("error", capture); }
});
it("failed draft cleanup does not turn successful creation into failure", async () => {
  await mountCreate(); fill(); deny("removeItem"); jest.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "Begin Writing" }));
  await act(async () => { await jest.advanceTimersByTimeAsync(0); });
  await act(async () => { await jest.advanceTimersByTimeAsync(2500); });
  expect(push).toHaveBeenCalledTimes(1); expect(push).toHaveBeenCalledWith("/recroom/story-weaver/S-new");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument(); expect(calls.filter(c => c.body.action === "create")).toHaveLength(1);
});
it("available draft storage preserves the existing key and round trip", async () => {
  localStorage.setItem(key, "{}"); await mountCreate(); fill();
  const saved = localStorage.getItem(key)!; expect(JSON.parse(saved)).toMatchObject({ title: "Owned story", premise: "An independently authored premise" });
  fireEvent.change(screen.getByLabelText("Premise"), { target: { value: "New unsaved text" } });
  localStorage.setItem(key, saved); fireEvent.click(screen.getByRole("button", { name: /load draft/i }));
  expect(screen.getByLabelText("Premise")).toHaveValue("An independently authored premise");
});
it("malformed stored draft does not replace current input", async () => {
  localStorage.setItem(key, "{}"); await mountCreate(); fill(); localStorage.setItem(key, "{invalid");
  fireEvent.click(screen.getByRole("button", { name: /load draft/i })); expect(screen.getByLabelText("Premise")).toHaveValue("An independently authored premise");
});

it.each(["load", "spend"])("Story reads preserve request identity and truthful failures [%s]", async operation => {
  override = body => body.action === operation ? Promise.resolve(jsonResponse({ error: `Owned ${operation} failure` }, 503)) : undefined;
  renderWithQuery(<StoryReaderPage />); await waitFor(() => expect(calls.some(c => c.body.action === operation)).toBe(true));
  expect(calls.find(c => c.body.action === operation)?.body).toEqual({ action: operation, storyId: "S-1" });
  if (operation === "load") expect(await screen.findByRole("alert")).toHaveTextContent(/Owned load failure|failed|unable/i);
  else { await screen.findByRole("heading", { level: 1, name: current.title }); expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument(); }
  expect(calls.filter(c => !["load", "spend"].includes(String(c.body.action)))).toEqual([]);
});

it("Story load and spend distinguish two story IDs under the same query client", async () => {
  const stories = { "S-1": { ...halfWritten(), title: "First owned story" }, "S-2": { ...halfWritten(), id: "S-2", title: "Second owned story" } };
  override = body => {
    const id = body.storyId as keyof typeof stories;
    if (body.action === "load") return Promise.resolve(jsonResponse({ data: stories[id] }));
    if (body.action === "spend") return Promise.resolve(jsonResponse({ data: { spend: { source: "story", label: "Story Weaver", runs: id === "S-1" ? 1 : 2, inputTokens: 0, outputTokens: 0, costUsd: id === "S-1" ? 0.8 : 1.75, recorded: true } } }));
  };
  const view = renderWithQuery(<StoryReaderPage />);
  await screen.findByRole("heading", { level: 1, name: "First owned story" });
  await waitFor(() => expect(screen.getByTestId("story-spend-note")).toHaveTextContent("$0.80"));
  // renderWithQuery's returned rerender retains the same provider/client.
  mockStoryId = "S-2"; view.rerender(<StoryReaderPage />);
  await screen.findByRole("heading", { level: 1, name: "Second owned story" });
  await waitFor(() => expect(screen.getByTestId("story-spend-note")).toHaveTextContent("$1.75"));
  expect(screen.getByTestId("story-spend-note")).toHaveTextContent("2 model calls");
  expect(screen.queryByRole("heading", { level: 1, name: "First owned story" })).not.toBeInTheDocument();
  for (const storyId of ["S-1", "S-2"]) for (const action of ["load", "spend"]) expect(calls.some(c => c.body.action === action && c.body.storyId === storyId)).toBe(true);
  expect(calls.filter(c => !["load", "spend"].includes(String(c.body.action)))).toEqual([]);
});

it.each(["sync-titles", "generate-chapter", "retry-chapter", "edit-chapter", "continue", "update", "create"])("Story writes preserve explicit intent and failure semantics [%s]", async operation => {
  if (operation === "create") {
    override = body => body.action === "create" ? Promise.resolve(jsonResponse({ error: "Owned write refusal" }, 503)) : undefined;
    await mountCreate(); fill(); expect(calls.filter(c => c.body.action === "create")).toEqual([]); fireEvent.click(screen.getByRole("button", { name: "Begin Writing" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Owned write refusal")); expect(push).not.toHaveBeenCalled();
  } else {
    if (operation === "sync-titles") { current.chapters[0].title = "Chapter 1"; override = body => body.action === operation ? Promise.reject(new Error("Nonfatal title sync")) : undefined; }
    if (operation === "retry-chapter") current = oneFailedTwoPending();
    if (operation === "continue") current = story([{ number: 1, title: "Finished", status: "complete", wordCount: 100 }], { status: "complete" });
    await mountReader();
    if (operation !== "sync-titles") expect(calls.filter(c => c.body.action === operation)).toEqual([]);
    if (operation === "generate-chapter") fireEvent.click(screen.getByRole("button", { name: "Write chapter 3" }));
    if (operation === "retry-chapter") fireEvent.click(screen.getByTitle("Retry failed chapters"));
    if (operation === "edit-chapter") { fireEvent.click(screen.getByTitle("Edit this chapter")); fireEvent.change(screen.getByPlaceholderText(/Make the dialogue/i), { target: { value: "Make the ending clearer" } }); fireEvent.click(screen.getByRole("button", { name: /^Edit chapter$/i })); }
    if (operation === "continue") { fireEvent.click(screen.getByTitle("Continue this story")); fireEvent.change(screen.getByPlaceholderText(/A new threat/i), { target: { value: "Explore the island" } }); fireEvent.click(screen.getByRole("button", { name: /^Continue story$/i })); }
    if (operation === "update") fireEvent.click(screen.getAllByRole("button", { name: /Chapter 2: The Signal/ })[0]);
    await waitFor(() => expect(calls.filter(c => c.body.action === operation)).toHaveLength(1));
    if (operation === "sync-titles") expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    else await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Owned write refusal"));
    const call = calls.find(c => c.body.action === operation)!; expect(call.body.storyId).toBe("S-1");
    if (operation === "edit-chapter") expect(call.body).toEqual({ action: "edit-chapter", storyId: "S-1", chapterNumber: 1, editPrompt: "Make the ending clearer", wordCountRange: "standard", count: 3 });
    if (operation === "continue") expect(call.body).toEqual({ action: "continue", storyId: "S-1", direction: "Explore the island", count: 3, wordCountRange: "standard" });
    if (operation === "update") expect(call.body).toEqual({ action: "update", storyId: "S-1", chapters: [{ number: 2, readStatus: "read" }] });
    if (operation === "generate-chapter" || operation === "retry-chapter") expect(call.init?.signal).toBeInstanceOf(AbortSignal);
  }
  await act(async () => { await Promise.resolve(); }); expect(calls.filter(c => c.body.action === operation)).toHaveLength(1);
});

it("successful Story creation requires an id and navigates exactly once", async () => {
  await mountCreate(); fill(); jest.useFakeTimers(); fireEvent.click(screen.getByRole("button", { name: "Begin Writing" }));
  await act(async () => { await jest.advanceTimersByTimeAsync(0); });
  await act(async () => { await jest.advanceTimersByTimeAsync(2500); }); expect(push.mock.calls).toEqual([["/recroom/story-weaver/S-new"]]);
});
it.each([{}, { data: {} }, { error: "Application refusal" }])("malformed Story creation success stays visible without navigation [%j]", async response => {
  override = body => body.action === "create" ? Promise.resolve(jsonResponse(response)) : undefined;
  await mountCreate(); fill(); fireEvent.click(screen.getByRole("button", { name: "Begin Writing" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/id|refusal/i)); expect(push).not.toHaveBeenCalled();
});

it("a pending Story write keeps Stop connected to its own abort signal", async () => {
  const held = deferred<Response>(); override = body => body.action === "generate-chapter" ? held.promise : undefined;
  await mountReader(); fireEvent.click(screen.getByRole("button", { name: "Write chapter 3" }));
  const stop = await screen.findByRole("button", { name: "Stop" }); const signal = calls.find(c => c.body.action === "generate-chapter")!.init!.signal!;
  expect(signal.aborted).toBe(false); fireEvent.click(stop); expect(signal.aborted).toBe(true);
  await act(async () => held.resolve(jsonResponse({ data: { story: current } })));
  expect(calls.filter(c => c.body.action === "generate-chapter")).toHaveLength(1);
});
