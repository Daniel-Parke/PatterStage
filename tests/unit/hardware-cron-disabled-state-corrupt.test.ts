/** @jest-environment node */

// T-0060 acceptance oracle, second instance — a corrupt paused-jobs sidecar must
// not silently un-pause every hardware cron job.
//
// THE DEFECT, and it is the same shape as the config one beside it.
// `loadDisabledIds()` (disabled-state.ts:19-26) catches ANY error, a JSON parse
// failure included, and returns an empty Set. Crontab has no "disabled"
// concept, so that Set IS the record of which jobs the operator paused. Every
// mutating handler does load-mutate-save:
//
//   create.ts:41  loads, :55 saves
//   update.ts:57  loads, then applyDisabledChange saves
//   delete.ts:58  loads, then applyDisabledChange saves
//
// So one unreadable byte in `.disabled_hardware_crons.json` plus any subsequent
// cron edit rewrites the file with whatever survived the degrade, and every job
// the operator deliberately paused starts running again on its next tick. No
// error, no log, HTTP 200.
//
// THE DISTINCTION THAT MATTERS. Absent is not corrupt. A missing sidecar
// legitimately means "nothing has ever been paused" and must keep working. A
// present-but-unreadable one means the record exists and cannot be read, and
// writing over it is the loss. Today's blanket catch collapses the two.

const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockExistsSync = jest.fn();
const mockSetEnabled = jest.fn();
const mockWriteRaw = jest.fn(async () => ({ ok: true }));
const mockReadRaw = jest.fn(async () => CRONTAB);

// path.join() gives a backslash on Windows, so match on the basename rather
// than a hand-built path. A helper that silently matches nothing turns every
// assertion built on it green, which is the exact failure this batch exists to
// fix; `sidecarWrites` therefore has a companion assertion below proving it can
// see a write at all.
const SIDECAR_BASENAME = ".disabled_hardware_crons.json";
const isSidecar = (p: unknown) => String(p).endsWith(SIDECAR_BASENAME);

// Two managed jobs, one of which the operator has paused.
const CRONTAB = [
  "# PatterStage managed: ps-backup",
  "0 3 * * * /tmp/ch-data/scripts/ps-backup.sh",
  "# PatterStage managed: ps-restart",
  "0 4 * * * /tmp/ch-data/scripts/ps-restart.sh",
  "",
].join("\n");

jest.mock("child_process", () => ({
  execSync: jest.fn(() => ""),
  exec: jest.fn((_cmd, _opts, cb: (err: Error | null, stdout: string) => void) => {
    cb(null, "");
    return { on: jest.fn(), stdout: { on: jest.fn() }, stderr: { on: jest.fn() } };
  }),
}));

jest.mock("fs", () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  unlinkSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.mock("@/lib/api-auth", () => ({ isReadOnly: jest.fn(() => false) }));
jest.mock("@/lib/hardware-cron", () => ({ crontabLineUsesScriptsDir: jest.fn(() => true) }));
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(),
  serverErrorFromHelperResult: jest.fn(),
}));

jest.mock("@/lib/paths", () => ({
  PS_DATA_DIR: "/tmp/ch-data",
  getPsScriptsDir: () => "/tmp/ch-data/scripts",
  getPsHardwareLogDir: () => "/tmp/ch-data/logs",
}));

jest.mock("@/lib/host-scheduler", () => ({
  getHostScheduler: () => ({
    setEnabled: mockSetEnabled,
    readRaw: mockReadRaw,
    writeRaw: mockWriteRaw,
  }),
}));

import { NextRequest } from "next/server";

/** Truncated JSON: the file exists, holds two paused ids, and will not parse. */
const CORRUPT_SIDECAR = '["ps-backup", "ps-restart"';

function sidecarWrites(): string[] {
  return mockWriteFileSync.mock.calls.filter((c) => isSidecar(c[0])).map((c) => String(c[1]));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockImplementation((p: string) =>
    isSidecar(p) ? CORRUPT_SIDECAR : CRONTAB,
  );
});

