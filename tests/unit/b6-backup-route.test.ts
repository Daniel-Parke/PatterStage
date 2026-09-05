/** @jest-environment node */

// B6 (T-0100) oracle, group backups, the route half: `src/app/api/backup/route.ts`.
//
// Contract section 7, the route lines: GET answers `{ dbPath, dir, backups,
// restoreCommand }` from the helper and never guards (a read-only instance
// can still SEE its backups; check-read-only-guards and read-only-actually-
// reads stay green); POST names 'database backups' in its read-only refusal,
// takes a 'manual' snapshot, appends audit `backup.create`, records
// `backup.taken` AFTER the file exists and answers 201 `{ backup }`; a failed
// snapshot is a 500 "Failed to take a database backup" with an audit line
// that says ok false and NO event. The emit tests are in the b4-emits style:
// recordEvent is a jest.fn, the positive test pins the exact arguments, and
// the failure test proves the ledger stays empty.
//
// Written before the route exists, so the whole file is a suite-level red
// until `@/app/api/backup/route` and `@/lib/db/backup` both resolve. Every
// test here needs the route; nothing to split off. The helper is mocked (the
// global better-sqlite3 mock has no `backup`, and the helper has its own
// oracle in b6-database-backup.test.ts); PS_READ_ONLY is set per test and
// read by the REAL api-auth / read-only modules, as read-only-actually-reads
// does, because a mocked guard cannot prove the mode.

import { readFileSync } from "fs";
import { join } from "path";

jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/api-logger", () => ({
  // Spread the real module: the route may answer through serverErrorFromCatch
  // or through its sister serverErrorFromError, and the contract names neither.
  ...(jest.requireActual("@/lib/api-logger") as object),
  logApiError: jest.fn(),
}));

const DATA_DIR = "/srv/ps/data";
const DB_PATH = `${DATA_DIR}/control-hub.db`;
const BACKUPS_DIR = `${DATA_DIR}/backups/db`;

jest.mock("@/lib/paths", () => {
  // The literals live INSIDE the factory: jest hoists this above the consts
  // below, and the module graph pulls @/lib/paths in through api-auth while
  // those consts are still in their temporal dead zone.
  const dataDir = "/srv/ps/data";
  const dbPath = `${dataDir}/control-hub.db`;
  const actual = jest.requireActual("@/lib/paths") as typeof import("@/lib/paths");
  return {
    // readEnv is the real one: isReadOnly() reads PS_READ_ONLY through it,
    // and the read-only tests below are about the real environment variable.
    readEnv: actual.readEnv,
    PS_DATA_DIR: dataDir,
    getPsDataDir: () => dataDir,
    getDbPath: () => dbPath,
    getPsScriptsDir: () => `${dataDir}/scripts`,
    getPsHardwareLogDir: () => `${dataDir}/logs`,
    PATHS: {
      patterStageDb: dbPath,
      missions: `${dataDir}/missions`,
      templates: `${dataDir}/templates`,
      stories: `${dataDir}/stories`,
      recroom: `${dataDir}/recroom`,
      workspaces: `${dataDir}/workspaces`,
      auditLog: `${dataDir}/audit`,
      psScripts: `${dataDir}/scripts`,
      psHardwareLogs: `${dataDir}/logs`,
    },
  };
});

const mockListDatabaseBackups = jest.fn();
const mockSnapshotDatabase = jest.fn();
const mockRestoreCommand = jest.fn();
const mockDatabaseBackupsDir = jest.fn();
jest.mock("@/lib/db/backup", () => ({
  listDatabaseBackups: (...a: unknown[]) => mockListDatabaseBackups(...a),
  snapshotDatabase: (...a: unknown[]) => mockSnapshotDatabase(...a),
  restoreCommand: (...a: unknown[]) => mockRestoreCommand(...a),
  databaseBackupsDir: (...a: unknown[]) => mockDatabaseBackupsDir(...a),
  backupFileName: jest.fn(),
}));

import { recordEvent } from "@/lib/analytics/record-event";
import { appendAuditLine } from "@/lib/audit-log";
import * as route from "@/app/api/backup/route";

// The handlers, read off the namespace so the file type-checks before the
// route exists. GET takes nothing and POST takes nothing: no body, no
// request-derived path (contract).
type Handler = () => Promise<Response>;
const GET = (route as unknown as { GET: Handler }).GET;
const POST = (route as unknown as { POST: Handler }).POST;

const RESTORE = '# stop the server first\ncp "<backup file>" "/srv/ps/data/control-hub.db"\nrm -f "/srv/ps/data/control-hub.db-wal" "/srv/ps/data/control-hub.db-shm"\n# then start the server again';

const SNAPSHOT = {
  name: "control-hub.manual.2026-09-05T09-00-00-123Z.db",
  path: `${BACKUPS_DIR}/control-hub.manual.2026-09-05T09-00-00-123Z.db`,
  bytes: 3633152,
  takenAt: "2026-09-05T09:00:00.123Z",
  kind: "snapshot",
};

const LISTED = [
  SNAPSHOT,
  {
    name: "control-hub.db.pre-baseline-1779387782973",
    path: `${DATA_DIR}/control-hub.db.pre-baseline-1779387782973`,
    bytes: 303104,
    takenAt: "2026-05-21T18:23:02.973Z",
    kind: "migration",
  },
];

type Body = { data?: Record<string, unknown>; error?: string };
const bodyOf = async (res: Response) => (await res.json()) as Body;

const savedEnv = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.PS_READ_ONLY;
  delete process.env.CH_READ_ONLY;
  mockListDatabaseBackups.mockReturnValue(LISTED);
  mockSnapshotDatabase.mockResolvedValue(SNAPSHOT);
  mockRestoreCommand.mockReturnValue(RESTORE);
  mockDatabaseBackupsDir.mockReturnValue(BACKUPS_DIR);
});

