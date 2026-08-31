/** @jest-environment node */
/**
 * QA round 6 — top-level /healthz liveness endpoint.
 *
 * /api/health and /api/healthz already exist as unauthenticated JSON liveness
 * probes (see src/proxy.ts PUBLIC_PATHS and src/app/api/health/route.ts), but
 * the objective here is the BARE path: GET /healthz → 200, body "ok".
 *
 * Two surfaces must both hold, because src/proxy.ts runs before every route:
 *   1. the proxy treats /healthz as public (GET/HEAD pass untouched, unsafe
 *      methods stay refused) — the route file alone would still 401;
 *   2. the route handler returns exactly status 200, text "ok",
 *      text/plain, no-store — no JSON, no internals.
 *
 * Written BEFORE the implementation (TDD): /healthz is not in PUBLIC_PATHS
 * and src/app/healthz/route.ts does not exist yet, so both tests fail today.
 */
import { NextRequest } from "next/server";

const TOKEN = "test-token-abcdefghijklmnop";

function req(
  url: string,
  init: { method?: string; headers?: Record<string, string> } = {},
): NextRequest {
  const headers: Record<string, string> = { host: "localhost:4242", ...(init.headers ?? {}) };
  return new NextRequest(url, { method: init.method ?? "GET", headers });
}

async function loadProxy() {
  jest.resetModules();
  const mod = await import("@/proxy");
  return mod.proxy;
}

describe("proxy — /healthz is a public liveness path", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    process.env.PS_AUTH_TOKEN = TOKEN;
    delete process.env.PS_AUTH_MODE;
    delete process.env.PS_READ_ONLY;
    delete process.env.CH_READ_ONLY;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("lets an unauthenticated GET /healthz through to the route", async () => {
    const proxy = await loadProxy();
    expect(proxy(req("http://localhost:4242/healthz")).status).toBe(200); // NextResponse.next()
  });

  it("still refuses unsafe methods on /healthz without a token", async () => {
    const proxy = await loadProxy();
    expect(proxy(req("http://localhost:4242/healthz", { method: "POST" })).status).toBe(401);
    expect(proxy(req("http://localhost:4242/healthz", { method: "DELETE" })).status).toBe(401);
  });
});

describe("GET /healthz route handler — the bare liveness contract", () => {
  it("returns 200 with the exact body 'ok' as text/plain and no-store", async () => {
    const { GET } = await import("@/app/healthz/route");
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("leaks nothing but 'ok' — no JSON fields, no config or version info", async () => {
    const { GET } = await import("@/app/healthz/route");
    const res = GET();
    const body = await res.text();
    expect(body).toBe("ok");
    expect(JSON.stringify(res.headers)).not.toMatch(/version|token|path|dir/i);
  });
});
