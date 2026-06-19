/**
 * @jest-environment node
 *
 * Tests for `GET /api/gateway/health` — the "reachable vs. authenticated"
 * distinction.
 *
 * The probe hits the gateway's `/v1/models`. A thrown/timed-out fetch means
 * the gateway is genuinely down (`online: false`). ANY HTTP response — including
 * a 401/403 — proves the gateway answered, so it's reachable (`online: true`);
 * a 401/403 specifically means the gateway is up but Control Hub couldn't
 * authenticate (`authConfigured: false`), which the chat page renders as an
 * actionable "set API_SERVER_KEY" banner instead of a misleading "offline".
 */

import { GET } from "@/app/api/gateway/health/route";

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;
const ORIGINAL_ENV = process.env;

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  // Resolve gateway URLs against a fixed base, independent of ~/.hermes/.env.
  process.env = { ...ORIGINAL_ENV, HERMES_GATEWAY_URL: "http://127.0.0.1:9" };
});
afterAll(() => {
  globalThis.fetch = originalFetch;
  process.env = ORIGINAL_ENV;
});

async function bodyOf(res: { json: () => Promise<unknown> }) {
  return (await res.json()) as { data: { online: boolean; authConfigured: boolean } };
}

describe("GET /api/gateway/health", () => {
  it("2xx → online + authConfigured", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    const body = await bodyOf(await GET());
    expect(body).toEqual({ data: { online: true, authConfigured: true } });
  });

  it("401 → reachable but NOT authenticated (online true, authConfigured false)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 } as Response);
    const body = await bodyOf(await GET());
    expect(body).toEqual({ data: { online: true, authConfigured: false } });
  });

  it("403 → reachable but NOT authenticated", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 } as Response);
    const body = await bodyOf(await GET());
    expect(body).toEqual({ data: { online: true, authConfigured: false } });
  });

  it("500 → reachable (an HTTP response, not an auth failure)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const body = await bodyOf(await GET());
    expect(body).toEqual({ data: { online: true, authConfigured: true } });
  });

  it("network error/timeout → offline", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:9"));
    const body = await bodyOf(await GET());
    expect(body).toEqual({ data: { online: false, authConfigured: false } });
  });
});