afterEach(() => {
  process.env = { ...savedEnv };
});

// ═══════════════════════════════════════════════════════════════
// GET /api/backup
// ═══════════════════════════════════════════════════════════════

describe("GET /api/backup", () => {
  it("answers the database path, the directory, the helper's list and the restore command", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body.data).toEqual({
      dbPath: DB_PATH,
      dir: BACKUPS_DIR,
      backups: LISTED,
      restoreCommand: RESTORE,
    });
    expect(mockListDatabaseBackups).toHaveBeenCalledTimes(1);
    // The command is a template: the operator pastes the file they picked.
    expect(mockRestoreCommand).toHaveBeenCalledWith(DB_PATH, "<backup file>");
  });

  it("answers [] when the helper finds nothing, rather than an error", async () => {
    mockListDatabaseBackups.mockReturnValue([]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect((await bodyOf(res)).data?.backups).toEqual([]);
  });

  it("still answers under PS_READ_ONLY: a read-only mode that cannot list its backups cannot read", async () => {
    process.env.PS_READ_ONLY = "1";

    const res = await GET();

    expect(res.status).toBe(200);
    expect((await bodyOf(res)).data?.backups).toEqual(LISTED);
  });

  it("a listing that throws is a 500 that says so", async () => {
    mockListDatabaseBackups.mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    const res = await GET();

    expect(res.status).toBe(500);
    expect((await bodyOf(res)).error).toBe("Failed to list the database backups");
  });

});

// ═══════════════════════════════════════════════════════════════
// POST /api/backup
// ═══════════════════════════════════════════════════════════════

describe("POST /api/backup", () => {
  it("under PS_READ_ONLY refuses with a 503 that names the resource, and touches nothing", async () => {
    process.env.PS_READ_ONLY = "1";

    const res = await POST();

    expect(res.status).toBe(503);
    expect((await bodyOf(res)).error).toBe(
      "PatterStage is in read-only mode: database backups (unset PS_READ_ONLY to allow writes).",
    );
    expect(mockSnapshotDatabase).not.toHaveBeenCalled();
    expect(appendAuditLine).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("takes a 'manual' snapshot and answers 201 { backup }", async () => {
    const res = await POST();

    expect(res.status).toBe(201);
    expect((await bodyOf(res)).data).toEqual({ backup: SNAPSHOT });
    expect(mockSnapshotDatabase).toHaveBeenCalledTimes(1);
    expect(mockSnapshotDatabase.mock.calls[0]?.[0]).toBe("manual");
  });

  it("appends audit backup.create for the file it wrote", async () => {
    await POST();

    expect(appendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "backup.create", resource: SNAPSHOT.name, ok: true }),
    );
  });

  it("records backup.taken once, with exactly the file name, its size and the label, after the file exists", async () => {
    await POST();

    expect(recordEvent).toHaveBeenCalledTimes(1);
    expect(recordEvent).toHaveBeenCalledWith("backup.taken", {
      entityType: "backup",
      entityId: SNAPSHOT.name,
      metadata: { bytes: SNAPSHOT.bytes, label: "manual" },
    });
    // An event is written AFTER the write it describes, never before it.
    const snapshotOrder = mockSnapshotDatabase.mock.invocationCallOrder[0];
    const eventOrder = (recordEvent as jest.Mock).mock.invocationCallOrder[0];
    expect(snapshotOrder).toBeLessThan(eventOrder);
  });

  it("a snapshot that rejects is a 500, an audit line that says so, and nothing in the ledger", async () => {
    mockSnapshotDatabase.mockRejectedValue(new Error("SQLITE_IOERR: disk I/O error"));

    const res = await POST();

    expect(res.status).toBe(500);
    expect((await bodyOf(res)).error).toBe("Failed to take a database backup");
    expect(appendAuditLine).toHaveBeenCalledWith(expect.objectContaining({ action: "backup.create", ok: false }));
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("takes no body and no request, so no request-derived path can reach the filesystem", async () => {
    // The label is a server-side allow-list value and the directory is
    // server-derived. The handler's arity is the proof.
    expect(POST.length).toBe(0);
    expect(GET.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// the shape the gates read
// ═══════════════════════════════════════════════════════════════

describe("the route file, as the gates read it", () => {
  const file = join(__dirname, "..", "..", "src", "app", "api", "backup", "route.ts");
  const lines = () => readFileSync(file, "utf-8").split(/\r?\n/);

  it("declares GET and POST at column zero, so the canary and the guard check can see them", () => {
    const src = lines();
    expect(src.some((l) => /^export async function GET\(/.test(l))).toBe(true);
    expect(src.some((l) => /^export async function POST\(/.test(l))).toBe(true);
  });

  it("carries no read-only guard inside GET, and the guard inside POST", () => {
    // Mirrors check-read-only-guards.mjs: attribute each guard call to the
    // enclosing handler, skipping comment lines.
    const byMethod: Record<string, number> = {};
    let current = "";
    for (const raw of lines()) {
      const handler = /^export (?:async )?function (GET|HEAD|OPTIONS|POST|PUT|DELETE|PATCH)\b/.exec(raw);
      if (handler) current = handler[1];
      const t = raw.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
      if (/\b(requireAuth|requireNotReadOnly|isReadOnly)\s*\(/.test(raw)) {
        byMethod[current] = (byMethod[current] ?? 0) + 1;
      }
    }
    expect(byMethod.GET ?? 0).toBe(0);
    expect(byMethod.POST ?? 0).toBeGreaterThan(0);
  });
});
