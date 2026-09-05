/** @jest-environment node */
/**
 * B3 (T-0097), D109: nothing in the product told the operator how it was
 * configured; the boot line was terminal-only. GET /api/status/runtime is that
 * line as data, for the System page's "This install" card and its "Copy for a
 * bug report" button. No secrets: it says whether things are on, never what a
 * token is.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

jest.mock("@/lib/paths", () => ({
  PS_DATA_DIR: "/tmp/ps-data",
  getPsDataDir: () => "/tmp/ps-data",
  getDbPath: () => "/tmp/ps-data/patterstage.db",
  readEnv: (...keys: string[]) => {
    for (const k of keys) {
      const v = process.env[k];
      if (v && String(v).trim()) return String(v).trim();
    }
    return undefined;
  },
}));
jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesHome: () => "/tmp/hermes-home",
}));
const runGit = jest.fn((args: string[]) => (args.includes("--short") ? "abc1234" : "abc1234def"));
jest.mock("@/lib/update-handlers/shared", () => ({
  runGit: (args: string[]) => runGit(args),
}));
jest.mock("@/lib/db", () => ({
  getDb: () => ({ prepare: () => ({ get: () => ({ value: "38" }) }) }),
  ensureDb: jest.fn(),
}));

import { GET } from "@/app/api/status/runtime/route";

const ENV = ["PS_AUTH_MODE", "PS_ENABLE_DEPLOY_API", "PS_READ_ONLY", "PS_COMPOSER", "PORT", "HERMES_GATEWAY_URL"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  runGit.mockClear();
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

async function read() {
  const res = await GET();
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: Record<string, unknown> }).data;
}

describe("GET /api/status/runtime", () => {
  it("says how this install is configured, from the same readers the guards use", async () => {
    process.env.PS_ENABLE_DEPLOY_API = "true";
    process.env.PS_COMPOSER = "0";
    process.env.PORT = "3939";
    process.env.HERMES_GATEWAY_URL = "http://127.0.0.1:8747";
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as { version: string };

    const data = await read();
    expect(data).toMatchObject({
      authMode: "token",
      deployApiEnabled: true,
      readOnly: false,
      composerEnabled: false,
      dataDir: "/tmp/ps-data",
      dbPath: "/tmp/ps-data/patterstage.db",
      hermesHome: "/tmp/hermes-home",
      port: 3939,
      schemaVersion: 38,
      gitHash: "abc1234",
      appVersion: pkg.version,
      gatewayUrl: "http://127.0.0.1:8747",
      node: process.version,
      platform: process.platform,
    });
  });

  it("reflects auth none and read-only when set, and never carries a token", async () => {
    process.env.PS_AUTH_MODE = "none";
    process.env.PS_READ_ONLY = "1";
    const data = await read();
    expect(data.authMode).toBe("none");
    expect(data.readOnly).toBe(true);
    const keys = Object.keys(data).map((k) => k.toLowerCase());
    expect(keys.some((k) => k.includes("token") || k.includes("secret"))).toBe(false);
  });

  it("answers 'unknown' for the commit when git is not there, rather than failing the page", async () => {
    runGit.mockImplementation(() => {
      throw new Error("not a git repository");
    });
    const data = await read();
    expect(data.gitHash).toBe("unknown");
  });

  it("the gateway defaults to the address the runtime uses when the variable is unset", async () => {
    const data = await read();
    expect(typeof data.gatewayUrl).toBe("string");
    expect((data.gatewayUrl as string).length).toBeGreaterThan(0);
  });
});
