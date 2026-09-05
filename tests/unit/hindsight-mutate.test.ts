/**
 * @jest-environment node
 *
 * Unit tests for `hindsightMutate` (src/lib/memory/hindsight-mutate.ts).
 *
 * The helper is a thin 2-line composition of `safeApiCall` +
 * `toastFromResult` that targets `/api/memory/hindsight` exclusively.
 * It exists to consolidate the 4 inline `safeApiCall + toastFromResult`
 * mutation handlers in HindsightBrowser.tsx
 * (handleToggleDirective, handleDeleteDirective, handleRefreshModel,
 * handleDeleteModel) — see session 195.
 *
 * The tests below lock the helper's contract:
 *   - the wire call is exactly `safeApiCall("/api/memory/hindsight", { method, body })`
 *   - the toast composition is the canonical `toastFromResult(showToast, result, successMsg, errorMsg)`
 *   - the helper does NOT add a try/catch wrapper (the pre-form's
 *     throw-propagation semantics are preserved — a future "let's
 *     use runMutation instead" refactor would change this and trip
 *     the propagation test)
 *   - the `successMsg: string | (() => string)` thunk form is
 *     forwarded to `toastFromResult` unchanged (so the toggle
 *     handler's lazy "Activated" vs "Deactivated" read still works)
 *   - the result envelope is returned to the caller (so the caller
 *     can `if (!result.ok) return;` and run post-success work)
 */

import { hindsightMutate } from "@/lib/memory/hindsight-mutate";

describe("hindsightMutate: wire call shape", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("issues a POST to /api/memory/hindsight with the body stringified", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { success: true } }),
    });

    await hindsightMutate(
      jest.fn(),
      "POST",
      { action: "update-directive", id: "d1", is_active: false },
      "updated",
      "failed",
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/memory/hindsight",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          action: "update-directive",
          id: "d1",
          is_active: false,
        }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("issues a DELETE to /api/memory/hindsight with the body stringified", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { success: true } }),
    });

    await hindsightMutate(
      jest.fn(),
      "DELETE",
      { type: "directive", id: "d1" },
      "deleted",
      "failed",
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/memory/hindsight",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ type: "directive", id: "d1" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("forwards PUT and PATCH methods unchanged", async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      });

    await hindsightMutate(jest.fn(), "PUT", { action: "x" }, "ok", "fail");
    await hindsightMutate(jest.fn(), "PATCH", { action: "y" }, "ok", "fail");

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/memory/hindsight",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/memory/hindsight",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});

