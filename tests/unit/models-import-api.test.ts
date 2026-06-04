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
    async json() {
      return JSON.parse(this._body);
    }
  },
  NextResponse: class NextResponse {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      this.status = status;
      this.body = body;
    }
    async json() { return this.body; }
    static json(data: unknown, init?: ResponseInit) {
      return new NextResponse(init?.status ?? 200, data);
    }
  },
}));

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/api-auth", () => ({ requireAuth: jest.fn(() => null) }));
jest.mock("@/lib/parse-json-body", () => {
  const actual = jest.requireActual("@/lib/parse-json-body");
  return {
    parseJsonBody: jest.fn(async (req: { json: () => Promise<unknown> }) => req.json()),
    parseAndValidateJsonBody: actual.parseAndValidateJsonBody,
  };
});

// Capture the order and arguments of the calls so the test can assert
// the credential-link pass uses the upserted ids (not a fresh DB read).
const mockUpsertModel = jest.fn();
const mockUpsertCredential = jest.fn();
const mockListModels = jest.fn();
const mockUpdateModel = jest.fn();

jest.mock("@/lib/models-repository", () => ({
  upsertModel: (...args: unknown[]) => mockUpsertModel(...args),
  listModels: (...args: unknown[]) => mockListModels(...args),
  updateModel: (...args: unknown[]) => mockUpdateModel(...args),
}));

jest.mock("@/lib/credentials-repository", () => ({
  upsertCredential: (...args: unknown[]) => mockUpsertCredential(...args),
}));

// Force the parsed Hermes config to a known shape — the route reads from
// this module, and we want deterministic input across the four tests.
const mockParsedConfig = {
  models: [] as Array<{
    name: string;
    provider: string;
    modelId: string;
    baseUrl: string | null;
    contextLength: number | null;
    defaultSlots: string[];
  }>,
  credentials: [] as Array<{ provider: string; apiKey: string }>,
  details: [] as string[],
};
jest.mock("@/lib/hermes-import", () => ({
  parseHermesConfig: () => mockParsedConfig,
}));

const audit = require("@/lib/audit-log") as { appendAuditLine: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  mockParsedConfig.models = [];
  mockParsedConfig.credentials = [];
  mockParsedConfig.details = [];
  // Default: every upsert is a fresh insert returning "m_<n>".
  let idSeq = 0;
  mockUpsertModel.mockImplementation(() => ({
    id: `m_${++idSeq}`,
    action: idSeq === 1 ? "inserted" : "updated",
  }));
  mockUpsertCredential.mockImplementation((c: { provider: string }) => ({
    id: `c_${c.provider}`,
  }));
  mockListModels.mockReturnValue([]); // by default, no existing rows
  mockUpdateModel.mockReturnValue({ id: "ignored" });
});

