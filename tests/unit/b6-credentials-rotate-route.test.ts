/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform; same construction as credentials-repository.test.ts */
// ═══════════════════════════════════════════════════════════════
// B6 oracle, group credentials, the server half (T-0100, D14).
//
// Written before the product code moved. Holds contract section 5, D14, lines
// (1) through (9): PATCH /api/credentials/[id] rotates one key through the
// existing updateCredential, rewrites the Hermes .env variable when the
// provider has one, restores the old key when that write fails, never echoes
// a key, and the 405 on GET now names PATCH in Allow. The docs row and the
// column-zero declaration are pinned here too, because the gates that read
// them (b1-api-md, read-only-actually-reads, output-canary) only see a
// handler that is declared the way they scan for.
//
// The route runs against the credentials-api.test.ts mock set (closed
// repository, env sync stubbed) with REAL next/server, because that suite's
// NextResponse stub has no headers and the Allow line cannot be read off it.
// The round trip runs the same PATCH into the ACTUAL repository over a real
// in-memory database, the way credentials-repository.test.ts builds one.
//
// The jsdom half (panel and hook) is tests/unit/b6-credentials-rotate.test.tsx.
// ═══════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

import { execBaselineSchema } from "../helpers/baseline-db";

let testDb: import("better-sqlite3").Database | null = null;

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  let tick = 0;
  return {
    getDb: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    // Monotonic on purpose: a create and a rotate land in the same millisecond
    // and the contract says updatedAt moves.
    now: () => new Date(Date.UTC(2026, 0, 1) + tick++ * 1000).toISOString(),
    ensureDb: () => undefined,
  };
});

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.requireActual("@/lib/api-logger").serverErrorFromCatch,
}));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/api-auth", () => ({}));

jest.mock("@/modules/hermes/lib/hermes-env-sync", () => ({
  syncCredentialToHermesEnv: jest.fn(() => ({ backupPath: null })),
  removeCredentialFromHermesEnv: jest.fn(() => ({ backupPath: null })),
}));

jest.mock("@/lib/credentials-repository", () => {
  const listCredentials = jest.fn();
  const getCredential = jest.fn();
  const getCredentialWithKey = jest.fn();
  const createCredential = jest.fn();
  const updateCredential = jest.fn();
  const deleteCredential = jest.fn();
  return {
    listCredentials, getCredential, getCredentialWithKey,
    createCredential, updateCredential, deleteCredential,
    __listCredentials: listCredentials, __getCredential: getCredential,
    __getCredentialWithKey: getCredentialWithKey,
    __createCredential: createCredential, __updateCredential: updateCredential,
    __deleteCredential: deleteCredential,
  };
});

import * as route from "@/app/api/credentials/[id]/route";

const repo = require("@/lib/credentials-repository") as Record<string, jest.Mock>;
const audit = require("@/lib/audit-log") as { appendAuditLine: jest.Mock };
const env = require("@/modules/hermes/lib/hermes-env-sync") as {
  syncCredentialToHermesEnv: jest.Mock;
};

const ROOT = join(__dirname, "..", "..");

type Ctx = { params: Promise<{ id: string }> };
type Handler = (req: NextRequest, ctx: Ctx) => Promise<Response>;

/** The handler the contract adds, read off the namespace so the file compiles before it exists. */
function patchHandler(): Handler {
  const handler = (route as unknown as { PATCH?: Handler }).PATCH;
  if (typeof handler !== "function") {
    throw new Error("src/app/api/credentials/[id]/route.ts exports no PATCH (contract D14)");
  }
  return handler;
}

const ctx = (id: string): Ctx => ({ params: Promise.resolve({ id }) });

