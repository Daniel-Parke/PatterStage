/** @jest-environment node */
/**
 * B1 (T-0095), D42 and D123: host-affecting writes under PS_AUTH_MODE=none.
 *
 * `requireAuthenticatedHostWrites()` exists because a script written through
 * the API is executed later by cron and by POST /api/scripts/run, so with the
 * token switched off those endpoints are unauthenticated remote code execution.
 * The guard was applied to PUT and DELETE /api/scripts/[name] and to the cron
 * routes, and forgotten on the two endpoints that EXECUTE: POST /api/scripts/run
 * runs a script on the host, POST /api/update runs the deploy script. Both were
 * open under auth mode none.
 *
 * Two layers, on purpose. The proxy is the boundary that cannot be forgotten, so
 * it now lists the host-side-effect paths and refuses their unsafe methods when
 * authentication is off; the two routes carry the same guard themselves, the way
 * their siblings already do, so a proxy bypass in a test harness is still not a
 * hole.
 */
import { NextRequest } from "next/server";

const TOKEN = "test-token-abcdefghijklmnop";

const mockRunScriptFile = jest.fn();
jest.mock("@/lib/scripts-manager", () => ({
  runScriptFile: (...a: unknown[]) => mockRunScriptFile(...a),
}));

const mockRestart = jest.fn();
const mockRebuild = jest.fn();
const mockUpdate = jest.fn();
jest.mock("@/lib/update-handlers/deploy-actions", () => ({
  handleRestartAction: (...a: unknown[]) => mockRestart(...a),
  handleRebuildAction: (...a: unknown[]) => mockRebuild(...a),
  handleUpdateAction: (...a: unknown[]) => mockUpdate(...a),
}));
jest.mock("@/lib/update-handlers/remote-branches", () => ({ listRemoteBranches: () => [] }));
jest.mock("@/lib/update-handlers/shared", () => ({ UPDATE_BRANCH: "dev" }));
jest.mock("@/lib/update-handlers/version-check", () => ({ checkVersion: () => ({}) }));
jest.mock("@/lib/deploy-status", () => ({
  isDeployInProgress: () => false,
  readDeployStatus: () => ({ state: "idle" }),
  tailLogHint: () => [],
}));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn(), serverErrorFromCatch: jest.fn() }));
// The real module: the guard under test lives in it. Only the two gates that
// are not this test's subject are stubbed open.
jest.mock("@/lib/api-auth", () => ({
  ...jest.requireActual("@/lib/api-auth"),
  requireSignedRequest: () => null,
  requireDeployApiEnabled: () => null,
}));

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

const savedEnv = { ...process.env };
beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.PS_READ_ONLY;
  delete process.env.CH_READ_ONLY;
  delete process.env.PS_AUTH_TOKEN;
});
afterEach(() => {
  process.env = { ...savedEnv };
});

describe("the proxy: with PS_AUTH_MODE=none, a host-affecting write is refused", () => {
  beforeEach(() => {
    process.env.PS_AUTH_MODE = "none";
  });

  const HOST_WRITES: Array<[string, string]> = [
    ["POST", "/api/scripts/run"],
    ["PUT", "/api/scripts/pwn.sh"],
    ["DELETE", "/api/scripts/pwn.sh"],
    ["POST", "/api/update"],
    ["POST", "/api/cron/hardware"],
    ["PUT", "/api/cron/hardware"],
    ["DELETE", "/api/cron/hardware"],
  ];

  it.each(HOST_WRITES)("%s %s is 403, and the body names the mode", async (method, path) => {
    const proxy = await loadProxy();
    const res = proxy(req(`http://localhost:4242${path}`, { method }));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/PS_AUTH_MODE/);
  });

  it("still serves the reads beside them", async () => {
    const proxy = await loadProxy();
    expect(proxy(req("http://localhost:4242/api/scripts")).status).toBe(200);
    expect(proxy(req("http://localhost:4242/api/scripts/logs?name=a")).status).toBe(200);
    expect(proxy(req("http://localhost:4242/api/update")).status).toBe(200);
    expect(proxy(req("http://localhost:4242/api/cron/hardware")).status).toBe(200);
  });

  it("still lets an ordinary write through: auth mode none is not read-only", async () => {
    const proxy = await loadProxy();
    expect(proxy(req("http://localhost:4242/api/missions", { method: "POST" })).status).toBe(200);
  });

  it("read-only still wins over the host-write refusal, as it does everywhere", async () => {
    process.env.PS_READ_ONLY = "1";
    const proxy = await loadProxy();
    expect(proxy(req("http://localhost:4242/api/scripts/run", { method: "POST" })).status).toBe(503);
  });
});

describe("GREEN CONTROL: with the token on, the same writes reach their handlers", () => {
  it("POST /api/scripts/run passes the proxy with a bearer token", async () => {
    delete process.env.PS_AUTH_MODE;
    process.env.PS_AUTH_TOKEN = TOKEN;
    const proxy = await loadProxy();
    const res = proxy(
      req("http://localhost:4242/api/scripts/run", {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe("the two routes carry the guard themselves", () => {
  it("POST /api/scripts/run answers 403 under PS_AUTH_MODE=none and never runs the script", async () => {
    process.env.PS_AUTH_MODE = "none";
    const { POST } = await import("@/app/api/scripts/run/route");
    const res = await POST(
      new NextRequest("http://localhost/api/scripts/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "pwn.sh" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(mockRunScriptFile).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: POST /api/scripts/run runs the script with the token on", async () => {
    delete process.env.PS_AUTH_MODE;
    mockRunScriptFile.mockResolvedValue({ ok: true, exitCode: 0 });
    const { POST } = await import("@/app/api/scripts/run/route");
    const res = await POST(
      new NextRequest("http://localhost/api/scripts/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "fine.sh" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(mockRunScriptFile).toHaveBeenCalledWith("fine.sh");
  });

  it("POST /api/update answers 403 under PS_AUTH_MODE=none even with the deploy API on", async () => {
    process.env.PS_AUTH_MODE = "none";
    process.env.PS_ENABLE_DEPLOY_API = "true";
    const { POST } = await import("@/app/api/update/route");
    const res = await POST(
      new NextRequest("http://localhost/api/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "restart" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(mockRestart).not.toHaveBeenCalled();
    expect(mockRebuild).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
