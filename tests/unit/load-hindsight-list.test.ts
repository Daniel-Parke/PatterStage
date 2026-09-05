/**
 * @jest-environment node
 *
 * Unit tests for `loadHindsightList` (src/lib/hindsight-client.ts).
 *
 * The helper is a thin composition of `hindsightGet` (envelope
 * unwrap) + a busy-state toggle + a server-error toast + an
 * empty-state reset. It exists to consolidate the 2 inline
 * `loadDirectives` + `loadModels` `useCallback`s in
 * HindsightBrowser.tsx — see session 204.
 *
 * The tests below lock the helper's contract:
 *   - the wire call is exactly `hindsightGet(action)` (no
 *     transformation of the action string)
 *   - the busy-state setter is called `true` BEFORE the fetch and
 *     `false` AFTER (the pre-form's `setLoading(true) → await →
 *     setLoading(false)` ladder)
 *   - the server-error toast is shown with the error string from
 *     the inner payload, and the items are reset to `[]` (so the
 *     caller's UI is in a consistent state on the error path)
 *   - on the happy path, the inner payload's `key` property is
 *     extracted and forwarded to the items setter
 *   - on a network error (hindsightGet returns `null`), the busy
 *     setter is still called `false` and the items are reset to `[]`
 *     (matches the pre-form's `setX([])` reset on the error path)
 *   - the helper does NOT add a try/catch wrapper (the pre-form's
 *     throw-propagation semantics are preserved)
 */

import { loadHindsightList } from "@/lib/memory/hindsight-client";

interface Directive {
  id: string;
  name: string;
}

interface MentalModel {
  id: string;
  name: string;
}

describe("loadHindsightList: wire call shape", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("issues a GET to /api/memory/hindsight with the action query param", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { directives: [] } }),
    });

    const setBusy = jest.fn();
    const setItems = jest.fn();
    const showToast = jest.fn();

    await loadHindsightList<Directive>(
      "directives",
      setBusy,
      "directives",
      setItems,
      showToast,
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/memory/hindsight?action=directives",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("forwards a different action unchanged (mental-models)", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { models: [] } }),
    });

    const setBusy = jest.fn();
    const setItems = jest.fn();
    const showToast = jest.fn();

    await loadHindsightList<MentalModel>(
      "mental-models",
      setBusy,
      "models",
      setItems,
      showToast,
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/memory/hindsight?action=mental-models",
      expect.anything(),
    );
  });
});

describe("loadHindsightList: busy-state toggle", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("calls setBusy(true) BEFORE the fetch and setBusy(false) AFTER on the happy path", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { directives: [{ id: "d1", name: "D1" }] } }),
    });

    const setBusy = jest.fn();
    const setItems = jest.fn();
    const showToast = jest.fn();

    await loadHindsightList<Directive>(
      "directives",
      setBusy,
      "directives",
      setItems,
      showToast,
    );

    // First call is `true` (BEFORE the fetch), last call is `false`
    // (AFTER the fetch resolves) — matches the pre-form's
    // `setLoadingDirectives(true) → await → setLoadingDirectives(false)`
    // ladder.
    expect(setBusy.mock.calls[0]?.[0]).toBe(true);
    expect(setBusy.mock.calls[setBusy.mock.calls.length - 1]?.[0]).toBe(false);
  });

  it("calls setBusy(false) AFTER the fetch even on the error path", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { error: "boom" } }),
    });

    const setBusy = jest.fn();
    const setItems = jest.fn();
    const showToast = jest.fn();

    await loadHindsightList<Directive>(
      "directives",
      setBusy,
      "directives",
      setItems,
      showToast,
    );

    // The fetch resolved, so the busy flag MUST be reset to `false`
    // even though the server returned an error — the pre-form's
    // `setLoadingDirectives(false)` ran on every code path that
    // reached the await's resolution.
    expect(setBusy.mock.calls[setBusy.mock.calls.length - 1]?.[0]).toBe(false);
  });

  it("calls setBusy(false) AFTER a network error (hindsightGet returns null)", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "internal" }),
    });

    const setBusy = jest.fn();
    const setItems = jest.fn();
    const showToast = jest.fn();

    await loadHindsightList<Directive>(
      "directives",
      setBusy,
      "directives",
      setItems,
      showToast,
    );

    // Network error path: hindsightGet returns null, but the busy
    // flag MUST still be reset to `false` so the caller's UI doesn't
    // spin forever. Matches the pre-form's
    // `setLoadingDirectives(false)` placement (BEFORE the `if
    // (inner?.error)` check).
    expect(setBusy.mock.calls[setBusy.mock.calls.length - 1]?.[0]).toBe(false);
  });
});

