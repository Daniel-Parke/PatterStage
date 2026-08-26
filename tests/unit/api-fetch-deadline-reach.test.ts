/**
 * @jest-environment node
 *
 * T-0047 acceptance oracle — the reach of the client deadline T-0040 added.
 *
 * T-0040 gave `apiFetch` a 45s ceiling to stop the chat composer sitting on
 * "Thinking…" forever. The justification was chat-specific — 45s sits above
 * HermesRuntime's own 30s gateway deadline so the server's real diagnosis wins
 * the race — but the constant governs EVERY call through `apiFetch`.
 *
 * That includes the bulk operations, which have no such 30s bound and no way
 * to ask for more: "Push all"/"Pull all" and the model-catalogue sync both go
 * through `runSyncAction` -> `apiFetch` with no caller signal, so a bulk sync
 * that legitimately runs past 45s is aborted mid-flight and reported to the
 * operator as a timeout. Seeding is the same shape.
 *
 * The deadline is right; its being a single un-overridable global is not.
 */

import { API_FETCH_TIMEOUT_MS, API_FETCH_BULK_TIMEOUT_MS, apiFetch } from "@/lib/api-fetch";

const okJson = () => ({ ok: true, status: 200, json: async () => ({ data: {} }) });

describe("the client deadline is chosen per call, not imposed globally", () => {
  const originalFetch = globalThis.fetch;
  let timeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    globalThis.fetch = jest.fn().mockResolvedValue(okJson()) as unknown as typeof fetch;
    timeoutSpy = jest.spyOn(AbortSignal, "timeout");
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    timeoutSpy.mockRestore();
  });

  it("still defaults to the interactive ceiling, unchanged by this work", async () => {
    await apiFetch("/api/monitor");
    expect(timeoutSpy).toHaveBeenCalledWith(API_FETCH_TIMEOUT_MS);
    expect(API_FETCH_TIMEOUT_MS).toBe(45_000);
  });

  it("honours a caller's own longer deadline for a bulk operation", async () => {
    await apiFetch("/api/agent/profiles/sync/push", {
      method: "POST",
      timeoutMs: API_FETCH_BULK_TIMEOUT_MS,
    });
    expect(timeoutSpy).toHaveBeenCalledWith(API_FETCH_BULK_TIMEOUT_MS);
  });

  it("gives bulk work materially more room than an interactive call", () => {
    expect(API_FETCH_BULK_TIMEOUT_MS).toBeGreaterThan(API_FETCH_TIMEOUT_MS);
  });

  it("names the path when a deadline is what actually fired", async () => {
    globalThis.fetch = jest.fn().mockImplementation((_u, init: RequestInit) => {
      // Model a real abort: the signal is already aborted when fetch rejects.
      Object.defineProperty(init.signal as AbortSignal, "aborted", { value: true });
      return Promise.reject(new DOMException("aborted", "AbortError"));
    }) as unknown as typeof fetch;
    await expect(apiFetch("/api/seed", { method: "POST", timeoutMs: 1 })).rejects.toThrow(
      /No response after .*\/api\/seed/,
    );
  });

  // ── no-regression guards ──

  it("still lets a caller's own AbortSignal win outright", async () => {
    const ac = new AbortController();
    await apiFetch("/api/monitor", { signal: ac.signal });
    const init = (globalThis.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(ac.signal);
    expect(timeoutSpy).not.toHaveBeenCalled();
  });

  it("still sends the JSON content type and the caller's own headers", async () => {
    await apiFetch("/api/monitor", { headers: { "X-Trace": "1" } });
    const init = (globalThis.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ "Content-Type": "application/json", "X-Trace": "1" });
  });
});

describe("the bulk operations actually ask for the bulk deadline", () => {
  it("runSyncAction forwards a timeoutMs to apiFetch", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue(okJson()) as unknown as typeof fetch;
    const timeoutSpy = jest.spyOn(AbortSignal, "timeout");
    try {
      const { runSyncAction } = await import("@/lib/operation-sync-action");
      await runSyncAction({
        showToast: () => undefined,
        url: "/api/agent/profiles/sync/push",
        body: {},
        successMessage: "ok",
        errorMessage: "no",
        timeoutMs: API_FETCH_BULK_TIMEOUT_MS,
      });
      expect(timeoutSpy).toHaveBeenCalledWith(API_FETCH_BULK_TIMEOUT_MS);
    } finally {
      globalThis.fetch = originalFetch;
      timeoutSpy.mockRestore();
    }
  });
});
