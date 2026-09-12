/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// The Scripts manager, on the two things a run has never been able to say.
//
// 1. A SCRIPT THAT NEVER STARTED IS NOT A SCRIPT THAT FAILED. `runScriptFile`
//    answered `{ ok: false, exitCode: 1 }` for a spawn that never happened,
//    because `err ? 1 : 0` cannot tell ENOENT from exit status 1. The page
//    then said "exited non-zero, check Logs" and sent the operator to a log
//    with nothing in it. The three cases are different facts and the result
//    now names which one happened.
//
// 2. NOTHING READ THE OUTCOME BACK. The ledger has recorded `script.run` since
//    B4, and no surface has ever asked it a question, so "did last night's
//    backup work?" had no answer once the toast had gone. `listScriptFiles`
//    now carries the last recorded outcome for each file.
//
// The doubles: child_process, fs, the interpreter table and the ledger reader
// are all jest.fn, so what the runner did NOT do (spawn, at all) is as
// assertable as what it did.
// ═══════════════════════════════════════════════════════════════

jest.mock("@/lib/host/paths", () => ({
  getPsScriptsDir: () => "/data/scripts",
  getPsHardwareLogDir: () => "/data/logs",
}));

const FILES = ["ps-db-backup.mjs", "legacy.sh"];

const appendFileSync = jest.fn();
jest.mock("fs", () => ({
  // Everything exists except the one name a test asks about by that name.
  existsSync: (p: string) => !String(p).includes("ghost"),
  readdirSync: () => FILES,
  statSync: () => ({ size: 10, mtime: new Date("2026-09-01T00:00:00.000Z") }),
  readFileSync: jest.fn(),
  appendFileSync: (...a: unknown[]) => appendFileSync(...a),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  chmodSync: jest.fn(),
}));

const interpreterFor = jest.fn<{ cmd: string; args: string[] } | null, [string]>();
jest.mock("@/lib/host/platform", () => ({
  interpreterFor: (abs: string) => interpreterFor(abs),
}));

jest.mock("@/lib/host/host-scheduler", () => ({
  getHostScheduler: () => ({
    readRaw: async () => "\n",
    writeRaw: async () => ({ ok: true }),
    setEnabled: async () => undefined,
  }),
  hostSchedulerAvailability: () => ({ available: true, reason: "crontab" }),
}));

jest.mock("@/lib/schedule/schedules-repository", () => ({
  listScriptSchedules: () => [],
}));

interface LedgerRow {
  entityId: string;
  eventType: string;
  createdAt: string;
  metadataJson: string | null;
}
const latestEventPerEntity = jest.fn<LedgerRow[], unknown[]>(() => []);
jest.mock("@/lib/analytics/analytics-repository", () => ({
  latestEventPerEntity: (...a: unknown[]) => latestEventPerEntity(...a),
}));

/** The error execFile hands back, in each of the shapes node actually produces. */
type ExecError = Error & { code?: number | string; killed?: boolean; signal?: string };
type ExecCb = (err: ExecError | null, stdout: string, stderr: string) => void;
const execFile = jest.fn();
jest.mock("child_process", () => ({
  execFile: (...a: unknown[]) => execFile(...a),
}));

import { listScriptFiles, runScriptFile, type ScriptFile } from "@/lib/scripts/scripts-manager";

/** Make execFile answer with one of node's real error shapes (or none). */
function execAnswers(err: ExecError | null, stdout = "", stderr = ""): void {
  execFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: ExecCb) =>
    cb(err, stdout, stderr),
  );
}

function execError(fields: Partial<ExecError> & { message?: string }): ExecError {
  return Object.assign(new Error(fields.message ?? "Command failed"), fields) as ExecError;
}

/** Every string this run appended to the script's log, joined. */
function logged(): string {
  return appendFileSync.mock.calls.map((c) => String(c[1])).join("");
}

beforeEach(() => {
  jest.clearAllMocks();
  interpreterFor.mockReturnValue({ cmd: "/usr/bin/node", args: ["/data/scripts/ps-db-backup.mjs"] });
  execAnswers(null, "done\n", "");
  latestEventPerEntity.mockReturnValue([]);
});

// ═══════════════════════════════════════════════════════════════
// 1. Which of the three things happened
// ═══════════════════════════════════════════════════════════════

