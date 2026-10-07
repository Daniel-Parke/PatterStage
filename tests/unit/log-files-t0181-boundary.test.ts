/** @jest-environment node */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { NextRequest } from "next/server";

import { listLogFilesInDir, logFileUnderLogsDir } from "@/lib/fs/log-files";

let mockLogsDir = "";
jest.mock("@/lib/runtime/workspace", () => ({ getAgentWorkspace: () => ({ logs: mockLogsDir }) }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

const PREFIX = "patterstage-t0181-";
const linuxOnly = process.platform === "linux" ? it : it.skip;

function digest(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("T-0181 log-file containment through a real filesystem", () => {
  let root: string;
  let sentinel: string;
  let originalDigest: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), PREFIX));
    sentinel = join(root, "outside-sentinel.txt");
    writeFileSync(sentinel, "OUTSIDE_SENTINEL_MUST_NOT_LEAK\n");
    originalDigest = digest(sentinel);
    mockLogsDir = join(root, "logs");
    mkdirSync(mockLogsDir);
    writeFileSync(join(mockLogsDir, "agent.log"), "ordinary log line\n");
  });

  afterEach(() => {
    if (existsSync(root)) {
      const actual = realpathSync(root);
      if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
        throw new Error("Refusing to remove a non-fixture directory");
      }
      rmSync(actual, { recursive: true, force: true });
    }
  });

  it("rejects a symlinked entry even when its lexical path is under the log root", () => {
    const outside = join(root, "outside-directory");
    mkdirSync(outside);
    const link = join(mockLogsDir, "x.log");
    symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
    expect(logFileUnderLogsDir(mockLogsDir, link)).toBe(false);
    expect(listLogFilesInDir(mockLogsDir).map((file) => file.name)).not.toContain("x");
  });

  linuxOnly("GET refuses a linked outside file without exposing its bytes", async () => {
    symlinkSync(sentinel, join(mockLogsDir, "x.log"));
    const { GET } = await import("@/app/api/logs/route");
    const response = await GET(new Request("http://localhost/api/logs?name=x") as NextRequest);
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("OUTSIDE_SENTINEL_MUST_NOT_LEAK");
    expect(digest(sentinel)).toBe(originalDigest);
  });

  linuxOnly("named DELETE refuses a linked outside file and leaves the sentinel intact", async () => {
    symlinkSync(sentinel, join(mockLogsDir, "x.log"));
    const { DELETE } = await import("@/app/api/logs/route");
    const response = await DELETE(new Request("http://localhost/api/logs?name=x", { method: "DELETE" }) as NextRequest);
    expect(response.status).toBe(400);
    expect(digest(sentinel)).toBe(originalDigest);
  });

  linuxOnly("bulk DELETE clears an ordinary log but never the linked sentinel", async () => {
    symlinkSync(sentinel, join(mockLogsDir, "x.log"));
    const { DELETE } = await import("@/app/api/logs/route");
    const response = await DELETE(new Request("http://localhost/api/logs", { method: "DELETE" }) as NextRequest);
    expect(response.status).toBe(200);
    expect(readFileSync(join(mockLogsDir, "agent.log"), "utf8")).toBe("");
    expect(digest(sentinel)).toBe(originalDigest);
  });

  it("still reads and clears an ordinary in-root log", async () => {
    const { GET, DELETE } = await import("@/app/api/logs/route");
    const response = await GET(new Request("http://localhost/api/logs?name=agent") as NextRequest);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("ordinary log line");
    const cleared = await DELETE(new Request("http://localhost/api/logs?name=agent", { method: "DELETE" }) as NextRequest);
    expect(cleared.status).toBe(200);
    expect(readFileSync(join(mockLogsDir, "agent.log"), "utf8")).toBe("");
  });
});
