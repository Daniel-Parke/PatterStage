/** @jest-environment node */
/**
 * B4 (T-0098) oracle, group memory-missions-templates.
 *
 * Four write paths the analytics ledger does not yet hear about:
 *
 *   memory.configured   PUT  /api/memory/config        after updateMemoryProvider
 *   memory.retained     POST /api/memory/hindsight     action "retain", after handleRetain
 *   template.saved      POST /api/templates            create + update, after saveTemplate
 *   mission.cancelled   handleCancelMission            after finaliseCancelledMission
 *
 * The contract every describe below holds: the event is recorded ONLY after
 * the write succeeded, and ONLY from a write path. A refused write, a write
 * that throws, a lookup that 404s, a read action that answers 200: none of
 * them may leave a row. The positive tests fail today on the missing emit and
 * nothing else; the negatives pass today and must keep passing once the emit
 * lands, which is what pins its position to AFTER the write.
 *
 * Every handler runs for real; only its writers and the ledger are doubles.
 */

import { NextRequest, NextResponse } from "next/server";

jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

// ── memory/config: the DB-owned provider table ─────────────────
const mockUpdateMemoryProvider = jest.fn();
jest.mock("@/lib/db", () => ({
  ensureDb: jest.fn(),
  getDb: jest.fn(),
  now: () => "2026-09-05T00:00:00.000Z",
}));
const DEFAULT_MEMORY_CONFIG = { host: "127.0.0.1", port: 9177, bank: "hermes" };
jest.mock("@/lib/memory/memory-providers", () => {
  const { HindsightMemoryProvider } = jest.requireActual(
    "@/lib/memory/memory-providers/hindsight-provider",
  ) as typeof import("@/lib/memory/memory-providers/hindsight-provider");
  return {
    getMemoryProviderType: jest.fn(() => "hindsight"),
    listMemoryProviders: jest.fn(() => []),
    getActiveMemoryConfig: jest.fn(() => ({ type: "hindsight", config: { ...DEFAULT_MEMORY_CONFIG } })),
    // The real transport over a faked fetch, as tests/unit/hindsight-route.test.ts
    // does it, so `retain` reaches the Hindsight wire rather than a stub of it.
    getActiveMemoryProvider: jest.fn(() => new HindsightMemoryProvider({ ...DEFAULT_MEMORY_CONFIG })),
    updateMemoryProvider: (...a: unknown[]) => mockUpdateMemoryProvider(...a),
  };
});

// ── templates: one JSON file each under PATHS.templates ────────
const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockReaddirSync = jest.fn();
const mockMkdirSync = jest.fn();
jest.mock("fs", () => ({
  existsSync: (...a: unknown[]) => mockExistsSync(...a) as boolean,
  readFileSync: (...a: unknown[]) => mockReadFileSync(...a) as string,
  writeFileSync: (...a: unknown[]) => mockWriteFileSync(...a),
  readdirSync: (...a: unknown[]) => mockReaddirSync(...a) as string[],
  mkdirSync: (...a: unknown[]) => mockMkdirSync(...a),
  statSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmSync: jest.fn(),
}));
jest.mock("@/lib/paths", () => ({
  PS_DATA_DIR: "/tmp/ch-data",
  getPsDataDir: () => "/tmp/ch-data",
  PATHS: {
    templates: "/tmp/test-templates",
    missions: "/tmp/ch-data/missions",
    patterStageDb: "/tmp/ch-data/control-hub.db",
    stories: "/tmp/ch-data/stories",
    recroom: "/tmp/ch-data/recroom",
    workspaces: "/tmp/ch-data/workspaces",
    auditLog: "/tmp/ch-data/audit",
    psScripts: "/tmp/ch-data/scripts",
    psHardwareLogs: "/tmp/ch-data/logs",
  },
  getPsScriptsDir: () => "/tmp/ch-data/scripts",
  getPsHardwareLogDir: () => "/tmp/ch-data/logs",
  readEnv: (...keys: string[]) => {
    for (const k of keys) {
      const v = process.env[k];
      if (v && String(v).trim()) return String(v).trim();
    }
    return undefined;
  },
}));
jest.mock("@/lib/schema", () => ({ parseTemplatePackManifestV1: jest.fn() }));
jest.mock("@/lib/missions/mission-category-repository", () => ({
  resolveTemplateCategoryId: jest.fn(() => "general"),
  getCategory: jest.fn(() => null),
}));