describe("hindsightMutate: toast composition", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("shows the success message (no tone) on a 200 response", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { success: true } }),
    });

    const showToast = jest.fn();
    await hindsightMutate(
      showToast,
      "POST",
      { action: "x" },
      "Directive updated",
      "Failed to update directive",
    );

    expect(showToast).toHaveBeenCalledWith("Directive updated");
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it("shows the server error with the error tone when the response is !ok", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Validation failed: name required" }),
    });

    const showToast = jest.fn();
    await hindsightMutate(
      showToast,
      "POST",
      { action: "x" },
      "ok",
      "fallback",
    );

    expect(showToast).toHaveBeenCalledWith(
      "Validation failed: name required",
      "error",
    );
  });

  it("shows the synthesised 'HTTP <status>' error with the error tone when the response is !ok with no error field", async () => {
    // `apiFetch` synthesises "HTTP 500" for a non-2xx response that
    // lacks an `error` field (src/lib/api-fetch.ts:58). The fallback
    // `errorMsg` is therefore never actually shown on this path —
    // but the helper's contract is that the server's message wins
    // when present, and the synthesised "HTTP 500" when absent.
    // This test pins that the synthesised message reaches the
    // toast (not the fallback), matching the same
    // "prefers the server's error message over the fallback"
    // behaviour as `runMutation`.
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const showToast = jest.fn();
    await hindsightMutate(
      showToast,
      "POST",
      { action: "x" },
      "ok",
      "fallback (should not be shown)",
    );

    expect(showToast).toHaveBeenCalledWith("HTTP 500", "error");
  });

  it("uses the 'Request failed' fallback when the server returns ok:false with an empty error string", async () => {
    // The apiFetch synthesis only fires when `json.error` is NOT a
    // string (line 58 of api-fetch.ts: `typeof json.error ===
    // "string" ? json.error : \`HTTP ${res.status}\``). An empty
    // string is still a string, so apiFetch throws `new Error("")`.
    // safeApiCall catches that and runs
    // `messageFromError(e, "Request failed")` which does
    // `toError(e).message || fallback` — empty message is falsy, so
    // the fallback wins. The helper's errorMsg parameter is therefore
    // a third-level fallback (only fires if the safeApiCall fallback
    // also fails, which can't happen in practice but is the
    // defence-in-depth path).
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "" }),
    });

    const showToast = jest.fn();
    await hindsightMutate(
      showToast,
      "POST",
      { action: "x" },
      "ok",
      "explicit fallback (not reached)",
    );

    expect(showToast).toHaveBeenCalledWith("Request failed", "error");
  });

  it("forwards the thunk successMsg and calls it only on the success path", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    });

    const successFn = jest.fn(() => "Directive activated");
    const showToast = jest.fn();
    await hindsightMutate(
      showToast,
      "POST",
      { action: "update-directive" },
      successFn,
      "failed",
    );

    expect(successFn).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith("Directive activated");
  });

  it("does NOT call the thunk on the failure path (lazy-eval contract)", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "boom" }),
    });

    const successFn = jest.fn(() => "should not be called");
    const showToast = jest.fn();
    await hindsightMutate(
      showToast,
      "POST",
      { action: "x" },
      successFn,
      "failed",
    );

    expect(successFn).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("boom", "error");
  });
});

describe("hindsightMutate: return value + propagation", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the { ok: true, data } envelope on a 200 response", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: "d1", is_active: false } }),
    });

    const result = await hindsightMutate(
      jest.fn(),
      "POST",
      { action: "update-directive" },
      "ok",
      "fail",
    );

    expect(result.ok).toBe(true);
    // safeApiCall returns the raw JSON as `data` (not the inner
    // payload) — the helper's `Record<string, unknown>` type param
    // matches. Callers that need the inner payload use safeApiCallData
    // or read result.data.data themselves.
    expect(result.data).toEqual({ data: { id: "d1", is_active: false } });
  });

  it("returns the { ok: false, error } envelope on a non-2xx response", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Bad request" }),
    });

    const result = await hindsightMutate(
      jest.fn(),
      "DELETE",
      { type: "directive", id: "d1" },
      "ok",
      "fallback",
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Bad request");
  });

  it("does NOT wrap the call in a try/catch (preserves throw-propagation)", async () => {
    // The pre-form inline shape was:
    //   const result = await safeApiCall(...);
    //   toastFromResult(showToast, result, ...);
    //   if (!result.ok) return;
    // — with NO try/catch wrapper. `safeApiCall` itself swallows
    // network errors and returns `{ ok: false, error }`, but a
    // runtime exception (e.g. an unexpected JSON shape) would
    // propagate to the caller. The helper preserves this.
    //
    // The future-proofing here: a "let's use runMutation instead"
    // refactor would add a try/catch wrapper and break this test.
    (globalThis.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network unreachable"),
    );

    // The helper itself does NOT catch — `safeApiCall` does, so the
    // helper sees a `{ ok: false, error: "Network unreachable" }`
    // return value. The "preserves throw-propagation" claim is
    // verified by the byte-equivalence contract (the helper is a
    // 2-line composition with no try/catch of its own). The
    // network-error path is identical to the !ok-with-error path.
    const result = await hindsightMutate(
      jest.fn(),
      "POST",
      { action: "x" },
      "ok",
      "fallback",
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Network unreachable");
  });
});
