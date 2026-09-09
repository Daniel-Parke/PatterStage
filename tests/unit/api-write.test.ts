/**
 * `runWrite`: the one way a screen writes to the API (T-0138).
 *
 * The six things around a write, said once: mark busy, call, say what
 * happened, reload, say why on a throw, clear busy. This suite carries the
 * contract that four helpers used to carry between them (runSyncAction,
 * runMutation, hindsightMutate, runFallbackMutation), so the assertions from
 * their suites are here, with the reasons that were on them.
 */

import { isApiSuccessFalse, runWrite, type RunWriteOptions } from "@/lib/api-write";

jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  apiFetch: jest.fn(),
}));
const { apiFetch } = require("@/lib/api-fetch") as { apiFetch: jest.Mock };

const base = (overrides: Partial<RunWriteOptions> = {}): RunWriteOptions => ({
  setBusy: jest.fn(),
  showToast: jest.fn(),
  url: "/api/test",
  body: { foo: "bar" },
  successMessage: "ok",
  errorMessage: "boom",
  ...overrides,
});

beforeEach(() => apiFetch.mockReset());

describe("runWrite · the six things", () => {
  it("marks busy before the call and clears it after, and the call is the method and the body as JSON", async () => {
    const order: string[] = [];
    apiFetch.mockImplementation(async () => {
      order.push("fetch");
      return { data: {} };
    });
    const opts = base({ setBusy: (b) => order.push(`busy:${b}`), method: "PUT" });
    await runWrite(opts);
    expect(order).toEqual(["busy:true", "fetch", "busy:false"]);
    expect(apiFetch).toHaveBeenCalledWith("/api/test", { method: "PUT", body: JSON.stringify({ foo: "bar" }), timeoutMs: undefined });
  });

  it("defaults to POST, and a DELETE with no body sends none", async () => {
    apiFetch.mockResolvedValue({ data: {} });
    await runWrite(base());
    expect(apiFetch.mock.calls[0][1]).toMatchObject({ method: "POST" });
    await runWrite(base({ method: "DELETE", body: undefined }));
    expect(apiFetch.mock.calls[1][1]).toEqual({ method: "DELETE", body: undefined, timeoutMs: undefined });
  });

  it("says the success, awaits the reload before clearing busy, and resolves to the response", async () => {
    apiFetch.mockResolvedValue({ data: { id: "m1" } });
    const order: string[] = [];
    const opts = base({
      setBusy: (b) => order.push(`busy:${b}`),
      onSuccess: async (data) => {
        order.push(`reload:${(data as { data: { id: string } }).data.id}`);
      },
    });
    const res = await runWrite(opts);
    expect(res).toEqual({ data: { id: "m1" } });
    expect(opts.showToast).toHaveBeenCalledWith("ok", "success");
    expect(order).toEqual(["busy:true", "reload:m1", "busy:false"]);
  });

  it("a success message may read the response, and may name its own tone", async () => {
    apiFetch.mockResolvedValue({ data: { credential: { label: "OpenAI", keyHint: "sk-…42" }, orphanedModels: ["gpt"] } });
    const showToast = jest.fn();
    await runWrite(
      base({
        showToast,
        successMessage: (data) => `Added ${(data as { data: { credential: { label: string; keyHint: string } } }).data.credential.label}`,
      }),
    );
    await runWrite(
      base({
        showToast,
        successMessage: (data) => ({ message: `${(data as { data: { orphanedModels: string[] } }).data.orphanedModels.join(", ")} now has no key`, type: "info" }),
      }),
    );
    await runWrite(base({ showToast, successMessage: { message: "Set, but not synced", type: "error" } }));
    expect(showToast.mock.calls).toEqual([
      ["Added OpenAI", "success"],
      ["gpt now has no key", "info"],
      ["Set, but not synced", "error"],
    ]);
  });

  it("a throw is said with the server's words, or the fallback; the reload does not run; busy still clears; it resolves to nothing", async () => {
    apiFetch.mockRejectedValueOnce(new Error("the database is locked"));
    const opts = base({ onSuccess: jest.fn() });
    expect(await runWrite(opts)).toBeUndefined();
    expect(opts.showToast).toHaveBeenCalledWith("the database is locked", "error");
    expect(opts.onSuccess).not.toHaveBeenCalled();
    expect(opts.setBusy).toHaveBeenLastCalledWith(false);

    apiFetch.mockRejectedValueOnce("not an Error");
    const plain = base();
    await runWrite(plain);
    expect(plain.showToast).toHaveBeenCalledWith("boom", "error");
  });

  it("onError sees the thrown value, so a caller can put back what it changed ahead of the answer", async () => {
    const err = new Error("refused");
    apiFetch.mockRejectedValue(err);
    const onError = jest.fn();
    await runWrite(base({ onError }));
    expect(onError).toHaveBeenCalledWith(err);
  });

  it("busy clears even when the reload throws", async () => {
    apiFetch.mockResolvedValue({ data: {} });
    const opts = base({ onSuccess: async () => { throw new Error("reload broke"); } });
    await expect(runWrite(opts)).rejects.toThrow("reload broke");
    expect(opts.setBusy).toHaveBeenLastCalledWith(false);
  });

  it("tolerates a missing setBusy on both paths", async () => {
    apiFetch.mockResolvedValueOnce({ data: {} });
    await expect(runWrite(base({ setBusy: undefined }))).resolves.toEqual({ data: {} });
    apiFetch.mockRejectedValueOnce(new Error("no"));
    const opts = base({ setBusy: undefined });
    await expect(runWrite(opts)).resolves.toBeUndefined();
    expect(opts.showToast).toHaveBeenCalledWith("no", "error");
  });

  it("forwards the deadline, so a bulk action gets the bulk ceiling (T-0047)", async () => {
    apiFetch.mockResolvedValue({ data: {} });
    await runWrite(base({ timeoutMs: 300_000 }));
    expect(apiFetch.mock.calls[0][1]).toMatchObject({ timeoutMs: 300_000 });
  });
});

