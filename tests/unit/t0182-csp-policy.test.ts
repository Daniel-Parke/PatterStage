/** @jest-environment node */
import { NextRequest } from "next/server";

const ORIGIN = "http://localhost:4242";
const TOKEN = "t0182-oracle-test-token";

function request(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, {
    headers: { host: "localhost:4242", ...headers },
  });
}

function directive(policy: string | null, name: string): string {
  expect(policy).toBeTruthy();
  const item = policy!.split(";").map((part) => part.trim()).find((part) => part.split(/\s+/)[0] === name);
  expect(item).toBeDefined();
  return item!;
}

function nonce(policy: string | null): string {
  const script = directive(policy, "script-src");
  const match = script.match(/'nonce-([A-Za-z0-9+/_=-]+)'/);
  expect(match).not.toBeNull();
  const value = match![1];
  expect(Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64")).toHaveLength(16);
  return value;
}

describe("T-0182 independent CSP request boundary", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.PS_AUTH_TOKEN = TOKEN;
    delete process.env.PS_AUTH_MODE;
    delete process.env.PS_READ_ONLY;
    delete process.env.CH_READ_ONLY;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  async function proxyResponse(path: string, headers: Record<string, string> = {}) {
    jest.resetModules();
    const { proxy } = await import("@/proxy");
    return proxy(request(path, headers));
  }

  it("Given two authenticated document requests, each response has a different 128-bit script nonce", async () => {
    const headers = { authorization: `Bearer ${TOKEN}` };
    const first = await proxyResponse("/work/missions", headers);
    const second = await proxyResponse("/work/missions", headers);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(nonce(first.headers.get("content-security-policy"))).not.toBe(
      nonce(second.headers.get("content-security-policy")),
    );
  });

  it("Given forged incoming nonce and CSP headers, the response issues an independent policy", async () => {
    const forged = "forged-client-nonce";
    const response = await proxyResponse("/work/missions", {
      authorization: `Bearer ${TOKEN}`,
      "x-nonce": forged,
      "content-security-policy": "script-src 'unsafe-inline' 'unsafe-eval'",
    });
    expect(response.status).toBe(200);
    const policy = response.headers.get("content-security-policy");
    expect(nonce(policy)).not.toBe(forged);
    expect(directive(policy, "script-src")).not.toContain("'unsafe-inline'");
    expect(directive(policy, "script-src")).not.toContain("'unsafe-eval'");
  });

  it("Given an authenticated page, the script and framing directives deny executable attributes and embedding", async () => {
    const response = await proxyResponse("/", { authorization: `Bearer ${TOKEN}` });
    const policy = response.headers.get("content-security-policy");
    const script = directive(policy, "script-src");
    expect(script).toContain("'self'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
    expect(directive(policy, "script-src-attr")).toContain("'none'");
    expect(directive(policy, "frame-ancestors")).toContain("'none'");
  });

  it("Given nonce-bearing HTML, the response cannot be stored for reuse", async () => {
    const response = await proxyResponse("/", { authorization: `Bearer ${TOKEN}` });
    nonce(response.headers.get("content-security-policy"));
    expect(response.headers.get("cache-control")).toMatch(/(?:^|,)\s*no-store(?:,|$)/i);
  });

  it("Given an unauthorised document request, the refusal keeps HTTP 401 and an enforced script policy", async () => {
    const response = await proxyResponse("/");
    expect(response.status).toBe(401);
    const policy = response.headers.get("content-security-policy");
    nonce(policy);
    expect(directive(policy, "frame-ancestors")).toContain("'none'");
    expect(directive(policy, "script-src-attr")).toContain("'none'");
  });

  it("Given an unauthorised API request, the refusal keeps HTTP 401 and the frame policy", async () => {
    const response = await proxyResponse("/api/status");
    expect(response.status).toBe(401);
    expect(directive(response.headers.get("content-security-policy"), "frame-ancestors")).toContain("'none'");
  });
});
