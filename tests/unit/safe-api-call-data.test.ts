/**
 * @jest-environment node
 *
 * Tests for `safeApiCallData` — the `{ data: T }` envelope unwrapper.
 *
 * `safeApiCallData` is a thin wrapper around `safeApiCall` that returns
 * the inner `data` field directly (`T | null`) instead of the raw
 * envelope. The tests below pin the byte-equivalence claim from the
 * helper's JSDoc: every shape that `safeApiCall<{ data?: T }>(path)`
 * can produce is unwrapped to the same value the manual
 * `result.data?.data ?? null` form would yield.
 *
 * The cases mirror the inline-form behavior in `src/app/page.tsx`:
 *   - 200 with `{ data: <value> }` → returns `<value>` (or `null` if data is null)
 *   - non-2xx → returns `null` (matches the `?? null` fallback)
 *   - 200 with `{ data: null }` → returns `null` (matches the `?? null` fallback)
 *   - 200 with `{ data: undefined }` (e.g. extra envelope field) → returns `null`
 *   - network/parse error → returns `null`
 */

import { safeApiCallData } from "@/lib/api-fetch";

describe("safeApiCallData envelope unwrapping", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the inner data on a 200 response with { data: T }", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { name: "agent", count: 5 } }),
    });

    const result = await safeApiCallData<{ name: string; count: number }>(
      "/api/test",
    );
    expect(result).toEqual({ name: "agent", count: 5 });
  });

  it("returns null when the response has ok: false (server error)", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal failure" }),
    });

    const result = await safeApiCallData<{ value: number }>("/api/test");
    expect(result).toBeNull();
  });

  it("returns null when the response is 404 (not found)", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    });

    const result = await safeApiCallData<unknown>("/api/missing");
    expect(result).toBeNull();
  });

  it("returns null when the 200 envelope has data: null", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: null }),
    });

    const result = await safeApiCallData<{ foo: string }>("/api/empty");
    expect(result).toBeNull();
  });

  it("returns null when the 200 envelope has data: undefined (key omitted)", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const result = await safeApiCallData<{ foo: string }>("/api/empty");
    expect(result).toBeNull();
  });

  it("returns null when fetch throws (network error)", async () => {
    (globalThis.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network unreachable"),
    );

    const result = await safeApiCallData<{ foo: string }>("/api/down");
    expect(result).toBeNull();
  });

  it("returns null when the response is invalid JSON", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });

    const result = await safeApiCallData<{ foo: string }>("/api/garbage");
    expect(result).toBeNull();
  });

  it("preserves the inner data shape for arrays", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [1, 2, 3] }),
    });

    const result = await safeApiCallData<number[]>("/api/list");
    expect(result).toEqual([1, 2, 3]);
  });

  it("preserves zero / false / empty-string inner values (does not coerce to null)", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: 0 }),
    });

    const zeroResult = await safeApiCallData<number>("/api/zero");
    expect(zeroResult).toBe(0);

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: false }),
    });

    const falseResult = await safeApiCallData<boolean>("/api/false");
    expect(falseResult).toBe(false);

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: "" }),
    });

    const emptyResult = await safeApiCallData<string>("/api/empty-string");
    expect(emptyResult).toBe("");
  });

  it("forwards the init options to fetch (signal, method, body)", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { ok: true } }),
    });

    const controller = new AbortController();
    await safeApiCallData<{ ok: boolean }>("/api/test", {
      method: "POST",
      signal: controller.signal,
      body: { action: "test" },
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({ action: "test" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("byte-equivalence: result matches the manual `result.data?.data ?? null` form", async () => {
    // Direct form: `safeApiCall<{ data?: T }>(path)` + manual unwrap.
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { value: 42 } }),
    });

    const { safeApiCall } = await import("@/lib/api-fetch");
    const manualResult = await safeApiCall<{ data?: { value: number } }>(
      "/api/test",
    );
    const manualUnwrapped = manualResult.data?.data ?? null;

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { value: 42 } }),
    });

    const helperResult = await safeApiCallData<{ value: number }>("/api/test");

    expect(helperResult).toEqual(manualUnwrapped);
  });
});
