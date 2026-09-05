/** @jest-environment node */
/**
 * B4 (T-0098), the scripts-records group: the ledger records what the operator
 * did, and only once it was actually done.
 *
 * Six write paths get an analytics event: a script saved, run or scheduled; an
 * artifact, a credential or a model added. The contract each site is held to:
 *
 *   - the emit comes AFTER the write answered success, never before it, so a
 *     refused or failed write leaves no trace in the ledger;
 *   - the emit lives in the write path only: a read, a validation 400, an auth
 *     refusal and a sibling action on the same verb record nothing;
 *   - entityType/entityId name the thing written, and metadata carries the one
 *     fact the operator would look for (exit code, provider).
 *
 * Oracle-first: the event types do not exist yet and no route emits. Every
 * positive test below fails on the recordEvent assertion alone; every negative
 * passes today and must keep passing once the emits land.
 */

import { NextResponse } from "next/server";

jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

// The real logger shapes (serverErrorFromCatch must still answer a 500);
// only the console line is silenced.
jest.mock("@/lib/api-logger", () => ({
  ...jest.requireActual("@/lib/api-logger"),
  logApiError: jest.fn(),
}));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));

// The real auth module, with the host-writes guard steerable per test so the
// refusal can be exercised without touching PS_AUTH_MODE for the whole file.
const mockHostWrites = jest.fn<NextResponse | null, []>(() => null);
jest.mock("@/lib/api-auth", () => ({
  ...jest.requireActual("@/lib/api-auth"),
  requireAuthenticatedHostWrites: () => mockHostWrites(),
}));

const mockReadScriptContent = jest.fn();
const mockWriteScriptContent = jest.fn();
const mockRunScriptFile = jest.fn();
jest.mock("@/lib/scripts-manager", () => ({
  readScriptContent: (...a: unknown[]) => mockReadScriptContent(...a),
  writeScriptContent: (...a: unknown[]) => mockWriteScriptContent(...a),
  deleteScriptFile: jest.fn(),
  runScriptFile: (...a: unknown[]) => mockRunScriptFile(...a),
  // The cron handler rebuilds the command from a resolved script path, so the
  // test must say which script names exist (mirrors api-cron-system.test.ts).
  resolveScriptPath: (name: string) =>
    ["ps-backup.mjs", "ps-health-check.mjs"].includes(name) ? `/tmp/ch-data/scripts/${name}` : null,
}));

jest.mock("@/lib/paths", () => ({
  PS_DATA_DIR: "/tmp/ch-data",
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

// The pauseAll branch keeps a sidecar (.disabled_hardware_crons.json) under
// PS_DATA_DIR through the real fs; double it so no test touches the disk
// (mirrors api-cron-system.test.ts). Everything else in fs stays real.
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  readFileSync: (...a: unknown[]) => mockReadFileSync(...a),
  writeFileSync: (...a: unknown[]) => mockWriteFileSync(...a),
}));

let mockCrontab = "";
const mockWriteRaw = jest.fn();
jest.mock("@/lib/host-scheduler", () => ({
  getHostScheduler: () => ({
    readRaw: async () => mockCrontab,
    writeRaw: (c: string) => mockWriteRaw(c),
    setEnabled: jest.fn(async () => undefined),
  }),
}));

const mockCreateArtifact = jest.fn();
jest.mock("@/lib/artifacts-repository", () => ({
  createArtifact: (...a: unknown[]) => mockCreateArtifact(...a),
  listArtifacts: jest.fn(() => []),
}));

const mockCreateCredential = jest.fn();
const mockDeleteCredential = jest.fn();
jest.mock("@/lib/credentials-repository", () => ({
  listCredentials: jest.fn(() => []),
  createCredential: (...a: unknown[]) => mockCreateCredential(...a),
  deleteCredential: (...a: unknown[]) => mockDeleteCredential(...a),
}));
const mockSyncCredentialToHermesEnv = jest.fn();
jest.mock("@/modules/hermes/lib/hermes-env-sync", () => ({
  syncCredentialToHermesEnv: (...a: unknown[]) => mockSyncCredentialToHermesEnv(...a),
  removeCredentialFromHermesEnv: jest.fn(),
}));

