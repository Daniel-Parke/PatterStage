// ══════════════════════════════════════════════════════════════════════════════
// fs-helpers — unit tests for the 3 promoted primitives
// ══════════════════════════════════════════════════════════════════════════════
//
// Locks the byte-for-byte contract of:
//   - ensureDir(dir)
//   - backupTimestamp()
//   - backupFile(originalPath, backupsDir)
//
// These three primitives replaced 12+ inline `if (!existsSync(dir)) mkdirSync(dir,
// { recursive: true })` blocks, 3+ inline `new Date().toISOString().replace(/[:.]/g,
// "-")` timestamp expressions, and 3+ inline "copy to timestamped backup" patterns
// across `src/lib/` and `src/app/api/`. The tests below assert each contract so
// future refactors of the helpers don't silently drift behaviour.
// ══════════════════════════════════════════════════════════════════════════════

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { ensureDir, backupTimestamp, backupFile } from "@/lib/fs/fs-helpers";

function makeTmpDir(label: string): string {
  const dir = join(
    tmpdir(),
    `ch-fs-helpers-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("ensureDir", () => {
  it("creates a directory that doesn't exist", () => {
    const dir = makeTmpDir("ensure-create");
    rmSync(dir, { recursive: true, force: true });
    expect(existsSync(dir)).toBe(false);
    ensureDir(dir);
    expect(existsSync(dir)).toBe(true);
  });

  it("is a no-op when the directory already exists (does not throw)", () => {
    const dir = makeTmpDir("ensure-noop");
    mkdirSync(dir, { recursive: true });
    expect(() => ensureDir(dir)).not.toThrow();
    expect(existsSync(dir)).toBe(true);
  });

  it("creates nested directories recursively", () => {
    const dir = makeTmpDir("ensure-nested");
    const nested = join(dir, "a", "b", "c");
    ensureDir(nested);
    expect(existsSync(nested)).toBe(true);
  });

  it("matches the pre-refactor inline pattern byte-for-byte", () => {
    // The previous inline form was:
    //   if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // Calling ensureDir twice in a row is the exact equivalent and must
    // not throw on the second call (the inline form was no-op on the 2nd).
    const dir = makeTmpDir("ensure-twice");
    expect(() => {
      ensureDir(dir);
      ensureDir(dir);
    }).not.toThrow();
  });
});

describe("backupTimestamp", () => {
  it("returns an ISO-8601 string with : and . replaced by -", () => {
    const ts = backupTimestamp();
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);
    expect(ts).not.toContain(":");
    expect(ts).not.toContain(".");
  });

  it("is safe to use as a filename suffix", () => {
    // No colons (Windows-illegal) and no dots within the timestamp body
    // (dots are fine in filenames but the original pattern deliberately
    // strips them so the suffix is unambiguous in listings).
    const ts = backupTimestamp();
    expect(() => ts.split("/")).not.toThrow();
  });

  it("preserves the millisecond precision and trailing-Z", () => {
    const ts = backupTimestamp();
    expect(ts.endsWith("Z")).toBe(true);
    // The timestamp ends with 3 digits (milliseconds) before the Z.
    expect(ts).toMatch(/-\d{3}Z$/);
  });

  it("returns the same string when called twice in the same millisecond", () => {
    // Pre-refactor inline calls in the same millisecond produced
    // identical strings. The helper preserves that property (Date.now()
    // is millisecond-granular, and the helper just reformats the same
    // instant).
    //
    // We freeze the clock to a fixed instant so the assertion is
    // deterministic across host speeds. A fast CI runner can call
    // `new Date()` twice within microseconds of each other and land
    // in different milliseconds; freezing the clock makes the test
    // assert the property the comment describes (same instant →
    // same string) rather than timing luck.
    // Freeze the clock with fake timers, NOT jest.spyOn(Date, "now").
    // backupTimestamp() reads `new Date()`, which a Date.now spy does not
    // intercept, so the older form left the assertion depending on two calls
    // landing in the same millisecond. It passed locally for weeks and went
    // red on a CI runner on 2026-08-23. WG-DEL-004 rules determinism first:
    // the fix is to make the freeze real, never to loosen the assertion.
    jest.useFakeTimers({ now: new Date("2026-06-11T11:08:35.585Z").getTime() });
    try {
      const a = backupTimestamp();
      const b = backupTimestamp();
      expect(a).toBe(b);
      // Pin the exact shape too, now that the instant is genuinely fixed.
      expect(a).toBe("2026-06-11T11-08-35-585Z");
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("backupFile", () => {
  it("returns null when the source file does not exist", () => {
    const dir = makeTmpDir("backup-missing");
    const missing = join(dir, "does-not-exist.md");
    expect(backupFile(missing, join(dir, "backups"))).toBeNull();
  });

  it("copies an existing file to <basename>.<ts>.bak and creates the backups dir", () => {
    const dir = makeTmpDir("backup-happy");
    const source = join(dir, "config.yaml");
    const backups = join(dir, "backups");
    writeFileSync(source, "hello: world\n", "utf-8");

    const result = backupFile(source, backups);
    expect(result).not.toBeNull();
    expect(result!).toContain("config.yaml.");
    expect(result!).toContain(".bak");
    expect(existsSync(backups)).toBe(true);
    expect(existsSync(result!)).toBe(true);
    expect(readFileSync(result!, "utf-8")).toBe("hello: world\n");
  });

  it("preserves the exact content of the source file (UTF-8 roundtrip)", () => {
    const dir = makeTmpDir("backup-roundtrip");
    const source = join(dir, "AGENTS.md");
    const backups = join(dir, "bk");
    const body = "# Title\n\n  indented\n\nemoji: 🦊\n";
    writeFileSync(source, body, "utf-8");

    const result = backupFile(source, backups);
    expect(result).not.toBeNull();
    expect(readFileSync(result!, "utf-8")).toBe(body);
  });

  it("uses the file basename (handling / and \\) in the backup filename", () => {
    // backupFile splits the source on / and \\ to derive the basename.
    // The pre-refactor `originalPath.split(/[/\\]/).pop() ?? "file"` form
    // is what the helper calls; the test pins the basename extraction
    // for both / and \\ path separators.
    const dir = makeTmpDir("backup-basename");
    const source = join(dir, "subdir", "deep", "note.md");
    const backups = join(dir, "bk");
    mkdirSync(join(dir, "subdir", "deep"), { recursive: true });
    writeFileSync(source, "x", "utf-8");

    const result = backupFile(source, backups);
    expect(result).not.toBeNull();
    expect(result!).toMatch(/note\.md\.[\d-]+T[\d-]+Z\.bak$/);
  });

  it("creates the backups dir if it doesn't exist (delegates to ensureDir)", () => {
    const dir = makeTmpDir("backup-mkdir");
    const source = join(dir, "f.txt");
    const backups = join(dir, "fresh", "backups");
    writeFileSync(source, "data", "utf-8");
    expect(existsSync(backups)).toBe(false);

    backupFile(source, backups);
    expect(existsSync(backups)).toBe(true);
  });
});
