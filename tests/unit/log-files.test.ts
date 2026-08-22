import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import {
  categorizeLogFileGroup,
  compareLogFileNames,
  logValidationError,
  readLastLines,
  resolveLogFilePath,
  sanitizeLogBasename,
} from "@/lib/fs/log-files";

describe("sanitizeLogBasename", () => {
  it("accepts letters digits dot underscore hyphen", () => {
    expect(sanitizeLogBasename("ch-backup")).toBe("ch-backup");
    expect(sanitizeLogBasename("agent2")).toBe("agent2");
    expect(sanitizeLogBasename("my.log.file")).toBe("my.log.file");
  });

  it("strips optional .log suffix", () => {
    expect(sanitizeLogBasename("agent.log")).toBe("agent");
  });

  it("rejects path traversal and slashes", () => {
    expect(sanitizeLogBasename("../etc/passwd")).toBeNull();
    expect(sanitizeLogBasename("a/b")).toBeNull();
  });

  it("rejects empty and bad characters", () => {
    expect(sanitizeLogBasename("")).toBeNull();
    expect(sanitizeLogBasename("a b")).toBeNull();
    expect(sanitizeLogBasename("a;rm")).toBeNull();
  });
});

describe("logValidationError", () => {
  it("maps 'invalid-name' to 'Invalid log name'", () => {
    expect(logValidationError("invalid-name")).toBe("Invalid log name");
  });

  it("maps 'invalid-path' to 'Invalid log path'", () => {
    expect(logValidationError("invalid-path")).toBe("Invalid log path");
  });
});

describe("categorizeLogFileGroup", () => {
  it("classifies core and hardware", () => {
    expect(categorizeLogFileGroup("agent")).toBe("core");
    expect(categorizeLogFileGroup("ch-backup")).toBe("system");
    expect(categorizeLogFileGroup("custom")).toBe("other");
  });
});

describe("compareLogFileNames", () => {
  it("orders agent before gateway before zzz", () => {
    const names = ["zzz", "agent", "gateway"].sort(compareLogFileNames);
    expect(names).toEqual(["agent", "gateway", "zzz"]);
  });
});

describe("readLastLines", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "log-files-test-"));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns the last N lines of a normal multi-line file", () => {
    const file = join(dir, "many.log");
    const lines = Array.from({ length: 5000 }, (_, i) => `line ${i}`);
    writeFileSync(file, lines.join("\n"));

    const r = readLastLines(file, 200);
    expect(r.lines).toHaveLength(200);
    expect(r.allLines).toBe(5000);
    // lines are returned reversed (newest first)
    expect(r.lines[0]).toBe("line 4999");
  });

  // Regression: a file larger than the 64KB chunk size but containing fewer
  // total newlines than maxLines used to pin offset at 0 and spin forever,
  // blocking the Node event loop and taking down the whole server. The
  // start-of-file guard must let it return after reading the whole file once.
  it("terminates on a large file with fewer lines than maxLines (no infinite loop)", () => {
    const file = join(dir, "few-long-lines.log");
    // 10 lines of ~7KB each => ~70KB total, 9 newlines, > 64KB CHUNK_SIZE.
    const lines = Array.from({ length: 10 }, () => "X".repeat(7000));
    writeFileSync(file, lines.join("\n"));

    const start = Date.now();
    const r = readLastLines(file, 200);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000); // would hang (timeout) before the fix
    expect(r.lines).toHaveLength(10);
    expect(r.allLines).toBe(10);
    expect(r.lines.every((l) => l === "X".repeat(7000))).toBe(true);
  });

  it("handles a large file whose lines exactly straddle the chunk boundary", () => {
    const file = join(dir, "straddle.log");
    // 30 lines of ~5KB each => ~150KB, more than 2 chunks, fewer than maxLines.
    const lines = Array.from({ length: 30 }, (_, i) => `${i}:` + "Y".repeat(5000));
    writeFileSync(file, lines.join("\n"));

    const start = Date.now();
    const r = readLastLines(file, 200);
    expect(Date.now() - start).toBeLessThan(2000);
    expect(r.lines).toHaveLength(30);
    expect(r.allLines).toBe(30);
  });
});

describe("resolveLogFilePath", () => {
  const logsDir = "/tmp/test-logs";
  const resolvedLogsDir = "/tmp/test-logs";

  it("defaults to 'agent' when name is null", () => {
    const r = resolveLogFilePath(logsDir, resolvedLogsDir, null);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.safeName).toBe("agent");
      // resolve() (not a hardcoded POSIX string) keeps this portable: the
      // source uses path.resolve, which yields C:\… on Windows, /tmp/… on Linux.
      expect(r.absolutePath).toBe(resolve(logsDir, "agent.log"));
    }
  });

  it("defaults to 'agent' when name is empty or whitespace", () => {
    expect(resolveLogFilePath(logsDir, resolvedLogsDir, "")).toMatchObject({
      ok: true,
      safeName: "agent",
    });
    expect(resolveLogFilePath(logsDir, resolvedLogsDir, "   ")).toMatchObject({
      ok: true,
      safeName: "agent",
    });
  });

  it("returns ok with the sanitized name for a valid name", () => {
    const r = resolveLogFilePath(logsDir, resolvedLogsDir, "ch-backup");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.safeName).toBe("ch-backup");
      expect(r.absolutePath).toBe(resolve(logsDir, "ch-backup.log"));
    }
  });

  it("strips a trailing .log suffix from the input", () => {
    const r = resolveLogFilePath(logsDir, resolvedLogsDir, "agent.log");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.safeName).toBe("agent");
    }
  });

  it("rejects path traversal with reason 'invalid-name'", () => {
    expect(resolveLogFilePath(logsDir, resolvedLogsDir, "../etc/passwd")).toEqual({
      ok: false,
      reason: "invalid-name",
    });
    expect(resolveLogFilePath(logsDir, resolvedLogsDir, "a/b")).toEqual({
      ok: false,
      reason: "invalid-name",
    });
  });

  it("rejects bad characters with reason 'invalid-name'", () => {
    expect(resolveLogFilePath(logsDir, resolvedLogsDir, "a;rm")).toEqual({
      ok: false,
      reason: "invalid-name",
    });
    expect(resolveLogFilePath(logsDir, resolvedLogsDir, "a b")).toEqual({
      ok: false,
      reason: "invalid-name",
    });
  });
});