// ── missions: the three tables a cancellation writes ───────────
const mockGetMission = jest.fn();
const mockUpdateMission = jest.fn();
jest.mock("@/lib/missions/mission-repository", () => ({
  getMission: (...a: unknown[]) => mockGetMission(...a),
  updateMission: (...a: unknown[]) => mockUpdateMission(...a),
}));
jest.mock("@/lib/runs-repository", () => ({
  getLatestRunForMission: jest.fn(() => null),
  updateRun: jest.fn(),
}));
jest.mock("@/lib/sessions/session-repository", () => ({
  closeSessionForMission: jest.fn(),
}));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/orchestration", () => ({
  stopBackendRunForMission: jest.fn(() => Promise.resolve()),
}));
const mockRequireNotReadOnly = jest.fn();
jest.mock("@/lib/api-auth", () => ({
  requireNotReadOnly: (...a: unknown[]) => mockRequireNotReadOnly(...a),
  isReadOnly: () => false,
}));

// Log-and-500 shim kept honest (a real 500 NextResponse), minus the console
// line every negative below would otherwise print.
jest.mock("@/lib/api-logger", () => {
  const { NextResponse: NR } = jest.requireActual("next/server") as typeof import("next/server");
  return {
    logApiError: jest.fn(),
    serverErrorFromCatch: (_r: string, _c: string, _e: unknown, message: string) =>
      NR.json({ error: message }, { status: 500 }),
  };
});

import { recordEvent } from "@/lib/analytics/record-event";
import { PUT as putMemoryConfig } from "@/app/api/memory/config/route";
import { GET as getHindsight, POST as postHindsight } from "@/app/api/memory/hindsight/route";
import { POST as postTemplates } from "@/app/api/templates/route";
import { handleCreateTemplate } from "@/lib/templates-handlers/create";
import { handleUpdateTemplate } from "@/lib/templates-handlers/update";
import { handleCancelMission } from "@/lib/missions/mission-handlers/cancel";
import { POST as postCancelMission } from "@/app/api/missions/[id]/cancel/route";
import type { Mission } from "@/lib/missions/mission-types";

const emitted = recordEvent as unknown as jest.Mock;

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  // clearAllMocks drops calls, not implementations: a throwing double
  // installed by one negative would otherwise run the next test's write.
  // Reset every writer double, so each test installs its own answer.
  jest.clearAllMocks();
  mockUpdateMemoryProvider.mockReset();
  mockWriteFileSync.mockReset();
  mockReadFileSync.mockReset();
  mockGetMission.mockReset();
  mockUpdateMission.mockReset();
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockRequireNotReadOnly.mockReturnValue(null);
  mockExistsSync.mockReturnValue(true);
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});

// ═══════════════════════════════════════════════════════════════
// 14. memory.configured — PUT /api/memory/config
// ═══════════════════════════════════════════════════════════════