const mockCreateModel = jest.fn();
const mockDeleteModel = jest.fn();
jest.mock("@/lib/models-repository", () => ({
  listModels: jest.fn(() => []),
  createModel: (...a: unknown[]) => mockCreateModel(...a),
  deleteModel: (...a: unknown[]) => mockDeleteModel(...a),
  MODEL_LIST_BOUNDS: { defaultLimit: 200, maxLimit: 500 },
}));
const mockSyncDefaultsToHermesConfig = jest.fn();
jest.mock("@/modules/hermes/lib/config-sync", () => ({
  syncDefaultsToHermesConfig: (...a: unknown[]) => mockSyncDefaultsToHermesConfig(...a),
}));

import { recordEvent } from "@/lib/analytics/record-event";
import { PUT as putScript } from "@/app/api/scripts/[name]/route";
import { POST as postRun } from "@/app/api/scripts/run/route";
import { POST as postHardwareCron } from "@/app/api/cron/hardware/route";
import { POST as postArtifact } from "@/app/api/artifacts/route";
import { POST as postCredential } from "@/app/api/credentials/route";
import { POST as postModel } from "@/app/api/models/route";
import { mockRequest } from "../helpers/api-test-helpers";

const refused = () =>
  NextResponse.json({ error: "Host-affecting writes are disabled while PS_AUTH_MODE=none." }, { status: 403 });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockHostWrites.mockReturnValue(null);
  mockCrontab = "\n";
  mockWriteRaw.mockResolvedValue({ ok: true });
  // No sidecar on disk: nothing is paused until a test says otherwise.
  mockReadFileSync.mockImplementation(() => {
    throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
  });
  mockSyncCredentialToHermesEnv.mockReturnValue({ backupPath: null });
  mockSyncDefaultsToHermesConfig.mockReturnValue({ backupPath: null });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── 18. script.saved ─────────────────────────────────────────────────────────

