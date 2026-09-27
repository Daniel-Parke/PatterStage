/** @jest-environment node */
import { NextRequest } from "next/server";

const TOKEN = "test-token-abcdefghijklmnop";

function request(path: string, method = "GET"): NextRequest {
  return new NextRequest(`http://localhost:4242${path}`, {
    method,
    headers: { host: "localhost:4242" },
  });
}

async function proxyRequest(path: string, method = "GET") {
  jest.resetModules();
  const { proxy } = await import("@/proxy");
  return proxy(request(path, method));
}

describe("T-0170 public liveness routes", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.PS_AUTH_TOKEN = TOKEN;
    delete process.env.PS_AUTH_MODE;
    delete process.env.PS_READ_ONLY;
    delete process.env.CH_READ_ONLY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("allows an unauthenticated GET to each liveness path", async () => {
    expect((await proxyRequest("/healthz")).status).toBe(200);
    expect((await proxyRequest("/api/healthz")).status).toBe(200);
  });

  it("keeps unsafe methods and system status behind authentication", async () => {
    for (const path of ["/healthz", "/api/healthz"]) {
      expect((await proxyRequest(path, "POST")).status).toBe(401);
      expect((await proxyRequest(path, "DELETE")).status).toBe(401);
    }
    expect((await proxyRequest("/api/status")).status).toBe(401);
  });

  it("returns only plain-text ok with no-store at the bare path", async () => {
    const { GET } = await import("@/app/healthz/route");
    const response = GET();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns the same bare JSON shape as /api/health at its alias", async () => {
    const { GET } = await import("@/app/api/healthz/route");
    const response = GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