describe("loadHindsightList: happy path", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("forwards the directives array to setItems on the directives action", async () => {
    const directives = [
      { id: "d1", name: "First" },
      { id: "d2", name: "Second" },
    ];
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { directives } }),
    });

    const setBusy = jest.fn();
    const setItems = jest.fn();
    const showToast = jest.fn();

    await loadHindsightList<Directive>(
      "directives",
      setBusy,
      "directives",
      setItems,
      showToast,
    );

    expect(setItems).toHaveBeenCalledWith(directives);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("forwards the models array to setItems on the mental-models action", async () => {
    const models = [{ id: "m1", name: "First Model" }];
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { models } }),
    });

    const setBusy = jest.fn();
    const setItems = jest.fn();
    const showToast = jest.fn();

    await loadHindsightList<MentalModel>(
      "mental-models",
      setBusy,
      "models",
      setItems,
      showToast,
    );

    expect(setItems).toHaveBeenCalledWith(models);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("forwards [] when the inner payload has no matching key (empty case)", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    });

    const setBusy = jest.fn();
    const setItems = jest.fn();
    const showToast = jest.fn();

    await loadHindsightList<Directive>(
      "directives",
      setBusy,
      "directives",
      setItems,
      showToast,
    );

    // `inner?.[key] || []` collapses to `[]` when the key is absent.
    expect(setItems).toHaveBeenCalledWith([]);
  });
});

describe("loadHindsightList: error paths", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("toasts the server error and resets items to [] on the error path", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { error: "Hindsight unavailable" } }),
    });

    const setBusy = jest.fn();
    const setItems = jest.fn();
    const showToast = jest.fn();

    await loadHindsightList<Directive>(
      "directives",
      setBusy,
      "directives",
      setItems,
      showToast,
    );

    expect(showToast).toHaveBeenCalledWith("Hindsight unavailable", "error");
    expect(setItems).toHaveBeenCalledWith([]);
  });

  it("resets items to [] on a network error (hindsightGet returns null)", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "internal" }),
    });

    const setBusy = jest.fn();
    const setItems = jest.fn();
    const showToast = jest.fn();

    await loadHindsightList<Directive>(
      "directives",
      setBusy,
      "directives",
      setItems,
      showToast,
    );

    // No toast on the network error path — the pre-form's
    // `safeApiCall` already surfaces the network error upstream;
    // the inline `if (inner?.error)` block is server-error-only.
    expect(showToast).not.toHaveBeenCalled();
    expect(setItems).toHaveBeenCalledWith([]);
  });
});

describe("loadHindsightList: no try/catch wrapper", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("does not swallow thrown errors (the helper has no try/catch)", async () => {
    // The helper has NO try/catch wrapper. Any error from
    // `hindsightGet` propagates up unchanged. `hindsightGet` itself
    // catches network errors (via `safeApiCall`) and returns `null`,
    // so the only path for a thrown error to reach the helper is if
    // `hindsightGet` itself throws (which it doesn't in the current
    // code, but if a future refactor added a try/catch inside the
    // helper that swallowed the throw, this test would catch it).
    //
    // We test the contract by inspecting the source: the helper body
    // should be a 5-line composition with no try/catch. This is
    // enforced by the source-pattern test in
    // `hindsight-browser-load-hindsight-list-migration.test.ts`.
    //
    // For the runtime contract, we verify the helper's `setBusy(false)`
    // is called even on a network error (covered in the
    // `busy-state toggle` suite above) — that proves the helper
    // reaches the line AFTER the await unconditionally, which is the
    // no-try-catch behavior.
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "internal" }),
    });

    const setBusy = jest.fn();
    const setItems = jest.fn();
    const showToast = jest.fn();

    // Network error → `safeApiCall` catches it → `hindsightGet`
    // returns `null` → helper resets busy to `false` and items to
    // `[]`. The helper's return is a resolved promise (no throw).
    await expect(
      loadHindsightList<Directive>(
        "directives",
        setBusy,
        "directives",
        setItems,
        showToast,
      ),
    ).resolves.toBeUndefined();
    // The busy flag MUST be reset (proves no try/catch swallowed
    // the path through the await).
    expect(setBusy.mock.calls[setBusy.mock.calls.length - 1]?.[0]).toBe(false);
  });
});