describe("PUT /api/memory/config records memory.configured", () => {
  const URL = "http://localhost/api/memory/config";
  const savedRow = {
    id: 1,
    type: "hindsight",
    label: "Hindsight",
    enabled: true,
    isActive: true,
    confirmed: true,
    config: { host: "10.0.0.5", port: 9177, bank: "hermes" },
  };

  it("the operator points memory at a new host, and the ledger names the provider", async () => {
    mockUpdateMemoryProvider.mockReturnValue(savedRow);

    const res = await putMemoryConfig(
      jsonRequest(URL, "PUT", {
        type: "hindsight",
        makeActive: true,
        config: { host: "10.0.0.5", port: 9177, bank: "hermes" },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockUpdateMemoryProvider).toHaveBeenCalledWith("hindsight", expect.anything());
    expect(emitted).toHaveBeenCalledWith(
      "memory.configured",
      expect.objectContaining({ entityType: "memory", entityId: "hindsight" }),
    );
  });

  it("the provider table refuses the write (throws) → 500, and nothing is recorded", async () => {
    mockUpdateMemoryProvider.mockImplementationOnce(() => {
      throw new Error("SQLITE_BUSY: database is locked");
    });

    const res = await putMemoryConfig(
      jsonRequest(URL, "PUT", { type: "hindsight", config: { host: "10.0.0.5", port: 9177, bank: "hermes" } }),
    );

    expect(res.status).toBe(500);
    expect(emitted).not.toHaveBeenCalled();
  });

  it("the repository answers null (unknown provider) → 400, and nothing is recorded", async () => {
    mockUpdateMemoryProvider.mockReturnValue(null);

    const res = await putMemoryConfig(jsonRequest(URL, "PUT", { type: "holographic", enabled: true }));

    expect(res.status).toBe(400);
    expect(emitted).not.toHaveBeenCalled();
  });

  it("a body the schema rejects → 400 before any write, and nothing is recorded", async () => {
    const res = await putMemoryConfig(
      jsonRequest(URL, "PUT", { type: "pinecone", config: { host: "", port: -1, bank: "" } }),
    );

    expect(res.status).toBe(400);
    expect(mockUpdateMemoryProvider).not.toHaveBeenCalled();
    expect(emitted).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 15. memory.retained — POST /api/memory/hindsight { action: "retain" }
// ═══════════════════════════════════════════════════════════════

describe("POST /api/memory/hindsight retain records memory.retained", () => {
  const URL = "http://localhost/api/memory/hindsight";

  it("the operator retains a memory into a named bank, and the ledger names that bank", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, operation_id: "op-1" }));

    const res = await postHindsight(
      jsonRequest(URL, "POST", { action: "retain", bank: "notes", content: "remember this", tags: ["x"] }),
    );

    expect(res.status).toBe(200);
    expect(mockFetch.mock.calls[0][0]).toBe("http://127.0.0.1:9177/v1/default/banks/notes/memories");
    expect(emitted).toHaveBeenCalledWith(
      "memory.retained",
      expect.objectContaining({
        entityType: "memory",
        entityId: "notes",
        metadata: expect.objectContaining({ bank: "notes" }),
      }),
    );
  });

  it("with no bank in the body the configured default bank is the entity", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, operation_id: "op-2" }));

    const res = await postHindsight(jsonRequest(URL, "POST", { action: "retain", content: "remember this" }));

    expect(res.status).toBe(200);
    expect(emitted).toHaveBeenCalledWith(
      "memory.retained",
      expect.objectContaining({
        entityType: "memory",
        entityId: "hermes",
        metadata: expect.objectContaining({ bank: "hermes" }),
      }),
    );
  });

  it("Hindsight rejects the retain (fetch throws) → 500, and nothing is recorded", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fetch failed: ECONNREFUSED 127.0.0.1:9177"));

    const res = await postHindsight(jsonRequest(URL, "POST", { action: "retain", bank: "notes", content: "x" }));

    expect(res.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(emitted).not.toHaveBeenCalled();
  });

  it("Hindsight answers a non-2xx to the retain → 500, and nothing is recorded", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ detail: "bank is read-only" }, 422));

    const res = await postHindsight(jsonRequest(URL, "POST", { action: "retain", bank: "notes", content: "x" }));

    expect(res.status).toBe(500);
    expect(emitted).not.toHaveBeenCalled();
  });

  it("a recall answers 200 and is a read, so nothing is recorded", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ items: [{ id: "m1", text: "hello", fact_type: "fact", date: "2026-01-01", tags: [] }] }),
    );

    const res = await getHindsight(new NextRequest(`${URL}?action=recall&query=hello&bank=notes`));

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(emitted).not.toHaveBeenCalled();
  });

  it("a retain with empty content → 400 before the wire, and nothing is recorded", async () => {
    const res = await postHindsight(jsonRequest(URL, "POST", { action: "retain", bank: "notes", content: "   " }));

    expect(res.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(emitted).not.toHaveBeenCalled();
  });

  // The POST verb carries seven actions; only "retain" is a memory retained.
  // A directive created through the same switch answers 200 and is not one
  // (the sweep's survivor emitted after every action: T-0098).
  it("a directive created through the same POST answers 200 and records nothing", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "d-1", name: "Be brief" }));

    const res = await postHindsight(
      jsonRequest(URL, "POST", { action: "create-directive", bank: "notes", name: "Be brief", content: "Answer in one line" }),
    );

    expect(res.status).toBe(200);
    expect(mockFetch.mock.calls[0][0]).toBe("http://127.0.0.1:9177/v1/default/banks/notes/directives");
    expect(emitted).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 16. template.saved — templates-handlers/create.ts + update.ts
