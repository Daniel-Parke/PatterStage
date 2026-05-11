/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

jest.mock("next/server", () => ({
  NextRequest: class NextRequest {
    url: string;
    method: string;
    headers: Headers;
    nextUrl: URL;
    bodyUsed: boolean = false;
    private _body: string;
    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this.method = init?.method ?? "GET";
      this.headers = new Headers(init?.headers as HeadersInit);
      this._body = typeof init?.body === "string" ? init.body : JSON.stringify(init?.body ?? {});
      this.nextUrl = new URL(url);
    }
    async json() { return JSON.parse(this._body); }
  },
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => {
      const status = init?.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(data),
      };
    },
  },
}));

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));

jest.mock("@/lib/api-auth", () => ({
  requireMcApiKey: jest.fn(() => null),
  requireNotReadOnly: jest.fn(() => null),
}));

jest.mock("@/lib/hermes-config-sync", () => ({
  syncDefaultsToHermesConfig: jest.fn(() => ({ backupPath: null })),
  syncCredentialToHermesEnv: jest.fn(() => ({ backupPath: null })),
  removeCredentialFromHermesEnv: jest.fn(() => ({ backupPath: null })),
}));

jest.mock("@/lib/models-repository", () => {
  const listModels = jest.fn();
  const getModel = jest.fn();
  const createModel = jest.fn();
  const updateModel = jest.fn();
  const deleteModel = jest.fn();
  const getModelDefaults = jest.fn();
  const setDefaultModel = jest.fn();
  return {
    listModels, getModel, createModel, updateModel, deleteModel,
    getModelDefaults, setDefaultModel,
    __listModels: listModels, __getModel: getModel, __createModel: createModel,
    __updateModel: updateModel, __deleteModel: deleteModel,
    __getModelDefaults: getModelDefaults, __setDefaultModel: setDefaultModel,
  };
});

jest.mock("@/lib/framework-registry", () => ({
  getActiveFrameworkId: jest.fn(() => "hermes"),
  listFrameworks: jest.fn(() => []),
  FRAMEWORKS: [],
}));

// Mock the sync-manager for any push/pull imports
jest.mock("@/lib/sync-manager", () => ({
  pushModelToHermes: jest.fn(() => ({ success: true, backupPath: null, details: [] })),
  pushCredential: jest.fn(() => ({ success: true, backupPath: null, details: [] })),
  pushCredentialToHermesEnv: jest.fn(() => ({ success: true, backupPath: null, details: [] })),
  pullCredentialFromEnv: jest.fn(() => ({ success: false, backupPath: null, details: [] })),
  detectConfigDrift: jest.fn(() => ({ modelsInHermesNotInDb: [], modelsInDbNotInHermes: [], primaryDiffers: null })),
}));

// Mock hermes-config-sync for sync functions used in routes
jest.mock("@/lib/hermes-config-sync", () => ({
  syncDefaultsToHermesConfig: jest.fn(() => ({ backupPath: null })),
  syncCredentialToHermesEnv: jest.fn(() => ({ backupPath: null })),
  removeCredentialFromHermesEnv: jest.fn(() => ({ backupPath: null })),
  syncSingleCredentialToHermesEnv: jest.fn(() => ({ backupPath: null })),
  syncSingleModelToHermesConfig: jest.fn(() => ({ backupPath: null })),
  syncFallbacksToHermesConfig: jest.fn(() => ({ backupPath: null })),
}));

const repo = require("@/lib/models-repository") as Record<string, jest.Mock>;
const auth = require("@/lib/api-auth") as Record<string, jest.Mock>;
const audit = require("@/lib/audit-log") as { appendAuditLine: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  auth.requireMcApiKey.mockReturnValue(null);
  auth.requireNotReadOnly.mockReturnValue(null);
});

