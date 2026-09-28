import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

export const origin = "http://127.0.0.1:3000";

const environmentKeys = [
  "PS_AUTH_TOKEN", "PS_AUTH_MODE", "PS_DATA_DIR", "CH_DATA_DIR",
  "HERMES_HOME", "PS_PUBLIC_ORIGIN", "HERMES_GATEWAY_URL", "NEXT_RUNTIME",
] as const;

export interface HeldSession {
  operatorToken: string;
  signIn: () => Promise<string>;
  dispose: () => void;
}

export interface HeldResponse {
  pending: Promise<Response>;
  called: Promise<void>;
  release: () => void;
}

/** Install only the upstream gateway double; route and session modules remain real. */
export function installHeldGatewayMock(): jest.Mock {
  const mockFetchGateway = jest.fn();
  jest.doMock("@/lib/models/gateway-client", () => ({
    ...jest.requireActual("@/lib/models/gateway-client"),
    fetchGateway: (...args: unknown[]) => mockFetchGateway(...args),
  }));
  return mockFetchGateway;
}

/** Hold the route-specific upstream response until the test releases it. */
export function createHeldUpstream(makeResponse: () => Response) {
  let markCalled!: () => void;
  let release!: () => void;
  const called = new Promise<void>((resolve) => { markCalled = resolve; });
  const upstream = new Promise<Response>((resolve) => {
    release = () => resolve(makeResponse());
  });
  return { called, markCalled, upstream, release };
}

/** Call the real gateway models route while its mocked upstream response waits. */
export function heldGatewayModels(
  fetchGateway: jest.Mock,
  headers: Record<string, string>,
  marker: string,
): HeldResponse {
  const gate = createHeldUpstream(() => new Response(JSON.stringify({ data: [{ id: marker }] }), {
    status: 200, headers: { "content-type": "application/json" },
  }));
  fetchGateway.mockImplementation(() => {
    gate.markCalled();
    return gate.upstream;
  });
  // Pass the request even while GET's declared signature takes no arguments.
  type RequestAwareGet = (request: NextRequest) => Promise<Response>;
  const pending = import("@/app/api/gateway/models/route").then(({ GET }) =>
    (GET as RequestAwareGet)(new NextRequest(`${origin}/api/gateway/models`, { headers })));
  return { pending, called: gate.called, release: gate.release };
}

export async function finishHeldResponse(
  held: HeldResponse,
  beforeRelease?: () => Promise<void>,
): Promise<Response> {
  try {
    await held.called;
    if (beforeRelease) await beforeRelease();
    held.release();
    return await held.pending;
  } finally {
    held.release();
  }
}

/** Prove revocation reached the real SQLite row before releasing the response. */
export async function revokeAndAssertStoredSession(cookie: string): Promise<void> {
  const { DELETE } = await import("@/app/api/auth/session/route");
  const revoked = await DELETE(new NextRequest(`${origin}/api/auth/session`, {
    method: "DELETE", headers: { origin, cookie },
  }));
  expect(revoked.status).toBe(200);
  const { getDb } = jest.requireActual<typeof import("@/lib/db")>("@/lib/db");
  const row = getDb().prepare("SELECT revoked_at_ms FROM auth_sessions").get() as { revoked_at_ms: number | null };
  expect(row.revoked_at_ms).not.toBeNull();
}

function sessionCookie(response: Response): string {
  const match = /(?:^|[,;])\s*ps_session=([^;,\s]+)/i.exec(response.headers.get("set-cookie") ?? "");
  if (!match) throw new Error("Sign-in did not issue a browser session");
  return `ps_session=${match[1]}`;
}

/** A real, temporary SQLite session store for held-response route tests. */
export async function createHeldSession(prefix: string, gatewayUrl?: string): Promise<HeldSession> {
  const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]])) as Record<(typeof environmentKeys)[number], string | undefined>;
  const dataDirectory = mkdtempSync(join(tmpdir(), prefix));
  const operatorToken = randomBytes(32).toString("hex");
  process.env.PS_AUTH_TOKEN = operatorToken;
  process.env.PS_AUTH_MODE = "token";
  process.env.PS_DATA_DIR = dataDirectory;
  process.env.CH_DATA_DIR = dataDirectory;
  process.env.HERMES_HOME = join(dataDirectory, "hermes-home");
  process.env.PS_PUBLIC_ORIGIN = origin;
  if (gatewayUrl !== undefined) process.env.HERMES_GATEWAY_URL = gatewayUrl;
  process.env.NEXT_RUNTIME = "nodejs";
  const { initialiseBootState } = await import("@/lib/auth/boot-state");
  initialiseBootState();
  const { ensureDb } = await import("@/lib/db");
  ensureDb();
  expect(jest.isMockFunction(ensureDb)).toBe(false);

  return {
    operatorToken,
    async signIn() {
      const { POST } = await import("@/app/api/auth/sign-in/route");
      const response = await POST(new NextRequest(`${origin}/api/auth/sign-in`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ token: operatorToken }),
      }));
      expect(response.status).toBe(303);
      return sessionCookie(response);
    },
    dispose() {
      (jest.requireActual("@/lib/db") as typeof import("@/lib/db")).getDb().close();
      for (const key of environmentKeys) {
        const value = originalEnvironment[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
}
