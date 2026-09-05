/** @jest-environment jsdom */
/**
 * B1 (T-0095), D11: `useModelActions.syncModel` toasted "Model pushed to
 * Hermes" on any 2xx. The push route now answers 500 when the push did not
 * happen, which the existing catch turns into an error toast; this pins the
 * other half, so a 200 whose body says `success: false` (the pull route's
 * shape, and any future partial outcome) is read rather than assumed.
 */
import { act, renderHook } from "@testing-library/react";

const mockApiFetch = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  API_FETCH_BULK_TIMEOUT_MS: 300_000,
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
  messageFromError: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback),
  safeApiCallData: jest.fn(),
  toastError: (show: (m: string, t?: string) => void, e: unknown, fallback: string) =>
    show(e instanceof Error ? e.message : fallback, "error"),
}));

import { useModelActions } from "@/hooks/useModelActions";

function mount() {
  const showToast = jest.fn();
  const loadAll = jest.fn(async () => undefined);
  const hook = renderHook(() => useModelActions({ loadAll, setDefaults: jest.fn(), showToast }));
  return { showToast, loadAll, hook };
}

beforeEach(() => mockApiFetch.mockReset());

describe("a sync answer is read, not assumed", () => {
  it("a 200 carrying success:false is an error toast naming the detail, not a success", async () => {
    mockApiFetch.mockResolvedValue({
      data: {
        success: false,
        details: [{ action: "error", detail: "config.yaml did not parse, refusing to write over it" }],
      },
    });
    const { showToast, hook } = mount();

    let out: { success: boolean } | undefined;
    await act(async () => {
      out = await hook.result.current.handlePush("m-1");
    });

    expect(out?.success).toBe(false);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("config.yaml did not parse"), "error");
    expect(showToast).not.toHaveBeenCalledWith(expect.stringMatching(/pushed to hermes/i), "success");
  });

  it("the same for a pull", async () => {
    mockApiFetch.mockResolvedValue({ data: { success: false, details: [{ action: "error", detail: "no section" }] } });
    const { showToast, hook } = mount();
    await act(async () => {
      await hook.result.current.handlePull("m-1");
    });
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("no section"), "error");
  });

  it("GREEN CONTROL: a real success still toasts success and reloads", async () => {
    mockApiFetch.mockResolvedValue({ data: { success: true, details: [] } });
    const { showToast, loadAll, hook } = mount();
    await act(async () => {
      await hook.result.current.handlePush("m-1");
    });
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/pushed to hermes/i), "success");
    expect(loadAll).toHaveBeenCalled();
  });
});
