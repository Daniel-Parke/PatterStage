/** @jest-environment node */

jest.mock("@/lib/api-auth", () => ({
  // T-0100: POST /api/seed refuses under read-only before it touches anything.
  requireNotReadOnly: () => null,
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.requireActual("@/lib/api-logger").serverErrorFromCatch,
}));

jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));

// A replace snapshots the database first (T-0100, D113); these cases are merges,
// so it never fires, but the route imports it either way.
jest.mock("@/lib/db/backup", () => ({
  snapshotDatabase: jest.fn(async () => ({
    name: "patterstage.pre-restore.db",
    path: "/tmp/patterstage.pre-restore.db",
    bytes: 1,
    takenAt: "2026-09-05T00:00:00.000Z",
    kind: "snapshot",
  })),
}));

const mockImportHermesState = jest.fn((..._a: unknown[]) => null);

jest.mock("@/modules/hermes/lib/state-import", () => ({
  importHermesStateFromDisk: (...args: unknown[]) => mockImportHermesState(...args),
}));

const mockRunCatalogSeed = jest.fn((..._a: unknown[]) => ({
  profiles: 6,
  templates: 12,
  categories: 6,
  pushed: 6,
}));

const mockGetSeedState = jest.fn(() => ({ lastRun: "2026-05-15T00:00:00.000Z" }));

const mockReadShippedPackCounts = jest.fn(() => ({
  catalogVersion: "patterstage-professional-v1",
  root: 1,
  profiles: 7,
  templates: 12,
  categories: 8,
  skills: 4,
  tools: 5,
  memories: 5,
}));

jest.mock("@/lib/seed/catalog-seed", () => ({
  runCatalogSeed: (...args: unknown[]) => mockRunCatalogSeed(...args),
  getSeedState: () => mockGetSeedState(),
  readShippedPackCounts: () => mockReadShippedPackCounts(),
}));

describe("/api/seed", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GET returns seed state", async () => {
    const { GET } = await import("@/app/api/seed/route");
    const res = await GET();
    const body = (await res.json()) as { data: { state: { lastRun: string } } };
    expect(body.data.state.lastRun).toBe("2026-05-15T00:00:00.000Z");
  });

  it("POST runs catalog seed with merge defaults", async () => {
    const { POST } = await import("@/app/api/seed/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/seed", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const body = (await res.json()) as { data: { profiles: number } };
    expect(body.data).toBeDefined();
    expect(body.data.profiles).toBe(6);
    expect(mockRunCatalogSeed).toHaveBeenCalledWith(
      expect.objectContaining({ target: "all", mode: "merge" }),
    );
  });

  it("POST returns 400 on malformed JSON", async () => {
    // Regression for the request.json() bug class: malformed JSON previously
    // returned 500 via the outer try/catch ("Failed to run seed"). parseJsonBody
    // now returns 400 with a clean error message.
    const { POST } = await import("@/app/api/seed/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/seed", {
      method: "POST",
      body: "{not valid json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/invalid json/i);
    expect(mockRunCatalogSeed).not.toHaveBeenCalled();
  });
});
