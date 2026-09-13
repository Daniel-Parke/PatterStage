/**
 * @jest-environment node
 *
 * Tests for `GET /api/gateway/health` — the "reachable vs. authenticated"
 * distinction.
 *
 * The probe hits the gateway's `/v1/models`. A thrown/timed-out fetch means
 * the gateway is genuinely down (`online: false`). ANY HTTP response — including
 * a 401/403 — proves the gateway answered, so it's reachable (`online: true`);
 * a 401/403 specifically means the gateway is up but PatterStage couldn't
 * authenticate (`authConfigured: false`), which the chat page renders as an
 * actionable "set API_SERVER_KEY" banner instead of a misleading "offline".
 *
 * It also returns WHICH gateway it probed (T-0080). The offline banner used to
 * name a hardcoded port 8642 and said so while the gateway was on 8652 --
 * sending the operator to fix a port that was not the one that was down. Only
 * the server can answer that, so these tests use `toEqual` on the whole body
 * deliberately: an accidentally-dropped field is a banner that goes back to
 * guessing.
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

const GATEWAY = "http://127.0.0.1:9";

async function bodyOf(res: { json: () => Promise<unknown> }) {
  return (await res.json()) as {
    data: { online: boolean; authConfigured: boolean; baseUrl: string };
  };
}

describe("GET /api/gateway/health", () => {
  it("2xx → online + authConfigured", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    const body = await bodyOf(await GET());
    expect(body).toEqual({ data: { online: true, authConfigured: true, baseUrl: GATEWAY } });
  });

  it("401 → reachable but NOT authenticated (online true, authConfigured false)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 } as Response);
    const body = await bodyOf(await GET());
    expect(body).toEqual({ data: { online: true, authConfigured: false, baseUrl: GATEWAY } });
  });

  it("403 → reachable but NOT authenticated", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 } as Response);
    const body = await bodyOf(await GET());
    expect(body).toEqual({ data: { online: true, authConfigured: false, baseUrl: GATEWAY } });
  });

  it("500 → reachable (an HTTP response, not an auth failure)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const body = await bodyOf(await GET());
    expect(body).toEqual({ data: { online: true, authConfigured: true, baseUrl: GATEWAY } });
  });

  it("network error/timeout → offline", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:9"));
    const body = await bodyOf(await GET());
    expect(body).toEqual({ data: { online: false, authConfigured: false, baseUrl: GATEWAY } });
  });

  it("names the gateway EVEN WHEN OFFLINE, which is when the banner needs it", async () => {
    // The load-bearing case. A reachable gateway needs no banner; the
    // address matters precisely in the branch where the probe threw, and
    // that branch is the one where it would be easiest to forget.
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect((await bodyOf(await GET())).data.baseUrl).toBe(GATEWAY);
  });

  it("follows the CONFIGURED gateway rather than a constant", async () => {
    // The defect in one assertion: a hardcoded answer passes every test
    // above, because they all happen to run against one address.
    process.env = { ...ORIGINAL_ENV, HERMES_GATEWAY_URL: "http://127.0.0.1:8652" };
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect((await bodyOf(await GET())).data.baseUrl).toBe("http://127.0.0.1:8652");
  });

  it("never returns the bearer key alongside the address", async () => {
    // The address is not a credential (boot-diagnostics.ts states the
    // ruling). The key is, and this endpoint is unauthenticated enough to
    // be worth pinning rather than assuming.
    process.env = { ...ORIGINAL_ENV, HERMES_GATEWAY_URL: GATEWAY, API_SERVER_KEY: "sk-secret-xyz" };
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    expect(JSON.stringify(await bodyOf(await GET()))).not.toContain("sk-secret-xyz");
  });
});