describe("PUT /api/scripts/[name] records script.saved", () => {
  const put = (name: string, body: unknown) =>
    putScript(mockRequest(`http://localhost/api/scripts/${name}`, "PUT", body), {
      params: Promise.resolve({ name }),
    });

  it("a new script is written, and the ledger names it", async () => {
    mockReadScriptContent.mockReturnValue(null);
    mockWriteScriptContent.mockReturnValue({ ok: true, created: true });

    const res = await put("ps-backup.mjs", { content: "console.log(1)" });

    expect(res.status).toBe(200);
    expect(mockWriteScriptContent).toHaveBeenCalledWith("ps-backup.mjs", "console.log(1)", "create");
    expect(recordEvent).toHaveBeenCalledWith(
      "script.saved",
      expect.objectContaining({ entityType: "script", entityId: "ps-backup.mjs" }),
    );
  });

  it("an existing script is updated, and the ledger names it", async () => {
    mockReadScriptContent.mockReturnValue("old");
    mockWriteScriptContent.mockReturnValue({ ok: true, created: false });

    const res = await put("ps-backup.mjs", { content: "new" });

    expect(res.status).toBe(200);
    expect(mockWriteScriptContent).toHaveBeenCalledWith("ps-backup.mjs", "new", "update");
    expect(recordEvent).toHaveBeenCalledWith(
      "script.saved",
      expect.objectContaining({ entityType: "script", entityId: "ps-backup.mjs" }),
    );
  });

  it("the writer answers not-ok: 400, and nothing is recorded", async () => {
    mockReadScriptContent.mockReturnValue(null);
    mockWriteScriptContent.mockReturnValue({ ok: false, error: "Invalid script name" });

    const res = await put("bad name.sh", { content: "x" });

    expect(res.status).toBe(400);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("the writer throws: 500, and nothing is recorded", async () => {
    mockReadScriptContent.mockReturnValue(null);
    mockWriteScriptContent.mockImplementation(() => {
      throw new Error("EACCES");
    });

    const res = await put("ps-backup.mjs", { content: "x" });

    expect(res.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("the host-writes guard refuses: 403, no write, nothing recorded", async () => {
    mockHostWrites.mockReturnValue(refused());

    const res = await put("ps-backup.mjs", { content: "x" });

    expect(res.status).toBe(403);
    expect(mockWriteScriptContent).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("content missing: 400 before any write, nothing recorded", async () => {
    const res = await put("ps-backup.mjs", { nope: true });

    expect(res.status).toBe(400);
    expect(mockWriteScriptContent).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

// ── 19. script.run ───────────────────────────────────────────────────────────

describe("POST /api/scripts/run records script.run", () => {
  const run = (body: unknown) => postRun(mockRequest("http://localhost/api/scripts/run", "POST", body));

  it("a script that exits 0 is recorded with its exit code", async () => {
    mockRunScriptFile.mockResolvedValue({ ok: true, exitCode: 0 });

    const res = await run({ name: "ps-backup.mjs" });

    expect(res.status).toBe(200);
    expect(mockRunScriptFile).toHaveBeenCalledWith("ps-backup.mjs");
    expect(recordEvent).toHaveBeenCalledWith(
      "script.run",
      expect.objectContaining({
        entityType: "script",
        entityId: "ps-backup.mjs",
        metadata: expect.objectContaining({ exitCode: 0 }),
      }),
    );
  });

  it("a script that exits non-zero still ran, and is recorded with that code", async () => {
    mockRunScriptFile.mockResolvedValue({ ok: false, exitCode: 2, error: "exit 2" });

    const res = await run({ name: "ps-backup.mjs" });

    expect(res.status).toBe(200);
    expect(recordEvent).toHaveBeenCalledWith(
      "script.run",
      expect.objectContaining({
        entityType: "script",
        entityId: "ps-backup.mjs",
        metadata: expect.objectContaining({ exitCode: 2 }),
      }),
    );
  });

  it("the host-writes guard refuses: 403, the script never runs, nothing recorded", async () => {
    mockHostWrites.mockReturnValue(refused());

    const res = await run({ name: "ps-backup.mjs" });

    expect(res.status).toBe(403);
    expect(mockRunScriptFile).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("the runner rejects: 500, nothing recorded", async () => {
    mockRunScriptFile.mockRejectedValue(new Error("spawn failed"));

    const res = await run({ name: "ps-backup.mjs" });

    expect(res.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("the script does not exist: 404, nothing ran, nothing recorded", async () => {
    mockRunScriptFile.mockResolvedValue({ ok: false, exitCode: null, error: "Script not found" });

    const res = await run({ name: "missing.mjs" });

    expect(res.status).toBe(404);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("name missing: 400, nothing recorded", async () => {
    const res = await run({});

    expect(res.status).toBe(400);
    expect(mockRunScriptFile).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

// ── 20. script.scheduled ─────────────────────────────────────────────────────

describe("POST /api/cron/hardware records script.scheduled", () => {
  const post = (body: unknown) => postHardwareCron(mockRequest("http://localhost/api/cron/hardware", "POST", body));

  it("a crontab line is installed for the script, and the ledger names the script", async () => {
    const res = await post({
      schedule: "*/5 * * * *",
      command: "/tmp/ch-data/scripts/ps-backup.mjs",
      name: "Backup",
    });

    expect(res.status).toBe(200);
    expect(mockWriteRaw).toHaveBeenCalledTimes(1);
    expect(mockWriteRaw.mock.calls[0][0]).toContain("/tmp/ch-data/scripts/ps-backup.mjs");
    expect(recordEvent).toHaveBeenCalledWith(
      "script.scheduled",
      expect.objectContaining({ entityType: "script", entityId: "ps-backup.mjs" }),
    );
  });

  it("the crontab write answers not-ok: 500, nothing recorded", async () => {
    mockWriteRaw.mockResolvedValue({ ok: false, error: "crontab: permission denied" });

    const res = await post({
      schedule: "*/5 * * * *",
      command: "/tmp/ch-data/scripts/ps-backup.mjs",
    });

    expect(res.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("the crontab write throws: 500, nothing recorded", async () => {
    mockWriteRaw.mockRejectedValue(new Error("crontab binary missing"));

    const res = await post({
      schedule: "*/5 * * * *",
      command: "/tmp/ch-data/scripts/ps-backup.mjs",
    });

    expect(res.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("schedule missing: 400, nothing written, nothing recorded", async () => {
    const res = await post({ command: "/tmp/ch-data/scripts/ps-backup.mjs" });

    expect(res.status).toBe(400);
    expect(mockWriteRaw).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("a script that is not in the scripts dir: 400, nothing written, nothing recorded", async () => {
    const res = await post({ schedule: "*/5 * * * *", command: "/tmp/ch-data/scripts/nope.mjs" });

    expect(res.status).toBe(400);
    expect(mockWriteRaw).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("the host-writes guard refuses: 403, nothing written, nothing recorded", async () => {
    mockHostWrites.mockReturnValue(refused());

    const res = await post({ schedule: "*/5 * * * *", command: "/tmp/ch-data/scripts/ps-backup.mjs" });

    expect(res.status).toBe(403);
    expect(mockWriteRaw).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("the pauseAll action shares the verb but schedules nothing: 200, nothing recorded", async () => {
    mockCrontab = "*/5 * * * * /tmp/ch-data/scripts/ps-backup.mjs >> /tmp/ch-data/logs/ps-backup.log 2>&1\n";

    const res = await post({ action: "pauseAll" });

    expect(res.status).toBe(200);
    // The branch ran: the paused ids reached the (doubled) sidecar, and the
    // crontab was rewritten with the line commented out, not a new schedule.
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    expect(String(mockWriteFileSync.mock.calls[0][0])).toContain(".disabled_hardware_crons.json");
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

// ── 21. artifact.saved ───────────────────────────────────────────────────────

describe("POST /api/artifacts records artifact.saved", () => {
  const post = (body: unknown) => postArtifact(mockRequest("http://localhost/api/artifacts", "POST", body));
  const ARTIFACT = {
    id: "a_1",
    sourceKind: "manual",
    sourceRunId: null,
    sourceNodeId: null,
    name: "notes",
    description: null,
    mimeType: "text/plain",
    content: "hello",
    tags: [],
    sizeBytes: 5,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("an artifact is created, and the ledger carries its id", async () => {
    mockCreateArtifact.mockReturnValue(ARTIFACT);

    const res = await post({ name: "notes", content: "hello" });

    expect(res.status).toBe(200);
    expect(mockCreateArtifact).toHaveBeenCalledWith(expect.objectContaining({ name: "notes", content: "hello" }));
    expect(recordEvent).toHaveBeenCalledWith(
      "artifact.saved",
      expect.objectContaining({ entityType: "artifact", entityId: "a_1" }),
    );
  });

  it("the repository throws: 500, nothing recorded", async () => {
    mockCreateArtifact.mockImplementation(() => {
      throw new Error("SQLITE_FULL");
    });

    const res = await post({ name: "notes", content: "hello" });

    expect(res.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("content missing: 400 before any row, nothing recorded", async () => {
    const res = await post({ name: "notes" });

    expect(res.status).toBe(400);
    expect(mockCreateArtifact).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

// ── 22. credential.added ─────────────────────────────────────────────────────

describe("POST /api/credentials records credential.added", () => {
  const post = (body: unknown) => postCredential(mockRequest("http://localhost/api/credentials", "POST", body));
  const CREDENTIAL = {
    id: "c_1",
    label: "Anthropic Personal",
    provider: "anthropic",
    keyHint: "sk-a...wxyz",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  const BODY = { label: "Anthropic Personal", provider: "anthropic", apiKey: "sk-realsecret" };

  it("the row is created and the key reaches the agent env: 201, recorded with the provider", async () => {
    mockCreateCredential.mockReturnValue(CREDENTIAL);

    const res = await post(BODY);

    expect(res.status).toBe(201);
    expect(mockSyncCredentialToHermesEnv).toHaveBeenCalledWith({ provider: "anthropic", apiKey: "sk-realsecret" });
    expect(recordEvent).toHaveBeenCalledWith(
      "credential.added",
      expect.objectContaining({
        entityType: "credential",
        entityId: "c_1",
        metadata: expect.objectContaining({ provider: "anthropic" }),
      }),
    );
  });

  it("the agent env sync fails after the row exists: 500, the row is rolled back, nothing recorded", async () => {
    mockCreateCredential.mockReturnValue(CREDENTIAL);
    mockSyncCredentialToHermesEnv.mockImplementation(() => {
      throw new Error(".env is not writable");
    });

    const res = await post(BODY);

    expect(res.status).toBe(500);
    expect(mockDeleteCredential).toHaveBeenCalledWith("c_1");
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("the repository throws: 500, nothing recorded", async () => {
    mockCreateCredential.mockImplementation(() => {
      throw new Error("SQLITE_BUSY");
    });

    const res = await post(BODY);

    expect(res.status).toBe(500);
    expect(mockSyncCredentialToHermesEnv).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("an unknown provider: 400 before any row, nothing recorded", async () => {
    const res = await post({ label: "x", provider: "weird", apiKey: "y" });

    expect(res.status).toBe(400);
    expect(mockCreateCredential).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

// ── 23. model.added ──────────────────────────────────────────────────────────

describe("POST /api/models records model.added", () => {
  const post = (body: unknown) => postModel(mockRequest("http://localhost/api/models", "POST", body));
  const MODEL = {
    id: "m_123",
    name: "Sonnet",
    provider: "anthropic",
    modelId: "anthropic/claude-sonnet-4",
    baseUrl: null,
    contextLength: 200000,
    credentialsId: null,
    defaults: {},
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  const BODY = { name: "Sonnet", provider: "anthropic", modelId: "anthropic/claude-sonnet-4", contextLength: 200000 };

  it("a model with no default slot is created: 201, recorded with the provider", async () => {
    mockCreateModel.mockReturnValue(MODEL);

    const res = await post(BODY);

    expect(res.status).toBe(201);
    expect(mockSyncDefaultsToHermesConfig).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith(
      "model.added",
      expect.objectContaining({
        entityType: "model",
        entityId: "m_123",
        metadata: expect.objectContaining({ provider: "anthropic" }),
      }),
    );
  });

  it("a model claiming a default slot is created and config re-synced: 201, recorded once", async () => {
    mockCreateModel.mockReturnValue({ ...MODEL, defaults: { agent: true } });

    const res = await post({ ...BODY, defaults: { agent: true } });

    expect(res.status).toBe(201);
    expect(mockSyncDefaultsToHermesConfig).toHaveBeenCalledTimes(1);
    expect(recordEvent).toHaveBeenCalledWith(
      "model.added",
      expect.objectContaining({
        entityType: "model",
        entityId: "m_123",
        metadata: expect.objectContaining({ provider: "anthropic" }),
      }),
    );
  });

  it("the repository throws: 500, nothing recorded", async () => {
    mockCreateModel.mockImplementation(() => {
      throw new Error("SQLITE_CONSTRAINT");
    });

    const res = await post(BODY);

    expect(res.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("the config sync fails after the row exists: 500, the row is rolled back, nothing recorded", async () => {
    mockCreateModel.mockReturnValue({ ...MODEL, defaults: { agent: true } });
    mockSyncDefaultsToHermesConfig.mockImplementation(() => {
      throw new Error("config.yaml refused");
    });

    const res = await post({ ...BODY, defaults: { agent: true } });

    expect(res.status).toBe(500);
    expect(mockDeleteModel).toHaveBeenCalledWith("m_123");
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("an unknown provider: 400 before any row, nothing recorded", async () => {
    const res = await post({ name: "x", provider: "not-a-provider", modelId: "x" });

    expect(res.status).toBe(400);
    expect(mockCreateModel).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });
});
