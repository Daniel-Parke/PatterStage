/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// POST /api/scripts/run, on the difference between a script that failed and a
// script that never ran.
//
// The route answered every unhappy case the same way: `ok: false` with an exit
// code the runner had invented, which the page rendered as "exited non-zero,
// check Logs". For a missing interpreter or a spawn that was refused there is
// no log to check and no exit code to report, and the sentence sends the
// operator looking for output that was never produced.
//
// So the answer now carries the outcome, and the ledger records which of the
// two happened. `script.run` stays the record of a run that HAPPENED, exit code
// and all -- it is what the "run a script" quest is proved by, and a run that
// never started must not tick it. A run that could not start gets its own type,
// the way every other failure in the taxonomy does.
//
// The doubles mirror tests/unit/b4-emits-scripts-records.test.ts: the runner
// and the ledger are jest.fn, and the host-writes guard is steerable so the
// refusal can be exercised without touching the environment for the whole file.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

jest.mock("@/lib/api/api-logger", () => ({
  ...jest.requireActual("@/lib/api/api-logger"),
  logApiError: jest.fn(),
}));
jest.mock("@/lib/api/audit-log", () => ({ appendAuditLine: jest.fn() }));

const mockHostWrites = jest.fn<NextResponse | null, []>(() => null);
jest.mock("@/lib/api/api-auth", () => ({
  ...jest.requireActual("@/lib/api/api-auth"),
  requireAuthenticatedHostWrites: () => mockHostWrites(),
}));

const mockRunScriptFile = jest.fn();
jest.mock("@/lib/scripts/scripts-manager", () => ({
  runScriptFile: (...a: unknown[]) => mockRunScriptFile(...a),
}));

import { recordEvent } from "@/lib/analytics/record-event";
import { POST as postRun } from "@/app/api/scripts/run/route";
import { mockRequest } from "../helpers/api-test-helpers";

const run = (body: unknown) => postRun(mockRequest("http://localhost/api/scripts/run", "POST", body));

interface Envelope {
  data?: { name?: string; outcome?: string; exitCode?: number | null; ok?: boolean };
  error?: string;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockHostWrites.mockReturnValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("the answer says which of the three things happened", () => {
  it("a script that ran and succeeded", async () => {
    mockRunScriptFile.mockResolvedValue({ ok: true, outcome: "succeeded", exitCode: 0, logFile: "/l" });

    const res = await run({ name: "ps-backup.mjs" });
    const body = (await res.json()) as Envelope;

    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({ outcome: "succeeded", exitCode: 0 });
  });

  it("a script that ran and failed carries the code it returned", async () => {
    mockRunScriptFile.mockResolvedValue({ ok: false, outcome: "failed", exitCode: 2, error: "exit 2", logFile: "/l" });

    const res = await run({ name: "ps-backup.mjs" });
    const body = (await res.json()) as Envelope;

    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({ outcome: "failed", exitCode: 2 });
  });

  it("a script that could not be started is not a 200 with a failure inside it", async () => {
    // The B1 shape: a client that reads only the status must not be told this
    // worked. And the message is the reason, not an exit code that never was.
    mockRunScriptFile.mockResolvedValue({
      ok: false,
      outcome: "not-started",
      startFailure: "host-cannot-run",
      exitCode: null,
      error: "nothing on this machine can run .bat files",
      logFile: "/l",
    });

    const res = await run({ name: "ps-backup.bat" });
    const body = (await res.json()) as Envelope;

    expect(res.status).toBe(503);
    expect(body.error).toContain("did not start");
    expect(body.error).toContain("nothing on this machine can run .bat files");
  });

  it("a script that is not there is still a 404", async () => {
    mockRunScriptFile.mockResolvedValue({
      ok: false,
      outcome: "not-started",
      startFailure: "script-missing",
      exitCode: null,
      error: "Script not found under the scripts directory",
      logFile: "",
    });

    const res = await run({ name: "ghost.mjs" });

    expect(res.status).toBe(404);
  });
});

describe("the ledger records how the run went", () => {
  it("a run that succeeded is recorded as one", async () => {
    mockRunScriptFile.mockResolvedValue({ ok: true, outcome: "succeeded", exitCode: 0, logFile: "/l" });

    await run({ name: "ps-backup.mjs" });

    expect(recordEvent).toHaveBeenCalledWith(
      "script.run",
      expect.objectContaining({
        entityType: "script",
        entityId: "ps-backup.mjs",
        metadata: expect.objectContaining({ outcome: "succeeded", exitCode: 0 }),
      }),
    );
  });

  it("a run that failed is recorded as a run, with its outcome and its code", async () => {
    mockRunScriptFile.mockResolvedValue({ ok: false, outcome: "failed", exitCode: 2, logFile: "/l" });

    await run({ name: "ps-backup.mjs" });

    expect(recordEvent).toHaveBeenCalledWith(
      "script.run",
      expect.objectContaining({
        entityType: "script",
        entityId: "ps-backup.mjs",
        metadata: expect.objectContaining({ outcome: "failed", exitCode: 2 }),
      }),
    );
  });

  it("a run that never started is recorded, and is not recorded as a run", async () => {
    mockRunScriptFile.mockResolvedValue({
      ok: false,
      outcome: "not-started",
      startFailure: "host-cannot-run",
      exitCode: null,
      error: "nothing on this machine can run .bat files",
      logFile: "/l",
    });

    await run({ name: "ps-backup.bat" });

    expect(recordEvent).toHaveBeenCalledWith(
      "script.run_not_started",
      expect.objectContaining({
        entityType: "script",
        entityId: "ps-backup.bat",
        metadata: expect.objectContaining({ reason: "nothing on this machine can run .bat files" }),
      }),
    );
    // `script.run` is what the quest counts. A run that did not happen must
    // not tick it.
    expect(recordEvent).not.toHaveBeenCalledWith("script.run", expect.anything());
  });

  it("a script that is not there records nothing at all", async () => {
    mockRunScriptFile.mockResolvedValue({
      ok: false,
      outcome: "not-started",
      startFailure: "script-missing",
      exitCode: null,
      error: "Script not found under the scripts directory",
      logFile: "",
    });

    await run({ name: "ghost.mjs" });

    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("the host-writes guard refuses: nothing runs and nothing is recorded", async () => {
    mockHostWrites.mockReturnValue(
      NextResponse.json({ error: "Host-affecting writes are disabled." }, { status: 403 }),
    );

    const res = await run({ name: "ps-backup.mjs" });

    expect(res.status).toBe(403);
    expect(mockRunScriptFile).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });
});