describe("a corrupt paused-jobs sidecar is not treated as an empty one", () => {
  it("PUT does not overwrite the list it could not read", async () => {
    // The assertion that pins the loss: today this writes ["ps-restart"],
    // discarding ps-backup, which then starts running again.
    const { handleUpdateHardwareCron } = await import("@/lib/hardware-cron-handlers/update");

    await handleUpdateHardwareCron(
      new NextRequest("http://localhost/api/cron/hardware", {
        method: "PUT",
        body: JSON.stringify({ id: "ps-restart", enabled: false }),
      }),
    );

    expect(sidecarWrites()).toEqual([]);
  });

  it("PUT answers 409 and names the file the operator has to repair", async () => {
    const { handleUpdateHardwareCron } = await import("@/lib/hardware-cron-handlers/update");

    const res = await handleUpdateHardwareCron(
      new NextRequest("http://localhost/api/cron/hardware", {
        method: "PUT",
        body: JSON.stringify({ id: "ps-restart", enabled: false }),
      }),
    );
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/disabled_hardware_crons\.json/);
  });

  it("PUT does not flip the host scheduler before refusing", async () => {
    // A refusal that has already changed the machine is not a refusal.
    const { handleUpdateHardwareCron } = await import("@/lib/hardware-cron-handlers/update");

    await handleUpdateHardwareCron(
      new NextRequest("http://localhost/api/cron/hardware", {
        method: "PUT",
        body: JSON.stringify({ id: "ps-restart", enabled: false }),
      }),
    );

    expect(mockSetEnabled).not.toHaveBeenCalled();
  });

  it("DELETE refuses before it rewrites the crontab", async () => {
    // The one real ordering change in this batch. Today the read sits at
    // delete.ts:58, AFTER writeCrontab at :52, so refusing there would leave the
    // crontab already mutated and answer 409: a half-done operation.
    const { handleDeleteHardwareCron } = await import("@/lib/hardware-cron-handlers/delete");

    const res = await handleDeleteHardwareCron(
      new NextRequest("http://localhost/api/cron/hardware?id=ps-backup", { method: "DELETE" }),
    );

    expect(res.status).toBe(409);
    expect(mockWriteRaw).not.toHaveBeenCalled();
    expect(sidecarWrites()).toEqual([]);
  });

  it("a sidecar holding an object rather than an array is also a corruption", async () => {
    // Array.isArray is false, so today this degrades to an empty Set by a
    // different route and loses the same data.
    mockReadFileSync.mockImplementation((p: string) =>
      isSidecar(p) ? '{"ps-backup": true}' : CRONTAB,
    );
    const { handleUpdateHardwareCron } = await import("@/lib/hardware-cron-handlers/update");

    const res = await handleUpdateHardwareCron(
      new NextRequest("http://localhost/api/cron/hardware", {
        method: "PUT",
        body: JSON.stringify({ id: "ps-restart", enabled: false }),
      }),
    );

    expect(res.status).toBe(409);
    expect(sidecarWrites()).toEqual([]);
  });
});

describe("the read path keeps degrading, because a read that refuses to read is its own defect", () => {
  it("GET still lists the jobs when the sidecar is unparseable", async () => {
    // GREEN CONTROL, and load-bearing. It is the exact analogue of "GET
    // /api/config keeps returning {}", and it is what stops this fix being
    // implemented as "throw from loadDisabledIds", which would 500 the cron page
    // and strand the operator on the surface they need in order to fix it.
    const { handleListHardwareCrons } = await import("@/lib/hardware-cron-handlers/list");

    const res = await handleListHardwareCrons();
    const body = (await res.json()) as { data?: { jobs?: unknown[] } };

    expect(res.status).toBe(200);
    expect(body.data?.jobs?.length).toBe(2);
  });

  it("an absent sidecar is not a corruption", async () => {
    // GREEN CONTROL. Nothing has ever been paused, which is a perfectly ordinary
    // state and must keep working. This pins the absent/corrupt distinction that
    // is the entire point of the change.
    mockExistsSync.mockImplementation((p: string) => !isSidecar(p));
    mockReadFileSync.mockImplementation((p: string) => {
      if (isSidecar(p)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      return CRONTAB;
    });
    const { handleUpdateHardwareCron } = await import("@/lib/hardware-cron-handlers/update");

    const res = await handleUpdateHardwareCron(
      new NextRequest("http://localhost/api/cron/hardware", {
        method: "PUT",
        body: JSON.stringify({ id: "ps-restart", enabled: false }),
      }),
    );

    expect(res.status).toBe(200);
    expect(sidecarWrites()).toEqual(['[\n  "ps-restart"\n]']);
  });
});
