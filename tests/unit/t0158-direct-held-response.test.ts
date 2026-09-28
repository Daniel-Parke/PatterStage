/** @jest-environment node */
/** ADR-0012: an unwrapped gateway GET must recheck revocation before release. */
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

const mockFetchGateway = jest.fn();
jest.mock("@/lib/models/gateway-client", () => ({
  ...jest.requireActual("@/lib/models/gateway-client"),
  fetchGateway: (...args: unknown[]) => mockFetchGateway(...args),
}));
jest.mock("better-sqlite3", () => jest.requireActual("../../node_modules/better-sqlite3/lib/index.js"));
jest.unmock("@/lib/db");

const origin = "http://127.0.0.1:3000";
const path = "/api/gateway/models";
const environmentKeys = ["PS_AUTH_TOKEN", "PS_AUTH_MODE", "PS_DATA_DIR", "CH_DATA_DIR", "HERMES_HOME", "PS_PUBLIC_ORIGIN", "HERMES_GATEWAY_URL", "NEXT_RUNTIME"] as const;
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]])) as Record<(typeof environmentKeys)[number], string | undefined>;
let dataDirectory: string;
let operatorToken: string;

function sessionCookie(response: Response): string {
  const match = /(?:^|[,;])\s*ps_session=([^;,\s]+)/i.exec(response.headers.get("set-cookie") ?? "");
  if (!match) throw new Error("Sign-in did not issue a browser session");
  return `ps_session=${match[1]}`;
}

async function signIn(): Promise<string> {
  const { POST } = await import("@/app/api/auth/sign-in/route");
  const response = await POST(new NextRequest(`${origin}/api/auth/sign-in`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ token: operatorToken }),
  }));
  expect(response.status).toBe(303);
  return sessionCookie(response);
}

function heldModels(headers: Record<string, string>, marker: string): {
  pending: Promise<Response>;
  called: Promise<void>;
  release: () => void;
} {
  let markCalled!: () => void;
  let release!: () => void;
  const called = new Promise<void>((resolve) => { markCalled = resolve; });
  const upstream = new Promise<Response>((resolve) => {
    release = () => resolve(new Response(JSON.stringify({ data: [{ id: marker }] }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
  });
  mockFetchGateway.mockImplementation(() => {
    markCalled();
    return upstream;
  });
  // The current export takes no arguments. Pass the request at runtime so a
  // future release-time guard has the real cookie or Bearer context to check.
  type RequestAwareGet = (request: NextRequest) => Promise<Response>;
  const pending = import("@/app/api/gateway/models/route").then(({ GET }) =>
    (GET as RequestAwareGet)(new NextRequest(`${origin}${path}`, { headers })));
  return { pending, called, release };
}

beforeEach(async () => {
  jest.resetModules();
  mockFetchGateway.mockReset();
  dataDirectory = mkdtempSync(join(tmpdir(), "t0158-direct-gateway-"));
  operatorToken = randomBytes(32).toString("hex");
  process.env.PS_AUTH_TOKEN = operatorToken;
  process.env.PS_AUTH_MODE = "token";
  process.env.PS_DATA_DIR = dataDirectory;
  process.env.CH_DATA_DIR = dataDirectory;
  process.env.HERMES_HOME = join(dataDirectory, "hermes-home");
  process.env.PS_PUBLIC_ORIGIN = origin;
  process.env.HERMES_GATEWAY_URL = "http://127.0.0.1:8652";
  process.env.NEXT_RUNTIME = "nodejs";
  const { initialiseBootState } = await import("@/lib/auth/boot-state");
  initialiseBootState();
  const { ensureDb } = await import("@/lib/db");
  ensureDb();
  expect(jest.isMockFunction(ensureDb)).toBe(false);
});

afterEach(() => {
  (jest.requireActual("@/lib/db") as typeof import("@/lib/db")).getDb().close();
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDirectory, { recursive: true, force: true });
});

describe("T-0158 direct held gateway models GET", () => {
  it("Given a valid browser cookie, a held model response reaches the caller", async () => {
    const cookie = await signIn();
    const marker = "t0158-valid-gateway-model-marker";
    const held = heldModels({ cookie }, marker);
    try {
      await held.called;
      held.release();
      const response = await held.pending;
      expect(response.status).toBe(200);
      expect(await response.text()).toContain(marker);
    } finally {
      held.release();
    }
  });

  it("Given a held model response, revoking its browser cookie prevents release", async () => {
    const cookie = await signIn();
    const marker = "t0158-revoked-gateway-model-marker";
    const held = heldModels({ cookie }, marker);
    try {
      await held.called;
      const { DELETE } = await import("@/app/api/auth/session/route");
      const revoked = await DELETE(new NextRequest(`${origin}/api/auth/session`, {
        method: "DELETE", headers: { origin, cookie },
      }));
      expect(revoked.status).toBe(200);
      const { getDb } = jest.requireActual<typeof import("@/lib/db")>("@/lib/db");
      const row = getDb().prepare("SELECT revoked_at_ms FROM auth_sessions").get() as { revoked_at_ms: number | null };
      expect(row.revoked_at_ms).not.toBeNull();

      held.release();
      const response = await held.pending;
      const body = await response.text();
      expect({ status: response.status, exposed: body.includes(marker) }).toEqual({ status: 401, exposed: false });
    } finally {
      held.release();
    }
  });

  it("Given a Bearer client, a held model response reaches the caller", async () => {
    const marker = "t0158-bearer-gateway-model-marker";
    const held = heldModels({ authorization: `Bearer ${operatorToken}` }, marker);
    try {
      await held.called;
      held.release();
      const response = await held.pending;
      expect(response.status).toBe(200);
      expect(await response.text()).toContain(marker);
    } finally {
      held.release();
    }
  });
});
