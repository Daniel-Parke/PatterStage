/** @jest-environment node */

import { NextRequest, type NextResponse } from "next/server";

const ORIGIN = "http://localhost:4242";
const ROOT_CREDENTIAL = "t0158-error-url-root-credential";
const URL_CREDENTIAL = "t0158-error-url-synthetic-credential";
const SESSION_COOKIE = "ps_session";

function request(url: string): NextRequest {
  return new NextRequest(url, { headers: { host: "localhost:4242" } });
}

function expectNoSessionCookie(response: NextResponse): void {
  // A deletion of an old cookie is permitted; an issued session is not.
  expect(response.cookies.get(SESSION_COOKIE)?.value ?? "").toBe("");
  expect(response.headers.get("set-cookie") ?? "").not.toContain(URL_CREDENTIAL);
}

async function loadBoundary() {
  jest.resetModules();
  const { proxy } = await import("@/proxy");
  return proxy;
}

describe("T-0158 token-bearing unavailable-page URL cleanup", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      PS_AUTH_MODE: "token",
      PS_AUTH_TOKEN: ROOT_CREDENTIAL,
      PS_PUBLIC_ORIGIN: ORIGIN,
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("redirects a direct token-bearing unavailable-page visit to a token-free final 503", async () => {
    const proxy = await loadBoundary();
    let url = new URL(`/auth/session-unavailable?ps_token=${URL_CREDENTIAL}`, ORIGIN);
    let response = proxy(request(url.href));
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);

    for (let redirects = 0; redirects < 3 && response.status >= 300 && response.status < 400; redirects++) {
      const location = response.headers.get("location");
      expect(location).toBeTruthy();
      expect(location).not.toContain("ps_token");
      expect(location).not.toContain(URL_CREDENTIAL);
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expectNoSessionCookie(response);
      url = new URL(location!, url);
      expect(url.searchParams.has("ps_token")).toBe(false);
      response = proxy(request(url.href));
    }

    expect(url.href).not.toContain(URL_CREDENTIAL);
    expect(response.status).toBe(503);
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expectNoSessionCookie(response);
    const body = await response.text();
    expect(body).toMatch(/session.*unavailable/i);
    expect(body).not.toContain(URL_CREDENTIAL);
  });

  it("serves a direct clean unavailable-page visit as a generic 503", async () => {
    const proxy = await loadBoundary();
    const response = proxy(request(`${ORIGIN}/auth/session-unavailable`));
    expect(response.status).toBe(503);
    expectNoSessionCookie(response);
    const body = await response.text();
    expect(body).toMatch(/session.*unavailable/i);
    expect(body).not.toContain(ROOT_CREDENTIAL);
  });

  it("finishes an ordinary invalid GET hand-off at a clean 401", async () => {
    const proxy = await loadBoundary();
    const redirect = proxy(request(`${ORIGIN}/?ps_token=${URL_CREDENTIAL}`));
    expect(redirect.status).toBeGreaterThanOrEqual(300);
    expect(redirect.status).toBeLessThan(400);
    const location = redirect.headers.get("location");
    expect(location).toBeTruthy();
    expect(location).not.toContain("ps_token");
    expect(location).not.toContain(URL_CREDENTIAL);
    expect(redirect.headers.get("referrer-policy")).toBe("no-referrer");
    expectNoSessionCookie(redirect);

    const finalUrl = new URL(location!, ORIGIN);
    expect(finalUrl.searchParams.has("ps_token")).toBe(false);
    const final = proxy(request(finalUrl.href));
    expect(final.status).toBe(401);
    expectNoSessionCookie(final);
  });
});
