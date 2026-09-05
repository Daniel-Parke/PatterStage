/** @jest-environment node */

// Tests for the session-71 mission-categories refactor:
// 1. `badRequest` / `notFound` / `forbidden` / `serverError` factory migration
//    in src/app/api/mission-categories/route.ts. The 10 inline
//    `NextResponse.json({ error }, { status: N })` sites were collapsed to
//    factory calls. The 2 extended-body inline sites (503 + 400 with counts)
//    and the 1 409 inline site (only such site) are kept inline per the
//    session-51 outlier design rule.
// 2. `toError(error).message || "..."` migration in the 4 catch blocks.
//    The `|| "..."` fallback preserves the byte-equivalent wire string for
//    non-Error throws (e.g. `throw ""` surfaces the friendly fallback).
//
// Behavioural contract (locked by these tests):
//   GET  400 (id missing)         → badRequest → { error: "id is required" }  status 400
//   GET  503 (table missing)      → inline 503 (extended body)
//   GET  404 (category missing)   → notFound
//   GET  500 (catch)              → serverError
//   POST 400 (name missing)       → badRequest
//   POST 409 (already exists)     → inline 409
//   POST 500 (catch)              → serverError
//   PUT  400 (id missing)         → badRequest
//   PUT  400 (reassignToId missing when in use) → inline 400 with counts
//   PUT  400 (reassign target not found) → badRequest
//   PUT  404 (category missing)   → notFound
//   PUT  500 (catch)              → serverError
//   DELETE 400 (id missing)       → badRequest
//   DELETE 400 (reassignToId missing when in use) → inline 400 with counts
//   DELETE 400 (reassign target not found) → badRequest
//   DELETE 403 (system category)  → forbidden
//   DELETE 500 (catch)            → serverError

// Mock next/server with a real NextResponse class so `instanceof NextResponse`
// checks in parseJsonBody work correctly. Capture the responses for assertions.
jest.mock("next/server", () => {
  const responses: Array<{ data: unknown; init?: ResponseInit }> = [];
  class NextResponse {
    ok: boolean;
    status: number;
    private _data: unknown;
    constructor(data: unknown = null, init?: ResponseInit) {
      this._data = data;
      this.status = init?.status ?? 200;
      this.ok = this.status >= 200 && this.status < 300;
    }
    json() {
      return Promise.resolve(this._data);
    }
    static json(data: unknown, init?: ResponseInit) {
      responses.push({ data, init });
      return new NextResponse(data, init);
    }
  }
  return {
    NextRequest: class NextRequest {
      url: string;
      method: string;
      headers: Headers;
      private _body: string;
      constructor(url: string, init?: RequestInit) {
        this.url = url;
        this.method = init?.method ?? "GET";
        this.headers = new Headers(init?.headers as HeadersInit);
        this._body =
          typeof init?.body === "string"
            ? init.body
            : JSON.stringify(init?.body ?? {});
      }
      async json() {
        return JSON.parse(this._body);
      }
    },
    NextResponse,
    __responses: responses,
  };
});

// Pull the responses array accessor out of the mock.
const { __responses, NextRequest } = jest.requireMock("next/server") as {
  __responses: Array<{ data: unknown; init?: ResponseInit }>;
  NextRequest: new (url: string, init?: RequestInit) => unknown;
};
function lastResponse() {
  return __responses[__responses.length - 1];
}
function clearResponses() {
  __responses.length = 0;
}

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/api-auth", () => ({
  isReadOnly: jest.fn(() => false),
}));

const mockEnsureDb = jest.fn();
const mockGetSchemaHealth = jest.fn((..._a: unknown[]) => ({
  hasMissionCategoriesTable: true,
  schemaVersion: 1,
}));
const mockListCategories = jest.fn();
const mockCountMissions = jest.fn();
const mockCountTemplates = jest.fn();
const mockCreateCategory = jest.fn();
const mockUpdateCategory = jest.fn();
const mockDeleteCategory = jest.fn();
const mockGetCategory = jest.fn();
const mockEnsureDefaultCategories = jest.fn();

