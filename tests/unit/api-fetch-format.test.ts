/**
 * @jest-environment node
 *
 * Tests that apiFetch formats error responses correctly:
 * - uses the server's error field as the message
 * - appends cronPushError when present
 */

import { apiFetch } from "@/lib/api-fetch";

describe("apiFetch error formatting", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("throws the server error string when response is not ok", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    });

    await expect(apiFetch("/api/test")).rejects.toThrow("Not found");
  });

  it("appends cronPushError when present in error response", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({
        error: "Failed to sync cron job to Hermes",
        cronPushError: "venv missing",
      }),
    });

    await expect(apiFetch("/api/test")).rejects.toThrow(
      "Failed to sync cron job to Hermes: venv missing",
    );
  });

  it("uses HTTP status as fallback when no error field", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await expect(apiFetch("/api/test")).rejects.toThrow("HTTP 500");
  });
});
