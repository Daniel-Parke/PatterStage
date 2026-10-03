import { act, renderHook } from "@testing-library/react";
import { useModelActions } from "@/hooks/useModelActions";
import type { TaskType } from "@/lib/models/task-types";
import { jsonResponse } from "../helpers/fetch-map";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
const slots: TaskType[] = ["compression", "vision", "web_extract"];
type Outcome = "saved" | "yaml-refused" | "transport-refused";

async function bulk(outcomes: Outcome[]) {
  const writes: unknown[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(String(input)).toBe("/api/models/defaults");
    expect(init?.method).toBe("PUT");
    const body = JSON.parse(String(init?.body)) as { taskType: TaskType; modelId: string };
    writes.push(body);
    const outcome = outcomes[slots.indexOf(body.taskType)];
    if (outcome === "transport-refused") throw new Error("Owned transport refused");
    // T0095 D19: the SQLite default IS saved; only the YAML push failed.
    return jsonResponse({ data: outcome === "yaml-refused" ? { error: "SQLite saved; YAML sync refused" } : { success: true } });
  });
  const loadAll = jest.fn(async () => undefined);
  const showToast = jest.fn();
  const hook = renderHook(() => useModelActions({ loadAll, showToast, setDefaults: jest.fn() }));
  await act(async () => { await hook.result.current.handleBulkAuxiliaryChange(slots, "owned-model"); });
  expect(writes).toEqual(slots.map((taskType) => ({ taskType, modelId: "owned-model" })));
  expect(loadAll).toHaveBeenCalledTimes(1);
  expect(hook.result.current.busyTaskType).toBeNull();
  expect(showToast).toHaveBeenCalledTimes(1);
  return showToast.mock.calls[0] as [string, string];
}

describe("T-0192 bulk default feedback", () => {
  it("announces all-success and refreshes the saved defaults", async () => {
    expect(await bulk(["saved", "saved", "saved"])).toEqual(["Set 3 auxiliary defaults", "success"]);
  });
  it("distinguishes SQLite success from YAML refusal for HTTP200 semantic errors", async () => {
    const [message, type] = await bulk(["yaml-refused", "yaml-refused", "yaml-refused"]);
    expect(type).toBe("error");
    expect(message).toMatch(/yaml|sync|push/i);
    expect(message).toMatch(/saved|database|sqlite|partial/i);
  });
  it("reports transport failures and still refreshes the defaults", async () => {
    const [message, type] = await bulk(["transport-refused", "transport-refused", "transport-refused"]);
    expect(type).toBe("error");
    for (const slot of slots) expect(message).toContain(slot);
  });
  it("distinguishes mixed success, saved-but-unsynchronised and transport refusal", async () => {
    const [message, type] = await bulk(["saved", "yaml-refused", "transport-refused"]);
    expect(type).toBe("error");
    expect(message).toContain("vision");
    expect(message).toContain("web_extract");
    expect(message).toMatch(/yaml|sync|push/i);
    expect(message).toMatch(/saved|database|sqlite|partial/i);
  });
});