describe("runWrite · a 2xx that says no", () => {
  it("shows the envelope's error with the error tone AND still reloads (T-0095, D20), and resolves to nothing", async () => {
    apiFetch.mockResolvedValue({ data: { success: false, error: "eleven pushed, one did not" } });
    const opts = base({ onSuccess: jest.fn() });
    expect(await runWrite(opts)).toBeUndefined();
    expect(opts.showToast).toHaveBeenCalledWith("eleven pushed, one did not", "error");
    expect(opts.showToast).not.toHaveBeenCalledWith("ok", "success");
    expect(opts.onSuccess).toHaveBeenCalledTimes(1);
  });

  it("reads a details[0].detail when there is no error string, the way the model sync routes answer", async () => {
    apiFetch.mockResolvedValue({ data: { success: false, details: [{ action: "push", detail: "config.yaml did not parse" }] } });
    const opts = base();
    await runWrite(opts);
    expect(opts.showToast).toHaveBeenCalledWith("config.yaml did not parse", "error");
  });

  it("falls back to errorMessage when the envelope says no and nothing else", async () => {
    apiFetch.mockResolvedValue({ data: { success: false } });
    const opts = base();
    await runWrite(opts);
    expect(opts.showToast).toHaveBeenCalledWith("boom", "error");
  });

  it("skips the check when checkSuccess is false, so a caller reads the outcome itself", async () => {
    apiFetch.mockResolvedValue({ data: { success: false } });
    const opts = base({ checkSuccess: false, successMessage: (d) => ((d as { data: { success: boolean } }).data.success ? "yes" : { message: "no", type: "error" }) });
    expect(await runWrite(opts)).toEqual({ data: { success: false } });
    expect(opts.showToast).toHaveBeenCalledWith("no", "error");
  });

  it("tolerates a response with no data field", async () => {
    apiFetch.mockResolvedValue({});
    const opts = base();
    await expect(runWrite(opts)).resolves.toEqual({});
    expect(opts.showToast).toHaveBeenCalledWith("ok", "success");
  });
});

describe("runWrite · a request that is not one call", () => {
  it("runs the given request in place of the fetch and hands its answer to the message and the reload", async () => {
    const request = jest.fn(async () => [{ ok: true }, { ok: false }]);
    const opts = base({
      url: undefined,
      request,
      successMessage: (results) => {
        const failed = (results as { ok: boolean }[]).filter((r) => !r.ok).length;
        return failed ? { message: `${failed} failed`, type: "error" } : "all set";
      },
      onSuccess: jest.fn(),
    });
    expect(await runWrite(opts)).toEqual([{ ok: true }, { ok: false }]);
    expect(apiFetch).not.toHaveBeenCalled();
    expect(opts.showToast).toHaveBeenCalledWith("1 failed", "error");
    expect(opts.onSuccess).toHaveBeenCalledWith([{ ok: true }, { ok: false }]);
  });
});

describe("isApiSuccessFalse", () => {
  it.each([
    [{ data: { success: false, error: "x" } }, true],
    [{ data: { success: false, error: 42 } }, true],
    [{ data: { success: false } }, true],
    [{ data: { success: true } }, false],
    [{ data: {} }, false],
    [{}, false],
    [{ data: null }, false],
    [{ data: "no" }, false],
    [null, false],
    [undefined, false],
  ])("%j → %s", (input, expected) => {
    expect(isApiSuccessFalse(input)).toBe(expected);
  });
});