jest.mock("@/lib/db", () => ({
  ensureDb: (...args: unknown[]) => mockEnsureDb(...args),
  getSchemaHealth: (...args: unknown[]) => mockGetSchemaHealth(...args),
}));

jest.mock("@/lib/missions/mission-category-repository", () => ({
  listCategoriesWithDefaults: (...args: unknown[]) => mockListCategories(...args),
  countMissionsInCategory: (...args: unknown[]) => mockCountMissions(...args),
  countTemplatesInCategory: (...args: unknown[]) => mockCountTemplates(...args),
  createCategory: (...args: unknown[]) => mockCreateCategory(...args),
  updateCategory: (...args: unknown[]) => mockUpdateCategory(...args),
  deleteCategory: (...args: unknown[]) => mockDeleteCategory(...args),
  getCategory: (...args: unknown[]) => mockGetCategory(...args),
  ensureDefaultCategories: (...args: unknown[]) =>
    mockEnsureDefaultCategories(...args),
}));

import {
  GET,
  POST,
  PUT,
  DELETE,
} from "@/app/api/mission-categories/route";

const BASE = "http://localhost/api/mission-categories";

function getRequest(): unknown {
  return new NextRequest(BASE);
}

function jsonRequest(
  method: "POST" | "PUT",
  body: unknown,
  url = BASE
): unknown {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(url: string): unknown {
  return new NextRequest(url, { method: "DELETE" });
}

describe("mission-categories route — factory migration (session 71)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearResponses();
    mockGetSchemaHealth.mockReturnValue({
      hasMissionCategoriesTable: true,
      schemaVersion: 1,
    });
    mockListCategories.mockReturnValue([]);
    mockCountMissions.mockReturnValue(0);
    mockCountTemplates.mockReturnValue(0);
  });

  // ── GET ─────────────────────────────────────────────────────────────────

  describe("GET", () => {
    it("returns 200 with categories on the happy path", async () => {
      mockListCategories.mockReturnValue([
        { id: "general", name: "General", color: "cyan", sortOrder: 0 },
      ]);
      mockCountMissions.mockReturnValue(3);
      mockCountTemplates.mockReturnValue(1);

      const res = (await GET(getRequest() as never)) as { status: number };

      expect(res.status).toBe(200);
      const data = lastResponse().data as {
        data: {
          categories: Array<{ id: string; missionCount: number; templateCount: number }>;
          schemaVersion: number;
        };
      };
      expect(data.data.categories).toEqual([
        { id: "general", name: "General", color: "cyan", sortOrder: 0, missionCount: 3, templateCount: 1 },
      ]);
      expect(data.data.schemaVersion).toBe(1);
    });

    it("returns 503 with migrationRequired + schemaVersion (inline outlier, byte-locked)", async () => {
      mockGetSchemaHealth.mockReturnValue({
        hasMissionCategoriesTable: false,
        schemaVersion: 0,
      });

      const res = (await GET(getRequest() as never)) as { status: number };

      expect(res.status).toBe(503);
      const data = lastResponse().data as {
        error: string;
        migrationRequired: boolean;
        schemaVersion: number;
      };
      expect(data.error).toContain("mission_categories table is missing");
      expect(data.migrationRequired).toBe(true);
      expect(data.schemaVersion).toBe(0);
    });

    it("returns 500 with the catch message (serverError factory + toError unwrap)", async () => {
      mockListCategories.mockImplementation(() => {
        throw new Error("disk on fire");
      });

      const res = (await GET(getRequest() as never)) as { status: number };

      expect(res.status).toBe(500);
      const data = lastResponse().data as { error: string };
      expect(data.error).toBe("disk on fire");
    });

    it("falls back to friendly message on empty-message throw (toError().message || fallback)", async () => {
      // Empty Error: `throw new Error("")` produces `toError(e).message === ""`,
      // which is falsy, so the friendly fallback IS used — restoring the
      // byte-equivalent "Failed to load categories" string. (Real non-Error
      // throws like `throw "x"` surface the stringified message via
      // toError → new Error(String(x)) → .message — also byte-equivalent
      // to the prior `instanceof Error ? error.message : "..."` pattern,
      // which would also return the stringified value for non-Error values.)
      mockListCategories.mockImplementation(() => {
        throw new Error("");
      });

      const res = (await GET(getRequest() as never)) as { status: number };

      expect(res.status).toBe(500);
      const data = lastResponse().data as { error: string };
      expect(data.error).toBe("Failed to load categories");
    });
  });

  // ── POST ────────────────────────────────────────────────────────────────

  describe("POST", () => {
    it("returns 400 'name is required' (badRequest factory)", async () => {
      const res = (await POST(
        jsonRequest("POST", { color: "red" }) as never
      )) as { status: number };

      expect(res.status).toBe(400);
      const data = lastResponse().data as { error: string };
      expect(data.error).toBe("name is required");
    });

    it("returns 400 'name is required' when name is whitespace-only (badRequest factory)", async () => {
      const res = (await POST(
        jsonRequest("POST", { name: "   " }) as never
      )) as { status: number };

      expect(res.status).toBe(400);
      const data = lastResponse().data as { error: string };
      expect(data.error).toBe("name is required");
    });

    it("returns 201 with the new category (happy path)", async () => {
      mockCreateCategory.mockReturnValue({
        id: "new-1",
        name: "Research",
        color: "red",
        sortOrder: 5,
      });

      const res = (await POST(
        jsonRequest("POST", { name: "Research", color: "red" }) as never
      )) as { status: number };

      expect(res.status).toBe(201);
      const data = lastResponse().data as {
        data: { category: { id: string; name: string; missionCount: number; templateCount: number } };
      };
      expect(data.data.category).toEqual({
        id: "new-1",
        name: "Research",
        color: "red",
        sortOrder: 5,
        missionCount: 0,
        templateCount: 0,
      });
    });

    it("returns 409 'already exists' (inline outlier, byte-locked)", async () => {
      mockCreateCategory.mockImplementation(() => {
        throw new Error("Category 'X' already exists");
      });

      const res = (await POST(
        jsonRequest("POST", { name: "X" }) as never
      )) as { status: number };

      expect(res.status).toBe(409);
      const data = lastResponse().data as { error: string };
      expect(data.error).toContain("already exists");
    });

    it("returns 500 on a non-'already exists' error (serverError factory)", async () => {
      mockCreateCategory.mockImplementation(() => {
        throw new Error("write conflict");
      });

      const res = (await POST(
        jsonRequest("POST", { name: "X" }) as never
      )) as { status: number };

      expect(res.status).toBe(500);
      const data = lastResponse().data as { error: string };
      expect(data.error).toBe("write conflict");
    });
  });

  // ── PUT ─────────────────────────────────────────────────────────────────

  describe("PUT", () => {
    it("returns 400 'id is required' when id is missing (badRequest factory)", async () => {
      const res = (await PUT(
        jsonRequest("PUT", { name: "X" }) as never
      )) as { status: number };

      expect(res.status).toBe(400);
      const data = lastResponse().data as { error: string };
      expect(data.error).toBe("id is required");
    });

    it("returns 404 'Category not found' (notFound factory)", async () => {
      mockUpdateCategory.mockReturnValue(null);

      const res = (await PUT(
        jsonRequest("PUT", { id: "missing", name: "X" }) as never
      )) as { status: number };

      expect(res.status).toBe(404);
      const data = lastResponse().data as { error: string };
      expect(data.error).toBe("Category not found");
    });

    it("returns 200 with the updated category (happy path)", async () => {
      mockUpdateCategory.mockReturnValue({
        id: "general",
        name: "General (renamed)",
        color: "red",
        sortOrder: 0,
      });
      mockCountMissions.mockReturnValue(2);
      mockCountTemplates.mockReturnValue(4);

      const res = (await PUT(
        jsonRequest("PUT", { id: "general", name: "General (renamed)", color: "red" }) as never
      )) as { status: number };

      expect(res.status).toBe(200);
      const data = lastResponse().data as {
        data: { category: { id: string; missionCount: number; templateCount: number } };
      };
      expect(data.data.category.id).toBe("general");
      expect(data.data.category.missionCount).toBe(2);
      expect(data.data.category.templateCount).toBe(4);
    });

    it("returns 500 on a catch error (serverError factory + toError)", async () => {
      mockUpdateCategory.mockImplementation(() => {
        throw new Error("lock timeout");
      });

      const res = (await PUT(
        jsonRequest("PUT", { id: "general", name: "X" }) as never
      )) as { status: number };

      expect(res.status).toBe(500);
      const data = lastResponse().data as { error: string };
      expect(data.error).toBe("lock timeout");
    });
  });

  // ── DELETE ──────────────────────────────────────────────────────────────

  describe("DELETE", () => {
    it("returns 400 'id is required' (badRequest factory)", async () => {
      const res = (await DELETE(
        deleteRequest(BASE) as never
      )) as { status: number };

      expect(res.status).toBe(400);
      const data = lastResponse().data as { error: string };
      expect(data.error).toBe("id is required");
    });

    it("returns 400 'reassignToId required when category is in use' WITH counts (inline outlier)", async () => {
      mockCountMissions.mockReturnValue(5);
      mockCountTemplates.mockReturnValue(2);

      const res = (await DELETE(
        deleteRequest(`${BASE}?id=general`) as never
      )) as { status: number };

      expect(res.status).toBe(400);
      const data = lastResponse().data as {
        error: string;
        missionCount: number;
        templateCount: number;
      };
      expect(data.error).toBe("reassignToId required when category is in use");
      expect(data.missionCount).toBe(5);
      expect(data.templateCount).toBe(2);
    });

    it("returns 400 'Reassign target category not found' (badRequest factory)", async () => {
      mockCountMissions.mockReturnValue(1);
      mockGetCategory.mockReturnValue(null);

      const res = (await DELETE(
        deleteRequest(`${BASE}?id=general&reassignToId=missing`) as never
      )) as { status: number };

      expect(res.status).toBe(400);
      const data = lastResponse().data as { error: string };
      expect(data.error).toBe("Reassign target category not found");
    });

    it("returns 200 on successful delete (happy path)", async () => {
      // `true` because that is what deleteCategory actually returns. This mock
      // answered `undefined` and passed only because the route discarded the
      // result -- which is why DELETE with an unknown id used to answer 200 and
      // delete nothing (T-0079).
      mockDeleteCategory.mockReturnValue(true);

      const res = (await DELETE(
        deleteRequest(`${BASE}?id=general`) as never
      )) as { status: number };

      expect(res.status).toBe(200);
      const data = lastResponse().data as { data: { deleted: string } };
      expect(data.data.deleted).toBe("general");
    });

    it("returns 404 when the category does not exist", async () => {
      // The defect itself: the repository already reported "no such row" and
      // the route echoed the requested id back as deleted.
      mockDeleteCategory.mockReturnValue(false);

      const res = (await DELETE(
        deleteRequest(`${BASE}?id=no-such-category`) as never
      )) as { status: number };

      expect(res.status).toBe(404);
    });

    it("returns 403 'System categories' (forbidden factory)", async () => {
      mockDeleteCategory.mockImplementation(() => {
        throw new Error("System categories cannot be deleted");
      });

      const res = (await DELETE(
        deleteRequest(`${BASE}?id=system`) as never
      )) as { status: number };

      expect(res.status).toBe(403);
      const data = lastResponse().data as { error: string };
      expect(data.error).toBe("System categories cannot be deleted");
    });

    it("returns 500 on a non-'System categories' error (serverError factory + toError)", async () => {
      mockDeleteCategory.mockImplementation(() => {
        throw new Error("FK constraint");
      });

      const res = (await DELETE(
        deleteRequest(`${BASE}?id=x`) as never
      )) as { status: number };

      expect(res.status).toBe(500);
      const data = lastResponse().data as { error: string };
      expect(data.error).toBe("FK constraint");
    });
  });
});