const SAMPLE_MODEL = {
  id: "m_123",
  name: "Sonnet",
  provider: "anthropic",
  modelId: "anthropic/claude-sonnet-4",
  frameworkId: "*",
  baseUrl: null,
  contextLength: 200000,
  credentialsId: null,
  defaults: {
    agent: null,
    hindsight: null,
    compression: null,
    vision: null,
    web_extract: null,
    session_search: null,
    title_generation: null,
    skills_hub: null,
    mcp: null,
    triage_specifier: null,
    approval: null,
    delegation: null,
  },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function makeRequest(url: string, method?: string, body?: unknown) {
  return new (jest.requireMock("next/server").NextRequest as new (url: string, init?: RequestInit) => unknown)(
    url,
    {
      method: method ?? "GET",
      headers: body ? new Headers({ "content-type": "application/json" }) : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }
  );
}

async function getModels(): Promise<{ status: number; body: Record<string, unknown> }> {
  const route = require("@/app/api/models/route") as { GET: (req: unknown) => Promise<unknown> };
  const res = (await route.GET(makeRequest("http://localhost/api/models"))) as { status: number; json: () => Promise<unknown> };
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function postModels(body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const route = require("@/app/api/models/route") as { POST: (req: unknown) => Promise<unknown> };
  const req = makeRequest("http://localhost/api/models", "POST", body);
  const res = (await route.POST(req)) as { status: number; json: () => Promise<unknown> };
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("/api/models", () => {
  it("GET returns list", async () => {
    repo.__listModels.mockReturnValue([SAMPLE_MODEL]);
    const res = await getModels();
    expect(res.status).toBe(200);
    expect((res.body.data as { models: unknown[] }).models).toHaveLength(1);
  });

  it("GET response never includes apiKey on any model", async () => {
    repo.__listModels.mockReturnValue([SAMPLE_MODEL]);
    const res = await getModels();
    const json = JSON.stringify(res.body);
    expect(json).not.toMatch(/"apiKey"/);
  });

  it("POST creates a model and returns 201", async () => {
    repo.__createModel.mockReturnValue(SAMPLE_MODEL);
    const res = await postModels({
      name: "Sonnet",
      provider: "anthropic",
      modelId: "anthropic/claude-sonnet-4",
      contextLength: 200000,
    });
    expect(res.status).toBe(201);
    expect((res.body.data as { model: { id: string } }).model.id).toBe(SAMPLE_MODEL.id);
    expect(audit.appendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "model.create", resource: SAMPLE_MODEL.id, ok: true })
    );
  });

  it("POST rejects unknown provider", async () => {
    const res = await postModels({
      name: "x",
      provider: "not-a-provider",
      modelId: "x",
    });
    expect(res.status).toBe(400);
    expect(repo.__createModel).not.toHaveBeenCalled();
  });

  it("POST rejects missing required fields", async () => {
    const res = await postModels({ name: "x" });
    expect(res.status).toBe(400);
  });

  it("POST is gated by readonly mode", async () => {
    auth.requireNotReadOnly.mockReturnValue({ status: 503, json: async () => ({}) });
    const res = await postModels({
      name: "x",
      provider: "anthropic",
      modelId: "x",
    });
    expect(res.status).toBe(503);
    expect(repo.__createModel).not.toHaveBeenCalled();
  });

  it("POST is gated by api-key auth", async () => {
    auth.requireMcApiKey.mockReturnValue({ status: 401, json: async () => ({}) });
    const res = await postModels({
      name: "x",
      provider: "anthropic",
      modelId: "x",
    });
    expect(res.status).toBe(401);
    expect(repo.__createModel).not.toHaveBeenCalled();
  });
});

describe("/api/models/[id]", () => {
  function callRoute(
    method: "GET" | "PUT" | "DELETE",
    id: string,
    body?: unknown
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const route = require("@/app/api/models/[id]/route") as Record<
      string,
      (req: unknown, ctx: { params: Promise<{ id: string }> }) => Promise<{
        status: number;
        json: () => Promise<unknown>;
      }>
    >;
    const fn = route[method];
    const req = makeRequest(`http://localhost/api/models/${id}`, method, body);
    return fn(req, { params: Promise.resolve({ id }) }).then(async (r) => ({
      status: r.status,
      body: (await r.json()) as Record<string, unknown>,
    }));
  }

  it("GET 404 when missing", async () => {
    repo.__getModel.mockReturnValue(null);
    const res = await callRoute("GET", "no-such-id");
    expect(res.status).toBe(404);
  });

  it("GET returns model", async () => {
    repo.__getModel.mockReturnValue(SAMPLE_MODEL);
    const res = await callRoute("GET", SAMPLE_MODEL.id);
    expect(res.status).toBe(200);
    expect((res.body.data as { model: unknown }).model).toEqual(SAMPLE_MODEL);
  });

  it("PUT updates and audits", async () => {
    repo.__updateModel.mockReturnValue(SAMPLE_MODEL);
    const res = await callRoute("PUT", SAMPLE_MODEL.id, { name: "Renamed" });
    expect(res.status).toBe(200);
    expect(audit.appendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "model.update", resource: SAMPLE_MODEL.id })
    );
  });

  it("PUT 404 when model missing", async () => {
    repo.__updateModel.mockReturnValue(null);
    const res = await callRoute("PUT", "no-such", { name: "X" });
    expect(res.status).toBe(404);
  });

  it("DELETE returns 200 and audits", async () => {
    repo.__deleteModel.mockReturnValue(true);
    const res = await callRoute("DELETE", SAMPLE_MODEL.id);
    expect(res.status).toBe(200);
    expect(audit.appendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "model.delete" })
    );
  });

  it("DELETE 404 when model missing", async () => {
    repo.__deleteModel.mockReturnValue(false);
    const res = await callRoute("DELETE", "no-such");
    expect(res.status).toBe(404);
  });
});

