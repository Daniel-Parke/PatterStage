/** @jest-environment node */
import { createHash } from "node:crypto";
import { existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { NextRequest } from "next/server";

import { listLogFilesInDir } from "@/lib/fs/log-files";

let mockLogsDir = "";
jest.mock("@/lib/runtime/workspace", () => ({ getAgentWorkspace: () => ({ logs: mockLogsDir }) }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

const PREFIX = "patterstage-t0181-alias-";
const MARKER = "OUTSIDE_SENTINEL_MUST_NOT_LEAK";

function digest(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("T-0181 log alias amendment through a real filesystem", () => {
  let root: string;
  let sentinel: string;
  let originalDigest: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), PREFIX));
    mockLogsDir = join(root, "logs");
    mkdirSync(mockLogsDir);
    sentinel = join(root, "outside-sentinel.txt");
    writeFileSync(sentinel, `${MARKER}\n`);
    originalDigest = digest(sentinel);
    writeFileSync(join(mockLogsDir, "agent.log"), "ordinary log line\n");
  });

  afterEach(() => {
    if (!existsSync(root)) return;
    const actual = realpathSync(root);
    if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
      throw new Error("Refusing to remove a non-fixture directory");
    }
    rmSync(actual, { recursive: true, force: true });
  });

  function plantHardlink(): void {
    linkSync(sentinel, join(mockLogsDir, "x.log"));
    expect(readFileSync(join(mockLogsDir, "x.log"), "utf8")).toContain(MARKER);
  }

  function plantDanglingLink(): void {
    const link = join(mockLogsDir, "x.log");
    const absent = join(root, "never-created-target.log");
    symlinkSync(absent, link, process.platform === "win32" ? "junction" : "file");
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(existsSync(link)).toBe(false);
  }

  it("GET refuses an in-root hardlink without exposing outside bytes", async () => {
    plantHardlink();
    const { GET } = await import("@/app/api/logs/route");

    const response = await GET(new Request("http://localhost/api/logs?name=x") as NextRequest);
    const leaked = (await response.text()).includes(MARKER);

    expect({ status: response.status, leaked, sentinelDigest: digest(sentinel) }).toEqual({
      status: 400,
      leaked: false,
      sentinelDigest: originalDigest,
    });
  });

  it("named DELETE refuses an in-root hardlink without truncating outside bytes", async () => {
    plantHardlink();
    const { DELETE } = await import("@/app/api/logs/route");

    const response = await DELETE(new Request("http://localhost/api/logs?name=x", { method: "DELETE" }) as NextRequest);

    expect({ status: response.status, sentinelDigest: digest(sentinel) }).toEqual({
      status: 400,
      sentinelDigest: originalDigest,
    });
  });

  it("bulk DELETE clears a regular log but never an outside hardlinked file", async () => {
    plantHardlink();
    const { DELETE } = await import("@/app/api/logs/route");

    const response = await DELETE(new Request("http://localhost/api/logs", { method: "DELETE" }) as NextRequest);
    const body = await response.json() as { data?: { cleared?: number } };

    expect({
      status: response.status,
      cleared: body.data?.cleared,
      regularContent: readFileSync(join(mockLogsDir, "agent.log"), "utf8"),
      sentinelDigest: digest(sentinel),
    }).toEqual({ status: 200, cleared: 1, regularContent: "", sentinelDigest: originalDigest });
  });

  it("GET refuses a dangling log symlink instead of reporting a missing file", async () => {
    plantDanglingLink();
    const { GET } = await import("@/app/api/logs/route");

    const response = await GET(new Request("http://localhost/api/logs?name=x") as NextRequest);

    expect(response.status).toBe(400);
    expect(digest(sentinel)).toBe(originalDigest);
  });

  it("named DELETE refuses a dangling log symlink instead of reporting success", async () => {
    plantDanglingLink();
    const { DELETE } = await import("@/app/api/logs/route");

    const response = await DELETE(new Request("http://localhost/api/logs?name=x", { method: "DELETE" }) as NextRequest);

    expect(response.status).toBe(400);
    expect(digest(sentinel)).toBe(originalDigest);
  });

  it("bulk DELETE ignores a dangling alias while clearing a regular log", async () => {
    plantDanglingLink();
    const { DELETE } = await import("@/app/api/logs/route");

    const response = await DELETE(new Request("http://localhost/api/logs", { method: "DELETE" }) as NextRequest);
    const body = await response.json() as { data?: { cleared?: number } };

    expect({
      status: response.status,
      cleared: body.data?.cleared,
      regularContent: readFileSync(join(mockLogsDir, "agent.log"), "utf8"),
      sentinelDigest: digest(sentinel),
    }).toEqual({ status: 200, cleared: 1, regularContent: "", sentinelDigest: originalDigest });
  });

  it("still lists, reads and clears a regular log", async () => {
    expect(listLogFilesInDir(mockLogsDir).map((file) => file.name)).toContain("agent");
    const { GET, DELETE } = await import("@/app/api/logs/route");

    const read = await GET(new Request("http://localhost/api/logs?name=agent") as NextRequest);
    expect(read.status).toBe(200);
    expect(await read.text()).toContain("ordinary log line");

    const cleared = await DELETE(new Request("http://localhost/api/logs?name=agent", { method: "DELETE" }) as NextRequest);
    expect(cleared.status).toBe(200);
    expect(readFileSync(join(mockLogsDir, "agent.log"), "utf8")).toBe("");
    expect(digest(sentinel)).toBe(originalDigest);
  });
});
