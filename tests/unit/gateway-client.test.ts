/** @jest-environment node */

describe("gateway-client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("gatewayUrl respects HERMES_GATEWAY_URL", async () => {
    process.env.HERMES_GATEWAY_URL = "http://192.168.1.50:9000";
    const { gatewayUrl } = await import("@/lib/gateway-client");
    expect(gatewayUrl("/v1/models")).toBe("http://192.168.1.50:9000/v1/models");
  });

  it("getAgentLlmEndpoints uses CONTROL_HUB_LLM_API for chat URL", async () => {
    process.env.CONTROL_HUB_LLM_API = "http://10.0.0.5:8642/v1/chat/completions";
    const { getAgentLlmEndpoints } = await import("@/modules/hermes/lib/agent-runtime");
    const { apiUrl, gatewayBase } = getAgentLlmEndpoints();
    expect(apiUrl).toBe("http://10.0.0.5:8642/v1/chat/completions");
    expect(gatewayBase).toBe("http://10.0.0.5:8642");
  });
});

// ── fetchGateway bearer-key forwarding ──────────────────────────
//
// The proxy routes (/api/gateway/health, /api/gateway/models) must
// authenticate to a key-required gateway the same way the runtime
// adapter does: Authorization: Bearer <API_SERVER_KEY>. Without this
// they 401 even after the user sets the key, which the chat page
// misreads as "offline". A caller may still override the header.
describe("fetchGateway — bearer key forwarding", () => {
  const mockFetch = jest.fn();
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    process.env.HERMES_GATEWAY_URL = "http://127.0.0.1:9";
  });
  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  /** Headers handed to fetch, normalised to lower-case keys. */
  function headersFromLastCall(): Record<string, string> {
    const init = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined;
    const h = (init?.headers ?? {}) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = v;
    return out;
  }

  it("attaches Authorization: Bearer <key> when API_SERVER_KEY is set", async () => {
    process.env.API_SERVER_KEY = "sk-test-123";
    const { fetchGateway } = await import("@/lib/gateway-client");
    await fetchGateway("/v1/models", { method: "GET" });
    expect(headersFromLastCall().authorization).toBe("Bearer sk-test-123");
  });

  it("omits Authorization when no key is configured", async () => {
    delete process.env.API_SERVER_KEY;
    const { fetchGateway } = await import("@/lib/gateway-client");
    await fetchGateway("/v1/models", { method: "GET" });
    expect(headersFromLastCall().authorization).toBeUndefined();
  });

  it("lets a caller-supplied Authorization header win", async () => {
    process.env.API_SERVER_KEY = "sk-env-key";
    const { fetchGateway } = await import("@/lib/gateway-client");
    await fetchGateway("/v1/models", {
      method: "GET",
      headers: { Authorization: "Bearer caller-override" },
    });
    expect(headersFromLastCall().authorization).toBe("Bearer caller-override");
  });
});