async function postImport(): Promise<{ status: number; body: Record<string, unknown> }> {
  const route = require("@/app/api/models/import/route") as {
    POST: (req: unknown) => Promise<{ status: number; json: () => Promise<unknown> }>;
  };
  const { NextRequest } = jest.requireMock("next/server");
  const req = new NextRequest("http://localhost/api/models/import", { method: "POST" });
  const res = await route.POST(req);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("POST /api/models/import", () => {
  it("inserts a single model + credential and links them by upserted id (not DB read)", async () => {
    mockParsedConfig.models = [
      {
        name: "Sonnet",
        provider: "anthropic",
        modelId: "anthropic/claude-sonnet-4",
        baseUrl: null,
        contextLength: 200000,
        defaultSlots: ["agent"],
      },
    ];
    mockParsedConfig.credentials = [{ provider: "anthropic", apiKey: "sk-test" }];
    // Existing DB row has no credentialsId yet — should trigger an update.
    mockListModels.mockReturnValue([
      {
        id: "m_1",
        provider: "anthropic",
        modelId: "anthropic/claude-sonnet-4",
        credentialsId: null,
      },
    ]);

    const res = await postImport();
    expect(res.status).toBe(200);

    // 1. Upsert was called first
    expect(mockUpsertModel).toHaveBeenCalledTimes(1);
    // 2. Then the credential upsert
    expect(mockUpsertCredential).toHaveBeenCalledWith({
      provider: "anthropic",
      apiKey: "sk-test",
    });
    // 3. updateModel was called with the upserted id (m_1), not a fresh
    //    re-lookup. The refactor: the loop uses `modelKeyToId` to look
    //    up the id, so even if listModels() returned a different row
    //    later, the import would still link the right model.
    expect(mockUpdateModel).toHaveBeenCalledWith("m_1", { credentialsId: "c_anthropic" });

    const data = res.body.data as {
      modelsImported: number;
      credentialsUpdated: number;
      credentialsLinked: number;
    };
    expect(data.modelsImported).toBe(1);
    expect(data.credentialsUpdated).toBe(1);
    expect(data.credentialsLinked).toBe(1);

    expect(audit.appendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "models.import", ok: true }),
    );
  });

  it("does not re-link when the model's credentialsId already matches", async () => {
    mockParsedConfig.models = [
      {
        name: "Sonnet",
        provider: "anthropic",
        modelId: "anthropic/claude-sonnet-4",
        baseUrl: null,
        contextLength: 200000,
        defaultSlots: [],
      },
    ];
    mockParsedConfig.credentials = [{ provider: "anthropic", apiKey: "sk-test" }];
    mockListModels.mockReturnValue([
      {
        id: "m_1",
        provider: "anthropic",
        modelId: "anthropic/claude-sonnet-4",
        credentialsId: "c_anthropic", // already linked
      },
    ]);

    const res = await postImport();
    expect(res.status).toBe(200);
    expect(mockUpdateModel).not.toHaveBeenCalled();
    expect((res.body.data as { credentialsLinked: number }).credentialsLinked).toBe(0);
  });

  it("skips models that fail to upsert (they are not in modelKeyToId)", async () => {
    mockParsedConfig.models = [
      {
        name: "Sonnet",
        provider: "anthropic",
        modelId: "anthropic/claude-sonnet-4",
        baseUrl: null,
        contextLength: 200000,
        defaultSlots: [],
      },
    ];
    mockParsedConfig.credentials = [{ provider: "anthropic", apiKey: "sk-test" }];
    // The upsert throws — should mark action=skipped and skip the link pass.
    mockUpsertModel.mockImplementation(() => {
      throw new Error("simulated DB failure");
    });

    const res = await postImport();
    expect(res.status).toBe(200);
    const data = res.body.data as { modelsImported: number; modelsSkipped: number; credentialsLinked: number };
    expect(data.modelsSkipped).toBe(1);
    expect(data.modelsImported).toBe(0);
    // No link because the failing model never made it into modelKeyToId.
    expect(mockUpdateModel).not.toHaveBeenCalled();
    expect(data.credentialsLinked).toBe(0);
  });

  it("handles multiple models + credentials and only links matching providers", async () => {
    mockParsedConfig.models = [
      {
        name: "Sonnet",
        provider: "anthropic",
        modelId: "anthropic/claude-sonnet-4",
        baseUrl: null,
        contextLength: 200000,
        defaultSlots: ["agent"],
      },
      {
        name: "GPT-4o",
        provider: "openai",
        modelId: "gpt-4o",
        baseUrl: null,
        contextLength: 128000,
        defaultSlots: [],
      },
    ];
    mockParsedConfig.credentials = [
      { provider: "anthropic", apiKey: "sk-anthropic" },
      { provider: "openai", apiKey: "sk-openai" },
    ];
    mockListModels.mockImplementation(() => [
      { id: "m_1", provider: "anthropic", modelId: "anthropic/claude-sonnet-4", credentialsId: null },
      { id: "m_2", provider: "openai", modelId: "gpt-4o", credentialsId: null },
    ]);

    const res = await postImport();
    expect(res.status).toBe(200);
    expect(mockUpdateModel).toHaveBeenCalledTimes(2);
    expect(mockUpdateModel).toHaveBeenCalledWith("m_1", { credentialsId: "c_anthropic" });
    expect(mockUpdateModel).toHaveBeenCalledWith("m_2", { credentialsId: "c_openai" });
    expect((res.body.data as { credentialsLinked: number }).credentialsLinked).toBe(2);
  });
});
