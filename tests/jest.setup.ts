import "@testing-library/jest-dom";
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from "node:util";

// jsdom does not provide TextEncoder/TextDecoder, but server-side stream
// parsing (e.g. the runtime SSE reader) relies on them. Pull Node's
// implementations into the test global so that code runs under jsdom.
if (typeof globalThis.TextEncoder === "undefined") {
  (globalThis as Record<string, unknown>).TextEncoder = NodeTextEncoder;
}
if (typeof globalThis.TextDecoder === "undefined") {
  (globalThis as Record<string, unknown>).TextDecoder = NodeTextDecoder;
}

// Polyfill globals required by Next.js 14 server route imports.
// These are referenced during module evaluation in next/dist/server/web/spec-extension/
if (typeof globalThis.Response === "undefined") {
  class PolyfillResponse {
    readonly body: BodyInit | null;
    readonly status: number;
    readonly headers: Headers;
    readonly ok: boolean;

    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this.body = body ?? null;
      this.status = init?.status ?? 200;
      this.headers = new Headers(init?.headers);
      this.ok = this.status >= 200 && this.status < 300;
    }

    async json(): Promise<unknown> {
      if (typeof this.body === "string") {
        return JSON.parse(this.body) as unknown;
      }
      return this.body;
    }
  }

  (globalThis as Record<string, unknown>).Response =
    PolyfillResponse as unknown as typeof Response;
}

// Add Response.json static method if jsdom's Response doesn't have it.
// jsdom defines Response but not Response.json(), which NextResponse.json() calls.
// We only augment — we do NOT replace the existing Response object.
type JestResponse = { json?: (...args: unknown[]) => unknown; new(body?: BodyInit | null, init?: ResponseInit): Response };
const _Response = globalThis.Response as unknown as JestResponse;
if (_Response && typeof _Response.json !== "function") {
  Object.defineProperty(_Response, "json", {
    value: function responseJson(data: unknown, init?: ResponseInit): Response {
      return new _Response(JSON.stringify(data), {
        ...init,
        headers: { "content-type": "application/json", ...Object.fromEntries(new Headers(init?.headers as HeadersInit) ?? []) },
      } as ResponseInit);
    },
    writable: true,
    configurable: true,
  });
}
if (typeof globalThis.Request === "undefined") {
  (globalThis as Record<string, unknown>).Request = class Request {
    private readonly _url: string;
    private readonly _method: string;
    private readonly _headers: Headers;

    constructor(input: RequestInfo | URL, init?: RequestInit) {
      this._url =
        typeof input === "string"
          ? input
          : (input as URL).href ?? String(input);
      this._method = init?.method ?? "GET";
      this._headers = new Headers(init?.headers);
    }

    get url() {
      return this._url;
    }

    get method() {
      return this._method;
    }

    get headers() {
      return this._headers;
    }
  } as unknown as typeof Request;
}

// ─── Global better-sqlite3 mock ─────────────────────────────────────────────────
// All test files that mock "@/lib/db" OR use jest.mock("fs") need better-sqlite3
// mocked so its native addon never loads. This global mock ensures that any test
// that imports @/lib/db (which imports better-sqlite3) gets an in-memory mock
// instead of the real native module.
//
// Individual test files that need specific mock behavior should additionally mock
// "@/lib/db" to return their per-test mock values.
//
// NOTE: tests that call jest.restoreAllMocks() in afterAll may inadvertently
// remove this global mock — avoid calling restoreAllMocks() in new tests.
const mockDbMethods = {
  pragma: jest.fn(),
  exec: jest.fn(),
  prepare: jest.fn(() => ({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(() => []),
  })),
  transaction: jest.fn((fn: () => unknown) => fn()),
  close: jest.fn(),
};

jest.mock("better-sqlite3", () => ({
  __esModule: true,
  default: jest.fn(() => mockDbMethods),
}));

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(() => mockDbMethods),
  ensureDb: jest.fn(),
  getSchemaHealth: jest.fn(() => ({
    schemaVersion: 2,
    hasMissionCategoriesTable: true,
    categoryCount: 2,
  })),
  getSchemaVersion: jest.fn((db: { prepare: (sql: string) => { get: (key: string) => { value: string } | undefined } }) => {
    const row = db.prepare("SELECT value FROM meta WHERE key = ?").get("schema_version");
    return row ? parseInt(row.value, 10) : 0;
  }),
  setSchemaVersion: jest.fn(),
  inTransaction: jest.fn((fn: () => unknown) => fn()),
  uuid: jest.fn(() => "test-uuid-" + Math.random().toString(36).slice(2)),
  now: jest.fn(() => "2026-01-01T00:00:00.000Z"),
}));
