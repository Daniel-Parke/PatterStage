/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

jest.mock("next/server", () => ({
  // NextRequest must be a real class (not a plain object literal) so the
  // `parseJsonBody` caller can use `instanceof` on NextResponse — see
  // session 37 control-hub-list1-session37-findings for the failure mode.
  NextRequest: class NextRequest {
    url: string;
    method: string;
    headers: Headers;
    bodyUsed: boolean = false;
    private _body: string;
    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this.method = init?.method ?? "GET";
      this.headers = new Headers(init?.headers as HeadersInit);
      this._body = typeof init?.body === "string" ? init.body : JSON.stringify(init?.body ?? {});
    }
    async json() { return JSON.parse(this._body); }
  },
  // NextResponse is a class (not an object literal) so `instanceof` works
  // in the `parseJsonBody` call site. Static `json()` factory keeps the
  // existing call sites' usage (`NextResponse.json(data, init)`) intact.
  NextResponse: class NextResponse {
    status: number;
    private _data: unknown;
    static json(data: unknown, init?: ResponseInit): NextResponse {
      const status = init?.status ?? 200;
      const r = new NextResponse();
      r.status = status;
      r._data = data;
      return r;
    }
    async json() { return this._data; }
  },
}));

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));

jest.mock("@/lib/api-auth", () => ({
  requireAuth: jest.fn(() => null),
}));

jest.mock("@/lib/hermes-config-sync", () => ({
  syncDefaultsToHermesConfig: jest.fn(() => ({ backupPath: null })),
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

const repo = require("@/lib/credentials-repository") as Record<string, jest.Mock>;
const auth = require("@/lib/api-auth") as Record<string, jest.Mock>;
const audit = require("@/lib/audit-log") as { appendAuditLine: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  auth.requireAuth.mockReturnValue(null);
});

const SAMPLE = {
  id: "c_1",
  label: "Anthropic Personal",
  provider: "anthropic",
  keyHint: "sk-a...wxyz",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("/api/credentials", () => {
  function postCreds(body: unknown) {
    const route = require("@/app/api/credentials/route") as {
      POST: (req: Request) => Promise<unknown>;
    };
    const req = {
      url: "http://localhost/api/credentials",
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => body,
    } as unknown as Request;
    return (route.POST(req) as Promise<{ status: number; json: () => Promise<unknown> }>).then(
      async (r) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> })
    );
  }

  it("GET lists credentials without exposing apiKey", async () => {
    repo.__listCredentials.mockReturnValue([SAMPLE]);
    const route = require("@/app/api/credentials/route") as { GET: () => Promise<unknown> };
    const res = await (route.GET() as Promise<{ status: number; json: () => Promise<unknown> }>);
    const body = (await res.json()) as Record<string, unknown>;
    expect(res.status).toBe(200);
    expect(JSON.stringify(body)).not.toMatch(/"apiKey"/);
    expect(JSON.stringify(body)).not.toMatch(/"api_key"/);
  });

  it("POST 201 + audits", async () => {
    repo.__createCredential.mockReturnValue(SAMPLE);
    const res = await postCreds({
      label: "Anthropic Personal",
      provider: "anthropic",
      apiKey: "sk-realsecret",
    });
    expect(res.status).toBe(201);
    expect(audit.appendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "credential.create", resource: SAMPLE.id })
    );
  });

  it("POST rejects unknown provider", async () => {
    const res = await postCreds({ label: "x", provider: "weird", apiKey: "y" });
    expect(res.status).toBe(400);
    expect(repo.__createCredential).not.toHaveBeenCalled();
  });

  it("POST rejects empty apiKey", async () => {
    const res = await postCreds({ label: "x", provider: "anthropic", apiKey: "" });
    expect(res.status).toBe(400);
  });

  it("POST is gated by readonly", async () => {
    auth.requireAuth.mockReturnValue({ status: 503, json: async () => ({}) });
    const res = await postCreds({ label: "x", provider: "anthropic", apiKey: "y" });
    expect(res.status).toBe(503);
  });

  it("POST is gated by api-key auth", async () => {
    auth.requireAuth.mockReturnValue({ status: 401, json: async () => ({}) });
    const res = await postCreds({ label: "x", provider: "anthropic", apiKey: "y" });
    expect(res.status).toBe(401);
  });

  it("POST returns 400 on malformed JSON", async () => {
    // Regression for the request.json() bug class: malformed JSON previously
    // returned 500 via the outer try/catch. parseJsonBody now returns 400.
    const route = require("@/app/api/credentials/route") as { POST: (req: Request) => Promise<unknown> };
    const req = {
      url: "http://localhost/api/credentials",
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => { throw new SyntaxError("Unexpected token"); },
    } as unknown as Request;
    const res = await (route.POST(req) as Promise<{ status: number; json: () => Promise<unknown> }>);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(String(body.error)).toMatch(/invalid json/i);
  });
});
