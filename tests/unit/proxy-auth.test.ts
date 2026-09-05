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
import { rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

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

/**
 * The 401 is the first PatterStage screen a new operator sees when they open
 * the bare URL, so it is a product surface and not just a status code. It has
 * to name the real token location on THIS install: "PS_DATA_DIR/auth-token" is
 * a variable name, and someone who lost the boot line cannot expand it.
 */
describe("proxy — the 401 tells a locked-out operator what to do", () => {
  const savedEnv = { ...process.env };
  const tokenFile = join(tmpdir(), `ps-proxy-auth-${process.pid}-token`);

  beforeEach(() => {
    delete process.env.PS_AUTH_MODE;
    delete process.env.PS_READ_ONLY;
    delete process.env.CH_READ_ONLY;
    delete process.env.PS_AUTH_TOKEN;
    writeFileSync(tokenFile, TOKEN + "\n");
    process.env.PS_AUTH_TOKEN_FILE = tokenFile;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    rmSync(tokenFile, { force: true });
  });

  it("names the resolved token file on the HTML page, not the variable", async () => {
    const proxy = await loadProxy();
    const body = await proxy(req("http://localhost:4242/")).text();
    expect(body).toContain(tokenFile);
    expect(body).not.toContain("PS_DATA_DIR/auth-token");
  });

  it("shows both steps: read the file, then sign in with the query param", async () => {
    const proxy = await loadProxy();
    const body = await proxy(req("http://localhost:4242/")).text();
    expect(body).toContain(`cat ${tokenFile}`);
    expect(body).toContain(`?${TOKEN_QUERY_PARAM}=`);
    expect(body.toLowerCase()).toContain("restart");
  });

  it("never prints the token itself on the page that rejected it", async () => {
    const proxy = await loadProxy();
    const body = await proxy(req("http://localhost:4242/")).text();
    expect(body).not.toContain(TOKEN);
  });

  it("tells an API caller how to authenticate WITHOUT disclosing a filesystem path", async () => {
    // A script cannot act on a path hint, and this branch answers unauthenticated
    // callers from anywhere the server is reachable. It says how, not where.
    const proxy = await loadProxy();
    const res = proxy(req("http://localhost:4242/api/status"));
    expect(res.status).toBe(401);
    const payload = (await res.json()) as { error: string; tokenLocation?: string };
    expect(payload.error).toContain("Bearer");
    expect(payload.error).not.toContain(TOKEN);
    expect(payload.tokenLocation).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain(tokenFile);
  });

  /**
   * The resolved path is for the operator AT the machine. Under
   * `npm run start:network` the server binds 0.0.0.0, and an absolute
   * home-directory path hands a stranger the OS username and the install
   * layout. Loopback gets the path; everyone else gets the same instructions
   * without it.
   */
  it("does NOT name the resolved path to a caller arriving over the network", async () => {
    const proxy = await loadProxy();
    // req() defaults the Host header to localhost, so a remote caller has to be
    // stated explicitly: Host is the signal the proxy reads.
    const body = await proxy(
      req("http://192.168.1.50:4242/", { headers: { host: "192.168.1.50:4242" } }),
    ).text();
    expect(body).not.toContain(tokenFile);
    // Still useful: it must say what to look for and where the log line is.
    expect(body).toContain("auth-token");
    expect(body).toContain(`?${TOKEN_QUERY_PARAM}=`);
    expect(body).not.toContain(TOKEN);
  });

  it("still names the resolved path over loopback, including IPv6 and .localhost", async () => {
    const proxy = await loadProxy();
    for (const host of ["127.0.0.1:4242", "localhost:4242", "app.localhost:4242", "[::1]:4242"]) {
      const body = await proxy(req("http://localhost:4242/", { headers: { host } })).text();
      expect(body).toContain(tokenFile);
    }
  });

  it("points a container install at PS_AUTH_TOKEN, not a file it never reads", async () => {
    process.env.PS_AUTH_TOKEN = TOKEN;
    const proxy = await loadProxy();
    const body = await proxy(req("http://localhost:4242/")).text();
    expect(body).toContain("PS_AUTH_TOKEN");
    expect(body).not.toContain(tokenFile);
    expect(body).not.toContain(TOKEN);
  });
});