describe("/api/models/defaults", () => {
  function getDefaults() {
    const route = require("@/app/api/models/defaults/route") as { GET: (req: unknown) => Promise<unknown> };
    return (route.GET(makeRequest("http://localhost/api/models/defaults")) as Promise<{ status: number; json: () => Promise<unknown> }>).then(
      async (r) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> })
    );
  }
  function putDefaults(body: unknown) {
    const route = require("@/app/api/models/defaults/route") as {
      PUT: (req: unknown) => Promise<unknown>;
    };
    const req = makeRequest("http://localhost/api/models/defaults", "PUT", body);
    return (route.PUT(req) as Promise<{ status: number; json: () => Promise<unknown> }>).then(
      async (r) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> })
    );
  }

  it("GET returns the defaults object", async () => {
    repo.__getModelDefaults.mockReturnValue({ agent: "m_1", hindsight: null });
    const res = await getDefaults();
    expect(res.status).toBe(200);
    expect((res.body.data as { defaults: Record<string, unknown> }).defaults.agent).toBe("m_1");
  });

  it("PUT sets a default and audits", async () => {
    repo.__setDefaultModel.mockReturnValue({ agent: "m_1" });
    const res = await putDefaults({ taskType: "agent", modelId: "m_1" });
    expect(res.status).toBe(200);
    expect(repo.__setDefaultModel).toHaveBeenCalledWith("agent", "m_1", "*");
    expect(audit.appendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "model.default.set" })
    );
  });

  it("PUT can clear a default with modelId=null", async () => {
    repo.__setDefaultModel.mockReturnValue({ agent: null });
    const res = await putDefaults({ taskType: "agent", modelId: null });
    expect(res.status).toBe(200);
    expect(repo.__setDefaultModel).toHaveBeenCalledWith("agent", null, "*");
  });

  it("PUT rejects unknown task type", async () => {
    const res = await putDefaults({ taskType: "no-such-slot", modelId: null });
    expect(res.status).toBe(400);
  });

  it("PUT 404 when model missing", async () => {
    repo.__setDefaultModel.mockImplementation(() => {
      throw new Error("Model not found: nope");
    });
    const res = await putDefaults({ taskType: "agent", modelId: "nope" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/config/model — file removed", () => {
  it("the legacy route file no longer exists", () => {
    const fs = jest.requireActual("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const target = path.join(__dirname, "..", "..", "src", "app", "api", "config", "model", "route.ts");
    expect(fs.existsSync(target)).toBe(false);
  });
});
