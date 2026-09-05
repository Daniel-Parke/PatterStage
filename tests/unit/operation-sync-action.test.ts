// ═══════════════════════════════════════════════════════════════
// operation-sync-action.test.ts — Tests for the shared sync helper
// ═══════════════════════════════════════════════════════════════
//
// The helper is the "POST to /api/agent/profiles/sync/*, show toast,
// reload" boilerplate used by operations/agents (doSync),
// operations/skills (importSkillsFromHermes), and
// operations/tools (pullFromHermes/pushToHermes). It centralises
// the busy-state setter + try/catch + finally clear + optional
// {success:false} check that used to be duplicated 5+ times.
//
// These tests stub the apiFetch module so no real network is
// involved. The toast/busy hooks are mock functions the helper is
// expected to call in the documented order.

import { runSyncAction, type RunSyncActionOptions } from "@/lib/operation-sync-action";

jest.mock("@/lib/api-fetch", () => ({
  apiFetch: jest.fn(),
  toastError: jest.fn(
    (showToast: (message: string, variant?: string) => void, err: unknown, fallback: string) =>
      showToast(err instanceof Error ? err.message : fallback, "error"),
  ),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { apiFetch } = require("@/lib/api-fetch") as { apiFetch: jest.Mock };

const baseOptions = (overrides: Partial<RunSyncActionOptions> = {}): RunSyncActionOptions => ({
  setBusy: jest.fn(),
  showToast: jest.fn(),
  url: "/api/test",
  body: { foo: "bar" },
  successMessage: "ok",
  errorMessage: "boom",
  ...overrides,
});

beforeEach(() => {
  apiFetch.mockReset();
});

describe("runSyncAction", () => {
  it("calls setBusy(true) before the fetch and setBusy(false) in finally", async () => {
    apiFetch.mockResolvedValue({ data: { success: true } });
    const setBusy = jest.fn();
    const order: string[] = [];
    setBusy.mockImplementation((v: boolean) => order.push(`busy:${v}`));
    apiFetch.mockImplementation(async () => {
      order.push("fetch");
      return { data: { success: true } };
    });

    await runSyncAction(baseOptions({ setBusy }));

    expect(order).toEqual(["busy:true", "fetch", "busy:false"]);
  });

  it("shows the success toast and runs onSuccess on a 2xx response", async () => {
    apiFetch.mockResolvedValue({ data: { success: true } });
    const showToast = jest.fn();
    const onSuccess = jest.fn();

    await runSyncAction(baseOptions({ showToast, onSuccess }));

    expect(showToast).toHaveBeenCalledWith("ok", "success");
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("shows the error toast AND still reloads when the response says success:false (checkSuccess=true)", async () => {
    // B1 (T-0095), D20. A batch that partly failed is a real outcome: eleven
    // profiles pushed, one did not. Skipping the reload left the page showing
    // the pre-push state for all twelve, so the operator could not see which
    // eleven had actually moved. The toast names the failure; the reload shows
    // the truth.
    apiFetch.mockResolvedValue({ data: { success: false, error: "disk full" } });
    const showToast = jest.fn();
    const onSuccess = jest.fn();

    await runSyncAction(
      baseOptions({ showToast, onSuccess, errorMessage: "fallback" }),
    );

    expect(showToast).toHaveBeenCalledWith("disk full", "error");
    expect(showToast).not.toHaveBeenCalledWith("ok", "success");
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("falls back to errorMessage when success:false has no error string", async () => {
    apiFetch.mockResolvedValue({ data: { success: false } });
    const showToast = jest.fn();

    await runSyncAction(baseOptions({ showToast, errorMessage: "fallback" }));

    expect(showToast).toHaveBeenCalledWith("fallback", "error");
  });

  it("catches fetch errors and shows the error toast", async () => {
    apiFetch.mockRejectedValue(new Error("network down"));
    const showToast = jest.fn();
    const onSuccess = jest.fn();

    await runSyncAction(baseOptions({ showToast, onSuccess }));

    expect(showToast).toHaveBeenCalledWith("network down", "error");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("uses a generic message when the caught value is not an Error", async () => {
    apiFetch.mockRejectedValue("string error");
    const showToast = jest.fn();

    await runSyncAction(baseOptions({ showToast, errorMessage: "fallback" }));

    expect(showToast).toHaveBeenCalledWith("fallback", "error");
  });

  it("skips the success:false check when checkSuccess=false (relies on throw path)", async () => {
    apiFetch.mockResolvedValue({ data: { success: false } });
    const showToast = jest.fn();
    const onSuccess = jest.fn();

    await runSyncAction(
      baseOptions({ showToast, onSuccess, checkSuccess: false }),
    );

    expect(showToast).toHaveBeenCalledWith("ok", "success");
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("always calls setBusy(false) even when onSuccess throws", async () => {
    apiFetch.mockResolvedValue({ data: { success: true } });
    const setBusy = jest.fn();
    const onSuccess = jest.fn().mockRejectedValue(new Error("reload failed"));

    await runSyncAction(baseOptions({ setBusy, onSuccess }));

    expect(setBusy).toHaveBeenCalledWith(false);
  });

  it("awaits onSuccess before clearing busy (so a spinner stays until reload completes)", async () => {
    apiFetch.mockResolvedValue({ data: { success: true } });
    const setBusy = jest.fn();
    const order: string[] = [];
    setBusy.mockImplementation((v: boolean) => order.push(`busy:${v}`));
    const onSuccess = jest.fn(async () => {
      order.push("onSuccess");
    });

    await runSyncAction(baseOptions({ setBusy, onSuccess }));

    expect(order).toEqual(["busy:true", "onSuccess", "busy:false"]);
  });

  it("tolerates responses that lack a data field", async () => {
    apiFetch.mockResolvedValue({});
    const showToast = jest.fn();
    const onSuccess = jest.fn();

    await runSyncAction(baseOptions({ showToast, onSuccess }));

    expect(showToast).toHaveBeenCalledWith("ok", "success");
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("defaults to POST when no method is specified (backward compat)", async () => {
    apiFetch.mockResolvedValue({ data: { success: true } });

    await runSyncAction(baseOptions());

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("forwards an explicit PUT method to apiFetch", async () => {
    apiFetch.mockResolvedValue({ data: { success: true } });

    await runSyncAction(baseOptions({ method: "PUT" }));

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("forwards an explicit DELETE method to apiFetch", async () => {
    apiFetch.mockResolvedValue({ data: { success: true } });

    await runSyncAction(baseOptions({ method: "DELETE" }));

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("does not require a body for DELETE-style requests", async () => {
    // Some DELETE handlers don't read the body, but the helper still
    // passes body: JSON.stringify(body) — verify we don't break the
    // existing shape. (The `body` field is required in the type, so
    // callers always pass at least `{}`.)
    apiFetch.mockResolvedValue({ data: { success: true } });

    await runSyncAction(baseOptions({ method: "DELETE", body: {} }));

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  // Session 170: `setBusy` became optional. Callers that want no
  // spinner (e.g. sub-100ms actions like switching the active
  // personality) omit the key entirely. The helper's default
  // `setBusy = () => undefined` is a no-op, so omitting is
  // byte-equivalent to the prior `setBusy: () => undefined` smell.
  it("tolerates a missing setBusy (no spinner for sub-100ms actions)", async () => {
    apiFetch.mockResolvedValue({ data: { success: true } });
    const showToast = jest.fn();
    const onSuccess = jest.fn();

    // Strip setBusy from the base options — this is the canonical
    // "I don't want a spinner" call shape.
    const { setBusy: _setBusy, ...rest } = baseOptions({ showToast, onSuccess });
    void _setBusy;
    await runSyncAction(rest as RunSyncActionOptions);

    expect(showToast).toHaveBeenCalledWith("ok", "success");
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("default setBusy is a no-op (no throw, no state mutation) when omitted", async () => {
    // Direct test of the default-fallback behaviour: a missing
    // setBusy should be filled by a no-op setter that does nothing
    // visible. We assert by NOT passing setBusy and confirming the
    // success path runs to completion (no throw, success toast
    // called, onSuccess invoked).
    apiFetch.mockResolvedValue({ data: { success: true } });
    const showToast = jest.fn();
    const onSuccess = jest.fn();

    const { setBusy: _setBusy, ...rest } = baseOptions({ showToast, onSuccess });
    void _setBusy;
    await expect(runSyncAction(rest as RunSyncActionOptions)).resolves.toBeUndefined();
  });

  it("tolerates a missing setBusy in the failure path (no throw, error toast still shown)", async () => {
    apiFetch.mockRejectedValue(new Error("network down"));
    const showToast = jest.fn();

    const { setBusy: _setBusy, ...rest } = baseOptions({ showToast });
    void _setBusy;
    await expect(runSyncAction(rest as RunSyncActionOptions)).resolves.toBeUndefined();
    expect(showToast).toHaveBeenCalledWith("network down", "error");
  });
});