function patch(id: string, body: unknown): Promise<Response> {
  const req = new NextRequest(`http://localhost/api/credentials/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return patchHandler()(req, ctx(id));
}

async function bodyOf(res: Response) {
  return (await res.json()) as { error?: string; data?: Record<string, unknown> };
}

const SAMPLE = {
  id: "c_1",
  label: "Anthropic Personal",
  provider: "anthropic",
  keyHint: "sk-a...2345",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const WITH_KEY = { ...SAMPLE, apiKey: "sk-old-key-12345" };
const NEW_KEY = "sk-new-key-98765";

function realRepo() {
  return jest.requireActual("@/lib/credentials-repository") as typeof import("@/lib/credentials-repository");
}

beforeEach(() => {
  jest.clearAllMocks();
  const Database = loadRealBetterSqlite3();
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);

  repo.__getCredentialWithKey.mockImplementation((id: string) => (id === "c_1" ? { ...WITH_KEY } : null));
  repo.__updateCredential.mockImplementation((id: string) => (id === "c_1" ? { ...SAMPLE, keyHint: "sk-n...8765" } : null));
  env.syncCredentialToHermesEnv.mockReturnValue({ backupPath: null });
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("PATCH /api/credentials/[id] rotates the key", () => {
  it("(1) rewrites the row, the .env variable, and leaves a trace", async () => {
    const res = await patch("c_1", { apiKey: NEW_KEY });
    const body = await bodyOf(res);

    expect(res.status).toBe(200);
    expect(repo.__updateCredential).toHaveBeenCalledTimes(1);
    expect(repo.__updateCredential).toHaveBeenCalledWith("c_1", { apiKey: NEW_KEY });
    expect(env.syncCredentialToHermesEnv).toHaveBeenCalledTimes(1);
    expect(env.syncCredentialToHermesEnv).toHaveBeenCalledWith({ provider: "anthropic", apiKey: NEW_KEY });
    expect((body.data?.credential as { id?: string } | undefined)?.id).toBe("c_1");
    expect(body.data?.envVarUpdated).toBe(true);
    expect(audit.appendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "credential.rotate", resource: "c_1", ok: true }),
    );
  });

  it("(2) round trip: the real repository holds the new key, the new hint, the same label and provider, a later updatedAt", async () => {
    const real = realRepo();
    repo.__getCredentialWithKey.mockImplementation(real.getCredentialWithKey);
    repo.__updateCredential.mockImplementation(real.updateCredential);
    const created = real.createCredential({ label: "X", provider: "anthropic", apiKey: "sk-old-key-12345" });

    const res = await patch(created.id, { apiKey: NEW_KEY });

    expect(res.status).toBe(200);
    const after = real.getCredentialWithKey(created.id);
    expect(after?.apiKey).toBe(NEW_KEY);
    expect(after?.keyHint).toBe("sk-n...8765");
    expect(after?.label).toBe("X");
    expect(after?.provider).toBe("anthropic");
    expect(after!.updatedAt > created.updatedAt).toBe(true);
  });

  it("(3) the answer carries neither key, nor the words apiKey or api_key", async () => {
    const text = JSON.stringify(await bodyOf(await patch("c_1", { apiKey: NEW_KEY })));

    expect(text).not.toContain(NEW_KEY);
    expect(text).not.toContain("sk-old-key-12345");
    expect(text).not.toMatch(/apiKey|api_key/);
  });

  it("(4) an unknown id is a 404 and nothing is called", async () => {
    const res = await patch("nope", { apiKey: NEW_KEY });
    const body = await bodyOf(res);

    expect(res.status).toBe(404);
    expect(body.error).toBe("Credential not found");
    expect(repo.__updateCredential).not.toHaveBeenCalled();
    expect(env.syncCredentialToHermesEnv).not.toHaveBeenCalled();
    expect(audit.appendAuditLine).not.toHaveBeenCalled();
  });
});

describe("(5) the body is strict: one non-blank apiKey and nothing else", () => {
  it("refuses an empty key", async () => {
    const res = await patch("c_1", { apiKey: "" });

    expect(res.status).toBe(400);
    expect((await bodyOf(res)).error).toBe("Invalid request body");
    expect(repo.__updateCredential).not.toHaveBeenCalled();
  });

  it("refuses a whitespace-only key before touching the row or the .env file", async () => {
    // z.string().min(1) would pass "   ", updateCredential would then treat it
    // as do-not-rotate, and the env sync would write ANTHROPIC_API_KEY= followed
    // by spaces: a 200 that rotated nothing and blanked Hermes' copy.
    const res = await patch("c_1", { apiKey: "   " });

    expect(res.status).toBe(400);
    expect(repo.__updateCredential).not.toHaveBeenCalled();
    expect(env.syncCredentialToHermesEnv).not.toHaveBeenCalled();
  });

  it("refuses a provider in the body: rotation keeps the provider fixed", async () => {
    const res = await patch("c_1", { apiKey: "sk-x", provider: "openai" });

    expect(res.status).toBe(400);
    expect(repo.__updateCredential).not.toHaveBeenCalled();
  });

  it("refuses a label in the body for the same reason", async () => {
    const res = await patch("c_1", { apiKey: "sk-x", label: "new" });

    expect(res.status).toBe(400);
    expect(repo.__updateCredential).not.toHaveBeenCalled();
  });

  it("answers 400, not 500, to a body that is not JSON", async () => {
    const res = await patch("c_1", "{not json");

    expect(res.status).toBe(400);
    expect(String((await bodyOf(res)).error)).toMatch(/invalid json/i);
  });
});

describe("(6) a failed .env write puts the old key back", () => {
  it("answers 500 'Failed to rotate credential', restores the previous key, audits nothing", async () => {
    env.syncCredentialToHermesEnv.mockImplementation(() => {
      throw new Error(".env is not writable");
    });

    const res = await patch("c_1", { apiKey: NEW_KEY });
    const body = await bodyOf(res);

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to rotate credential");
    expect(repo.__updateCredential).toHaveBeenCalledTimes(2);
    expect(repo.__updateCredential).toHaveBeenNthCalledWith(1, "c_1", { apiKey: NEW_KEY });
    expect(repo.__updateCredential).toHaveBeenNthCalledWith(2, "c_1", { apiKey: "sk-old-key-12345" });
    expect(audit.appendAuditLine).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "credential.rotate" }),
    );
  });

  it("against the real repository the row ends on the old key", async () => {
    const real = realRepo();
    repo.__getCredentialWithKey.mockImplementation(real.getCredentialWithKey);
    repo.__updateCredential.mockImplementation(real.updateCredential);
    const created = real.createCredential({ label: "X", provider: "anthropic", apiKey: "sk-old-key-12345" });
    env.syncCredentialToHermesEnv.mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    const res = await patch(created.id, { apiKey: NEW_KEY });

    expect(res.status).toBe(500);
    expect(real.getCredentialWithKey(created.id)?.apiKey).toBe("sk-old-key-12345");
  });
});

describe("(7) a provider with no env var rotates the row only", () => {
  it("nous: 200, no env call, envVarUpdated false", async () => {
    repo.__getCredentialWithKey.mockImplementation((id: string) =>
      id === "c_1" ? { ...WITH_KEY, provider: "nous" } : null,
    );

    const res = await patch("c_1", { apiKey: NEW_KEY });
    const body = await bodyOf(res);

    expect(res.status).toBe(200);
    expect(repo.__updateCredential).toHaveBeenCalledWith("c_1", { apiKey: NEW_KEY });
    expect(env.syncCredentialToHermesEnv).not.toHaveBeenCalled();
    expect(body.data?.envVarUpdated).toBe(false);
  });

  it("a provider Hermes does not know (a hand-written row): the same", async () => {
    repo.__getCredentialWithKey.mockImplementation((id: string) =>
      id === "c_1" ? { ...WITH_KEY, provider: "legacy-unknown" } : null,
    );

    const res = await patch("c_1", { apiKey: NEW_KEY });
    const body = await bodyOf(res);

    expect(res.status).toBe(200);
    expect(env.syncCredentialToHermesEnv).not.toHaveBeenCalled();
    expect(body.data?.envVarUpdated).toBe(false);
  });
});

describe("(8) GET still says no, and now says what to use instead", () => {
  it("405 with Allow 'PATCH, DELETE' and the same body", async () => {
    const res = await route.GET();
    const body = await bodyOf(res);

    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("PATCH, DELETE");
    expect(body.error).toMatch(/^GET is not supported here .*\/api\/credentials lists credentials without their keys$/);
  });
});

describe("what the gates read", () => {
  it("(9) the docs/reference/api.md row for /api/credentials/[id] lists PATCH", () => {
    const apiMd = readFileSync(join(ROOT, "docs", "reference", "api.md"), "utf-8");
    const row = apiMd.match(/^\| `\/api\/credentials\/\[id\]` \|([^\n]*)/m);

    expect(row).not.toBeNull();
    expect(row![1]).toMatch(/`PATCH`/);
  });

  it("PATCH is declared at column zero and consults no auth or read-only flag", () => {
    // read-only-actually-reads, check-read-only-guards and output-canary all
    // attribute a handler by `^export async function VERB(`; the proxy refuses
    // PATCH under PS_READ_ONLY, so the handler itself must not.
    const src = readFileSync(join(ROOT, "src", "app", "api", "credentials", "[id]", "route.ts"), "utf-8");

    // Booleans, so a miss reports one line rather than the whole route source.
    const declaredAtColumnZero = /^export async function PATCH\(/m.test(src);
    const consultsAGuard = /requireAuth|requireNotReadOnly|isReadOnly/.test(src);
    expect({ declaredAtColumnZero, consultsAGuard }).toEqual({ declaredAtColumnZero: true, consultsAGuard: false });
  });
});