// ═══════════════════════════════════════════════════════════════

describe("POST /api/templates records template.saved", () => {
  const URL = "http://localhost/api/templates";
  const onDisk = {
    id: "tpl_abc",
    name: "Old name",
    icon: "Zap",
    color: "cyan",
    category: "Custom",
    profile: "",
    description: "",
    instruction: "go",
    context: "",
    goals: [],
    suggestedSkills: [],
    dispatchMode: "now",
    schedule: "every 5m",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("the operator creates a template through the route, and the ledger carries the generated id", async () => {
    const res = await postTemplates(
      jsonRequest(URL, "POST", { action: "create", name: "Nightly digest", instruction: "summarise" }),
    );

    expect(res.status).toBe(200);
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toMatch(/^ct_/);
    expect(emitted).toHaveBeenCalledWith(
      "template.saved",
      expect.objectContaining({
        entityType: "template",
        entityId: body.data.id,
        metadata: expect.objectContaining({ action: "created" }),
      }),
    );
  });

  it("the operator updates a template through the route, and the ledger says updated", async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(onDisk));

    const res = await postTemplates(
      jsonRequest(URL, "POST", { action: "update", templateId: "tpl_abc", name: "New name" }),
    );

    expect(res.status).toBe(200);
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    expect(emitted).toHaveBeenCalledWith(
      "template.saved",
      expect.objectContaining({
        entityType: "template",
        entityId: "tpl_abc",
        metadata: expect.objectContaining({ action: "updated" }),
      }),
    );
  });

  it("handleCreateTemplate, called directly, records the id it generated", async () => {
    const res = handleCreateTemplate({ name: "Direct", instruction: "go" });

    expect(res.status).toBe(200);
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    const body = (await res.json()) as { data: { id: string } };
    expect(emitted).toHaveBeenCalledWith(
      "template.saved",
      expect.objectContaining({
        entityType: "template",
        entityId: body.data.id,
        metadata: expect.objectContaining({ action: "created" }),
      }),
    );
  });

  it("handleUpdateTemplate, called directly, records the template it rewrote", () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(onDisk));

    const res = handleUpdateTemplate({ templateId: "tpl_abc", description: "changed" });

    expect(res.status).toBe(200);
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    expect(emitted).toHaveBeenCalledWith(
      "template.saved",
      expect.objectContaining({
        entityType: "template",
        entityId: "tpl_abc",
        metadata: expect.objectContaining({ action: "updated" }),
      }),
    );
  });

  it("an update of a template that does not exist → 404, no write, and nothing is recorded", async () => {
    mockExistsSync.mockReturnValue(false);

    const res = await postTemplates(
      jsonRequest(URL, "POST", { action: "update", templateId: "tpl_missing", name: "x" }),
    );

    expect(res.status).toBe(404);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(emitted).not.toHaveBeenCalled();
  });

  it("the disk refuses the create (writeFileSync throws) → 500, and nothing is recorded", async () => {
    mockWriteFileSync.mockImplementationOnce(() => {
      throw new Error("ENOSPC: no space left on device");
    });

    const res = await postTemplates(jsonRequest(URL, "POST", { action: "create", name: "Doomed" }));

    expect(res.status).toBe(500);
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    expect(emitted).not.toHaveBeenCalled();
  });

  it("the disk refuses the update (writeFileSync throws) → 500, and nothing is recorded", async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(onDisk));
    mockWriteFileSync.mockImplementationOnce(() => {
      throw new Error("EACCES: permission denied");
    });

    const res = await postTemplates(
      jsonRequest(URL, "POST", { action: "update", templateId: "tpl_abc", name: "x" }),
    );

    expect(res.status).toBe(500);
    expect(emitted).not.toHaveBeenCalled();
  });

  it("handleUpdateTemplate lets a write failure escape, and records nothing on the way out", () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(onDisk));
    mockWriteFileSync.mockImplementationOnce(() => {
      throw new Error("EACCES: permission denied");
    });

    expect(() => handleUpdateTemplate({ templateId: "tpl_abc", name: "x" })).toThrow(/EACCES/);
    expect(emitted).not.toHaveBeenCalled();
  });

  it("an update with a dispatchMode the validator rejects → 400 before the write, nothing recorded", async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(onDisk));

    const res = await postTemplates(
      jsonRequest(URL, "POST", { action: "update", templateId: "tpl_abc", dispatchMode: "yesterday" }),
    );

    expect(res.status).toBe(400);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(emitted).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 17. mission.cancelled — mission-handlers/cancel.ts
