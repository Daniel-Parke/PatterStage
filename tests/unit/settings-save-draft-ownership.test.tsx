/** @jest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSettingsEditor } from "@/hooks/useSettingsEditor";
import { queryWrapper } from "../helpers/render-with-query";
import { pendingLookup } from "../helpers/mission-async-deferred";
import { jsonResponse } from "../helpers/fetch-map";

jest.mock("@/components/ui/Toast", () => ({ useToast: () => ({ showToast: jest.fn() }) }));

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

async function mount() {
  const put = pendingLookup<Response>();
  const reread = pendingLookup<Response>();
  let hermesReads = 0;
  const writes: { url: string; body: unknown }[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "PUT") {
      writes.push({ url, body: JSON.parse(String(init.body)) });
      return writes.length === 1 ? put.promise : jsonResponse({ data: { saved: true } });
    }
    if (url === "/api/config") return jsonResponse({ data: { agent: { max_turns: 40 } } });
    if (url === "/api/agent/files/hermes") {
      hermesReads += 1;
      return hermesReads === 1 ? jsonResponse({ data: { content: "original bytes" } }) : reread.promise;
    }
    if (url === "/api/agent/files/env") return jsonResponse({ data: { content: "" } });
    if (url === "/api/agent/profiles/default/toolsets") return jsonResponse({ data: { platformToolsets: {} } });
    throw new Error(`Unmatched fixture request: ${url}`);
  });
  const hook = renderHook(() => useSettingsEditor(), { wrapper: queryWrapper() });
  await waitFor(() => expect(hook.result.current.editorFor("agent")?.values.max_turns).toBe(40));
  await waitFor(() => expect(hook.result.current.editorFor("hermes_md")?.file?.content).toBe("original bytes"));
  return { ...hook, put, reread, writes, editor: (id = "agent") => hook.result.current.editorFor(id)! };
}

describe("T-0192 Settings save owns only the submitted draft", () => {
  it("keeps 42 unsaved after a held save of 41 from baseline 40 succeeds", async () => {
    const h = await mount();
    act(() => h.editor().update("max_turns", 41));
    let saving!: Promise<void>;
    act(() => { saving = h.editor().save(); });
    expect(h.writes).toEqual([{ url: "/api/config", body: { section: "agent", values: { max_turns: 41 } } }]);
    act(() => h.editor().update("max_turns", 42));
    await act(async () => { h.put.complete(jsonResponse({ data: { saved: true } })); await saving; });
    expect(h.editor().values.max_turns).toBe(42);
    expect(h.editor().changed).toEqual({ max_turns: 42 });
    expect(h.editor().hasChanges).toBe(true);
    act(() => h.editor().reset());
    expect(h.editor().values.max_turns).toBe(41);
  });

  it("advances the saved numeric baseline to 41 independently of the later draft", async () => {
    const h = await mount();
    act(() => h.editor().update("max_turns", 41));
    let saving!: Promise<void>;
    act(() => { saving = h.editor().save(); });
    act(() => h.editor().update("max_turns", 42));
    await act(async () => { h.put.complete(jsonResponse({ data: { saved: true } })); await saving; });
    act(() => h.editor().reset());
    expect(h.editor().values.max_turns).toBe(41);
    expect(h.editor().hasChanges).toBe(false);
  });

  it("settles an unchanged successful submission and permits a later save of 42", async () => {
    const h = await mount();
    act(() => h.editor().update("max_turns", 41));
    let saving!: Promise<void>;
    act(() => { saving = h.editor().save(); });
    await act(async () => { h.put.complete(jsonResponse({ data: { saved: true } })); await saving; });
    expect(h.editor().values.max_turns).toBe(41);
    expect(h.editor().hasChanges).toBe(false);
    act(() => h.editor().update("max_turns", 42));
    await act(async () => { await h.editor().save(); });
    expect(h.writes[1].body).toEqual({ section: "agent", values: { max_turns: 42 } });
    expect(h.editor().values.max_turns).toBe(42);
    expect(h.editor().hasChanges).toBe(false);
  });

  it("keeps the later numeric draft and baseline 40 when saving 41 is refused", async () => {
    const h = await mount();
    act(() => h.editor().update("max_turns", 41));
    let saving!: Promise<void>;
    act(() => { saving = h.editor().save(); });
    act(() => h.editor().update("max_turns", 42));
    await act(async () => { h.put.complete(jsonResponse({ error: "Owned config refused" }, 500)); await saving; });
    expect(h.editor().values.max_turns).toBe(42);
    expect(h.editor().hasChanges).toBe(true);
    expect(h.editor().status).toBe("error");
    expect(h.editor().error).toBe("Owned config refused");
    act(() => h.editor().reset());
    expect(h.editor().values.max_turns).toBe(40);
  });

  it.each(["submitted bytes", "refused read"])("keeps a newer HERMES.md draft through a held save and %s", async (readOutcome) => {
    const h = await mount();
    const file = () => h.editor("hermes_md");
    act(() => file().file!.update("submitted bytes"));
    let saving!: Promise<void>;
    act(() => { saving = file().save(); });
    act(() => file().file!.update("newer draft"));
    await act(async () => { h.put.complete(jsonResponse({ data: { saved: true } })); await saving; });
    expect(h.writes[0]).toEqual({ url: "/api/agent/files/hermes", body: { content: "submitted bytes", backup: true } });
    expect(file().file).toMatchObject({ original: "submitted bytes", content: "newer draft" });
    await act(async () => {
      h.reread.complete(readOutcome === "refused read"
        ? jsonResponse({ error: "Owned read refused" }, 500)
        : jsonResponse({ data: { content: "submitted bytes" } }));
    });
    if (readOutcome === "refused read") await waitFor(() => expect(file().file?.error).toBe("Owned read refused"));
    else await waitFor(() => expect(h.result.current.fileLayoutReady).toBe(true));
    expect(file().file).toMatchObject({ original: "submitted bytes", content: "newer draft" });
    expect(file().hasChanges).toBe(true);
  });

  it("keeps the newer HERMES.md draft and old baseline when the held save is refused", async () => {
    const h = await mount();
    const file = () => h.editor("hermes_md");
    act(() => file().file!.update("submitted bytes"));
    let saving!: Promise<void>;
    act(() => { saving = file().save(); });
    act(() => file().file!.update("newer draft"));
    await act(async () => { h.put.complete(jsonResponse({ error: "Owned write refused" }, 500)); await saving; });
    expect(file().file).toMatchObject({ original: "original bytes", content: "newer draft" });
    expect(file().hasChanges).toBe(true);
    expect(file().error).toBe("Owned write refused");
    expect(file().status).toBe("error");
  });
});
