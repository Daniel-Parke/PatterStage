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

  it("shows the error toast and skips onSuccess when the response says success:false (checkSuccess=true)", async () => {
    apiFetch.mockResolvedValue({ data: { success: false, error: "disk full" } });
    const showToast = jest.fn();
    const onSuccess = jest.fn();

    await runSyncAction(
      baseOptions({ showToast, onSuccess, errorMessage: "fallback" }),
    );

    expect(showToast).toHaveBeenCalledWith("disk full", "error");
    expect(onSuccess).not.toHaveBeenCalled();
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
});
