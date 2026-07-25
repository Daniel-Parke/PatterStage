/** @jest-environment node */
/**
 * The regression test for the hole that motivated the security hotfix.
 *
 * Before src/proxy.ts existed, `requireAuth()` only checked the read-only flag,
 * so every one of the ~100 API routes was reachable by anyone who could open
 * the port — and `npm run start:network` binds 0.0.0.0. The concrete exploit was
 * `PUT /api/scripts/<name>` (write arbitrary script) followed by
 * `POST /api/scripts/run` (execute it): unauthenticated RCE.
 *
 * These tests assert the boundary itself, at the one place it is enforced.
 */
import { NextRequest } from "next/server";

import { SESSION_COOKIE, TOKEN_QUERY_PARAM } from "@/lib/auth-token";

const TOKEN = "test-token-abcdefghijklmnop";

function req(
  url: string,
  init: { method?: string; headers?: Record<string, string>; cookie?: string } = {},
): NextRequest {
  const headers: Record<string, string> = { host: "localhost:4242", ...(init.headers ?? {}) };
  if (init.cookie) headers.cookie = `${SESSION_COOKIE}=${init.cookie}`;
  return new NextRequest(url, { method: init.method ?? "GET", headers });
}

async function loadProxy() {
  jest.resetModules();
  const mod = await import("@/proxy");
  return mod.proxy;
}

describe("proxy — the authentication boundary", () => {
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

  it("rejects the write half of the RCE chain without a token", async () => {
    const proxy = await loadProxy();
    const res = proxy(req("http://localhost:4242/api/scripts/pwn.sh", { method: "PUT" }));
    expect(res.status).toBe(401);
  });

  it("rejects the run half of the RCE chain without a token", async () => {
    const proxy = await loadProxy();
    const res = proxy(req("http://localhost:4242/api/scripts/run", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("rejects the plaintext .env read without a token", async () => {
    const proxy = await loadProxy();
    const res = proxy(req("http://localhost:4242/api/agent/files/env"));
    expect(res.status).toBe(401);
  });

  it("rejects an unauthenticated GET on a data route", async () => {
    const proxy = await loadProxy();
    expect(proxy(req("http://localhost:4242/api/status")).status).toBe(401);
  });

  it("accepts a correct bearer token", async () => {
    const proxy = await loadProxy();
    const res = proxy(
      req("http://localhost:4242/api/scripts/run", {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
    );
    expect(res.status).toBe(200); // NextResponse.next()
  });

  it("rejects a wrong bearer token", async () => {
    const proxy = await loadProxy();
    const res = proxy(
      req("http://localhost:4242/api/status", { headers: { authorization: "Bearer nope" } }),
    );
    expect(res.status).toBe(401);
  });

  it("accepts the session cookie for a same-origin write", async () => {
    const proxy = await loadProxy();
    const res = proxy(
      req("http://localhost:4242/api/missions", {
        method: "POST",
        cookie: TOKEN,
        headers: { "sec-fetch-site": "same-origin" },
      }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects a cross-site cookie write (CSRF)", async () => {
    const proxy = await loadProxy();
    const res = proxy(
      req("http://localhost:4242/api/scripts/run", {
        method: "POST",
        cookie: TOKEN,
        headers: { "sec-fetch-site": "cross-site" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("leaves /api/health public so the deploy runner can probe readiness", async () => {
    const proxy = await loadProxy();
    expect(proxy(req("http://localhost:4242/api/health")).status).toBe(200);
  });

  it("exchanges ?ps_token for a session cookie and strips it from the URL", async () => {
    const proxy = await loadProxy();
    const res = proxy(req(`http://localhost:4242/?${TOKEN_QUERY_PARAM}=${TOKEN}`));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).not.toContain(TOKEN_QUERY_PARAM);
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBe(TOKEN);
  });

  it("does not accept a wrong ?ps_token", async () => {
    const proxy = await loadProxy();
    expect(proxy(req(`http://localhost:4242/?${TOKEN_QUERY_PARAM}=wrong`)).status).toBe(401);
  });

  it("fails closed when no token is configured", async () => {
    delete process.env.PS_AUTH_TOKEN;
    process.env.PS_AUTH_TOKEN_FILE = "/nonexistent/patterstage-auth-token";
    const proxy = await loadProxy();
    expect(proxy(req("http://localhost:4242/api/status")).status).toBe(503);
  });

  it("read-only mode rejects writes by METHOD and still serves reads", async () => {
    process.env.PS_READ_ONLY = "1";
    const proxy = await loadProxy();
    const write = proxy(
      req("http://localhost:4242/api/missions", {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
    );
    expect(write.status).toBe(503);
    const read = proxy(
      req("http://localhost:4242/api/status", { headers: { authorization: `Bearer ${TOKEN}` } }),
    );
    expect(read.status).toBe(200);
  });

  it("PS_AUTH_MODE=none disables the check (documented opt-out)", async () => {
    process.env.PS_AUTH_MODE = "none";
    const proxy = await loadProxy();
    expect(proxy(req("http://localhost:4242/api/status")).status).toBe(200);
  });
});
