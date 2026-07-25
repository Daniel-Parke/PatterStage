/** @jest-environment node */

import type { NextRequest } from "next/server";
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
  // Mock only parseJsonBody (legacy test pattern) — leave
  // parseAndValidateJsonBody unmocked so the real zod validation runs
  // against the test's body. The real helper composes parseJsonBody +
  // zod schema.safeParse, so this still exercises the schema path.
  const actual = jest.requireActual("@/lib/parse-json-body");
  return {
    parseJsonBody: jest.fn(async (req: { json: () => Promise<unknown> }) => req.json()),
    parseAndValidateJsonBody: actual.parseAndValidateJsonBody,
  };
});

const mockGetFallbackConfig = jest.fn();
const mockUpdateFallbackConfigBatch = jest.fn();
const mockSyncEnabled = jest.fn();

jest.mock("@/lib/fallbacks-repository", () => ({
  getFallbackConfig: (...args: unknown[]) => mockGetFallbackConfig(...args),
  updateFallbackConfigBatch: (...args: unknown[]) => mockUpdateFallbackConfigBatch(...args),
}));

jest.mock("@/modules/hermes/lib/fallback-sync", () => ({
  syncEnabledFallbackChainToHermes: (...args: unknown[]) => mockSyncEnabled(...args),
}));

function makeRequest(body?: unknown) {
  return new (jest.requireMock("next/server").NextRequest as new (
    url: string,
    init?: RequestInit,
  ) => NextRequest)("http://localhost/api/models/fallbacks/sync", {
    method: "POST",
    headers: body ? new Headers({ "content-type": "application/json" }) : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const BASE_CONFIG = {
  restorePrimaryOnFallback: true,
  fallbackNotification: false,
  apiMaxRetries: 3,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetFallbackConfig.mockReturnValue({ ...BASE_CONFIG, apiMaxRetries: 5 });
  mockUpdateFallbackConfigBatch.mockImplementation((patch: { apiMaxRetries?: number }) => ({
    ...BASE_CONFIG,
    ...patch,
  }));
  mockSyncEnabled.mockReturnValue({
    backupPath: null,
    configPath: "/fake/.hermes/config.yaml",
    hermesHome: "/fake/.hermes",
  });
});

describe("POST /api/models/fallbacks/sync", () => {
  it("persists config from body before syncing to Hermes", async () => {
    const { POST } = await import("@/app/api/models/fallbacks/route");
    const res = (await POST(makeRequest({ action: "sync", config: { apiMaxRetries: 5 } }))) as {
      status: number;
      json: () => Promise<unknown>;
    };

    expect(res.status).toBe(200);
    expect(mockUpdateFallbackConfigBatch).toHaveBeenCalledWith({ apiMaxRetries: 5 });
    expect(mockSyncEnabled).toHaveBeenCalledWith(
      expect.objectContaining({ apiMaxRetries: 5 }),
    );

    const body = (await res.json()) as {
      data: { success: boolean; config: { apiMaxRetries: number }; configPath: string };
    };
    expect(body.data.success).toBe(true);
    expect(body.data.config.apiMaxRetries).toBe(5);
    expect(body.data.configPath).toBe("/fake/.hermes/config.yaml");
  });

  it("syncs from SQLite when body has no config", async () => {
    mockGetFallbackConfig.mockReturnValue({ ...BASE_CONFIG, apiMaxRetries: 2 });
    const { POST } = await import("@/app/api/models/fallbacks/route");
    const res = (await POST(makeRequest({ action: "sync" }))) as { status: number; json: () => Promise<unknown> };

    expect(res.status).toBe(200);
    expect(mockUpdateFallbackConfigBatch).not.toHaveBeenCalled();
    expect(mockSyncEnabled).toHaveBeenCalledWith(
      expect.objectContaining({ apiMaxRetries: 2 }),
    );
  });

  it("returns 400 for invalid body", async () => {
    const { POST } = await import("@/app/api/models/fallbacks/route");
    const res = (await POST(makeRequest({ action: "sync", config: { apiMaxRetries: 99 } }))) as {
      status: number;
    };
    expect(res.status).toBe(400);
    expect(mockSyncEnabled).not.toHaveBeenCalled();
  });

  it("returns 500 when Hermes sync throws", async () => {
    mockSyncEnabled.mockImplementation(() => {
      throw new Error("config.yaml api_max_retries mismatch");
    });
    const { POST } = await import("@/app/api/models/fallbacks/route");
    const res = (await POST(makeRequest({ action: "sync", config: { apiMaxRetries: 5 } }))) as {
      status: number;
      json: () => Promise<unknown>;
    };
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("api_max_retries");
  });
});