// ═══════════════════════════════════════════════════════════════

function mission(over: Partial<Mission> = {}): Mission {
  return {
    id: "m1",
    name: "Demo",
    prompt: "do the thing",
    status: "queued",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

describe("handleCancelMission records mission.cancelled", () => {
  it("the operator cancels a queued mission directly, and the ledger names the mission", async () => {
    mockGetMission.mockReturnValue(mission({ status: "queued" }));
    mockUpdateMission.mockReturnValue(mission({ status: "failed", result: "Cancelled by user" }));

    const res = handleCancelMission({ id: "m1" });

    expect(res.status).toBe(200);
    expect(mockUpdateMission).toHaveBeenCalledWith("m1", expect.objectContaining({ status: "failed" }));
    await expect(res.json()).resolves.toMatchObject({ data: { cancel: { accepted: true } } });
    expect(emitted).toHaveBeenCalledWith(
      "mission.cancelled",
      expect.objectContaining({ entityType: "mission", entityId: "m1" }),
    );
  });

  it("cancelling through POST /api/missions/[id]/cancel records the same event", async () => {
    mockGetMission.mockReturnValue(mission({ id: "m2", status: "dispatched" }));
    mockUpdateMission.mockReturnValue(mission({ id: "m2", status: "failed", result: "Cancelled by user" }));

    const res = await postCancelMission(
      new NextRequest("http://localhost/api/missions/m2/cancel", { method: "POST" }),
      { params: Promise.resolve({ id: "m2" }) },
    );

    expect(res.status).toBe(200);
    expect(mockUpdateMission).toHaveBeenCalledWith("m2", expect.objectContaining({ status: "failed" }));
    expect(emitted).toHaveBeenCalledWith(
      "mission.cancelled",
      expect.objectContaining({ entityType: "mission", entityId: "m2" }),
    );
  });

  it("an unknown mission → 404 from the lookup, no write, and nothing is recorded", () => {
    mockGetMission.mockReturnValue(null);

    const res = handleCancelMission({ id: "nope" });

    expect(res.status).toBe(404);
    expect(mockUpdateMission).not.toHaveBeenCalled();
    expect(emitted).not.toHaveBeenCalled();
  });

  it("the row vanishes under the finaliser (updateMission → null) → 404, and nothing is recorded", async () => {
    mockGetMission.mockReturnValue(mission({ status: "queued" }));
    mockUpdateMission.mockReturnValue(null);

    const res = await postCancelMission(
      new NextRequest("http://localhost/api/missions/m1/cancel", { method: "POST" }),
      { params: Promise.resolve({ id: "m1" }) },
    );

    expect(res.status).toBe(404);
    expect(mockUpdateMission).toHaveBeenCalledTimes(1);
    expect(emitted).not.toHaveBeenCalled();
  });

  it("the mission table refuses the write (updateMission throws) → 500, and nothing is recorded", async () => {
    mockGetMission.mockReturnValue(mission({ status: "queued" }));
    mockUpdateMission.mockImplementationOnce(() => {
      throw new Error("SQLITE_BUSY: database is locked");
    });

    const res = await postCancelMission(
      new NextRequest("http://localhost/api/missions/m1/cancel", { method: "POST" }),
      { params: Promise.resolve({ id: "m1" }) },
    );

    expect(res.status).toBe(500);
    expect(emitted).not.toHaveBeenCalled();
  });

  it("read-only mode refuses the REST cancel → 503 before any lookup, and nothing is recorded", async () => {
    mockRequireNotReadOnly.mockReturnValue(
      NextResponse.json({ error: "PatterStage is in read-only mode" }, { status: 503 }),
    );

    const res = await postCancelMission(
      new NextRequest("http://localhost/api/missions/m1/cancel", { method: "POST" }),
      { params: Promise.resolve({ id: "m1" }) },
    );

    expect(res.status).toBe(503);
    expect(mockGetMission).not.toHaveBeenCalled();
    expect(mockUpdateMission).not.toHaveBeenCalled();
    expect(emitted).not.toHaveBeenCalled();
  });
});