describe("runScriptFile says whether the script ran", () => {
  it("a script that exits zero succeeded", async () => {
    const r = await runScriptFile("ps-db-backup.mjs");
    expect(r).toMatchObject({ ok: true, outcome: "succeeded", exitCode: 0 });
  });

  it("a script that ran and exited non-zero failed, and keeps its code", async () => {
    execAnswers(execError({ code: 2 }));
    const r = await runScriptFile("ps-db-backup.mjs");
    expect(r).toMatchObject({ ok: false, outcome: "failed", exitCode: 2 });
  });

  it("an interpreter that could not be spawned never ran: not a non-zero exit", async () => {
    // Node's spawn failure: a STRING code, and no exit status at all. The old
    // reader turned this into exitCode 1, which is a lie about a run that
    // never happened.
    execAnswers(execError({ code: "ENOENT", message: "spawn /usr/bin/node ENOENT" }));
    const r = await runScriptFile("ps-db-backup.mjs");
    expect(r.outcome).toBe("not-started");
    expect(r.startFailure).toBe("host-cannot-run");
    expect(r.exitCode).toBeNull();
    expect(r.error).toContain("/usr/bin/node");
  });

  it("a machine with no interpreter for that file type does not spawn anything", async () => {
    interpreterFor.mockReturnValue(null);
    const r = await runScriptFile("legacy.sh");
    expect(execFile).not.toHaveBeenCalled();
    expect(r.outcome).toBe("not-started");
    expect(r.startFailure).toBe("host-cannot-run");
    expect(r.exitCode).toBeNull();
    expect(r.error).toContain(".sh");
  });

  it("a script that is not in the scripts folder did not start either", async () => {
    const r = await runScriptFile("ghost.sh");
    expect(execFile).not.toHaveBeenCalled();
    // The route tells these two apart on this field: a script that is not
    // there is a 404, a host that cannot run one is not.
    expect(r).toMatchObject({ ok: false, outcome: "not-started", startFailure: "script-missing", exitCode: null });
  });

  it("a run stopped by the time limit DID run, so it is a failure and not a non-start", async () => {
    // killed + a signal is node saying it started the process and then killed
    // it. Reading the string code alone would file this as "never started".
    execAnswers(execError({ code: null as unknown as number, killed: true, signal: "SIGTERM" }));
    const r = await runScriptFile("ps-db-backup.mjs");
    expect(r.outcome).toBe("failed");
    expect(r.error).toMatch(/stopped/i);
  });

  it("writes the reason into the log, so Logs is not an empty room", async () => {
    interpreterFor.mockReturnValue(null);
    await runScriptFile("legacy.sh");
    expect(logged()).toMatch(/did not start/i);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. The list carries the last recorded outcome
// ═══════════════════════════════════════════════════════════════

function ledger(entityId: string, eventType: string, metadata: unknown, createdAt = "2026-09-02T01:00:00Z"): LedgerRow {
  return { entityId, eventType, createdAt, metadataJson: metadata === null ? null : JSON.stringify(metadata) };
}

async function rows(): Promise<Record<string, ScriptFile>> {
  const out: Record<string, ScriptFile> = {};
  for (const f of await listScriptFiles()) out[f.name] = f;
  return out;
}

describe("listScriptFiles answers 'did last night's backup work?'", () => {
  it("carries the outcome, the time and the exit code of the last recorded run", async () => {
    latestEventPerEntity.mockReturnValue([
      ledger("ps-db-backup.mjs", "script.run", { outcome: "succeeded", exitCode: 0 }),
    ]);
    const r = (await rows())["ps-db-backup.mjs"];
    expect(r.lastOutcome).toBe("succeeded");
    expect(r.lastOutcomeAt).toBe("2026-09-02T01:00:00Z");
    expect(r.lastExitCode).toBe(0);
  });

  it("carries a failure as a failure", async () => {
    latestEventPerEntity.mockReturnValue([
      ledger("ps-db-backup.mjs", "script.run", { outcome: "failed", exitCode: 2 }),
    ]);
    const r = (await rows())["ps-db-backup.mjs"];
    expect(r.lastOutcome).toBe("failed");
    expect(r.lastExitCode).toBe(2);
  });

  it("carries a run that never started as one", async () => {
    latestEventPerEntity.mockReturnValue([
      ledger("ps-db-backup.mjs", "script.run_not_started", { reason: "nothing here runs .bat files" }),
    ]);
    const r = (await rows())["ps-db-backup.mjs"];
    expect(r.lastOutcome).toBe("not-started");
    expect(r.lastExitCode).toBeNull();
  });

  it("reads an older row, written before the outcome was recorded, from its exit code", async () => {
    latestEventPerEntity.mockReturnValue([ledger("ps-db-backup.mjs", "script.run", { exitCode: 1 })]);
    expect((await rows())["ps-db-backup.mjs"].lastOutcome).toBe("failed");
  });

  it("claims nothing for a row that carries neither an outcome nor a code", async () => {
    latestEventPerEntity.mockReturnValue([ledger("ps-db-backup.mjs", "script.run", { source: "scheduler" })]);
    const r = (await rows())["ps-db-backup.mjs"];
    expect(r.lastOutcome).toBeNull();
    // The log's own timestamp is still there: the row can say when, just not how.
    expect(r.lastRun).toBe("2026-09-01T00:00:00.000Z");
  });

  it("says nothing about a script the ledger has never seen", async () => {
    latestEventPerEntity.mockReturnValue([ledger("ps-db-backup.mjs", "script.run", { outcome: "succeeded" })]);
    const r = (await rows())["legacy.sh"];
    expect(r.lastOutcome).toBeNull();
    expect(r.lastOutcomeAt).toBeNull();
  });

  it("still lists the files when there is no database to read yet", async () => {
    // Same reason listScriptSchedules is wrapped: this route must answer
    // before the database has been bootstrapped.
    latestEventPerEntity.mockImplementation(() => {
      throw new Error("no such table: analytics_events");
    });
    const r = await rows();
    expect(Object.keys(r).sort()).toEqual(["legacy.sh", "ps-db-backup.mjs"]);
    expect(r["ps-db-backup.mjs"].lastOutcome).toBeNull();
  });
});
