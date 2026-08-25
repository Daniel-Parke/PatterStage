/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// The Logs panel's severity heuristic (T-0034, finding 1).
//
// Sibling of log-severity.test.ts, which covers detectSeverity() in LogSync.
// The two functions look alike and are not interchangeable: LogSync classifies
// lines it has ALREADY selected as failures, so an unlabelled line is an error
// there. This one classifies every line in the operator's current view, where
// the same fallback would paint the whole file red. See the header of
// src/components/logs/log-line-severity.ts.
//
// The deferred finding: severityOf() counted ANY line containing "error" or
// "fail" as an error, so `tsc` printing "Found 0 errors" and a job logging
// "completed with no errors" both landed in the error donut and pulled the
// clean-rate ring down with them. The numbers on the Logs panel were wrong in
// the one direction an operator cannot detect by eye, because a false error
// looks exactly like a real one.
//
// This is the oracle for the tightened rule, authored before it existed. It
// pins three things:
//
//   1. a logger's own level field wins over prose anywhere else on the line;
//   2. a negated or zero-counted mention is not an occurrence;
//   3. every genuine error shape the old rule caught is still caught, because
//      a heuristic that fixes a false positive by inventing a false negative
//      has moved the lie rather than removed it.
// ═══════════════════════════════════════════════════════════════

import { severityOf } from "@/components/logs/log-line-severity";

describe("a logger's own level field decides the line", () => {
  it.each([
    ["[ERROR] connection refused", "error"],
    ["ERROR: cannot open /var/run/hermes.sock", "error"],
    ["2026-08-25T10:00:00Z FATAL: out of memory", "error"],
    ['level=error msg="dispatch failed"', "error"],
    ["severity=CRITICAL disk full", "error"],
    ["[WARN] retrying in 5s", "warn"],
    ["WARNING: deprecated flag", "warn"],
    ['level=warn msg="slow query"', "warn"],
    ["[INFO] started", "info"],
    ["INFO: 3 sources synced", "info"],
  ])("%s -> %s", (line, expected) => {
    expect(severityOf(line)).toBe(expected);
  });

  it("lets an INFO tag outrank the word error later in the line", () => {
    // The line an operator reads as good news. The old rule read it as an error.
    expect(severityOf("[INFO] error budget still healthy")).toBe("info");
  });

  it("lets a WARN tag outrank the word failed later in the line", () => {
    // The same case LogSync's detectSeverity was fixed for, on the other side
    // of the app: a transient provider WARNING must not flood the error count.
    expect(severityOf("[WARN] one probe failed, retrying")).toBe("warn");
  });
});

describe("a negated or zero mention is not an occurrence", () => {
  it.each([
    "Found 0 errors",
    "Found 0 errors, 0 warnings",
    "no errors",
    "No errors found in 42 files",
    "completed with no errors",
    "finished without errors",
    "errors: 0",
    "error_count=0",
    "zero failures",
    "0 failed",
    "no failures reported",
    "no warnings",
    "warnings: 0",
  ])("%s counts as info", (line) => {
    expect(severityOf(line)).toBe("info");
  });
});

describe("genuine failures are still counted", () => {
  it.each([
    ["error: cannot open /var/run/hermes.sock", "error"],
    ["Traceback (most recent call last):", "error"],
    ["Uncaught exception in worker 3", "error"],
    ["mission dispatch failed", "error"],
    ["sync failure on source cron", "error"],
    ["Found 3 errors", "error"],
    ["errors: 4", "error"],
    ["1 failed", "error"],
    ["deprecated: this flag is a warning", "warn"],
    ["3 warnings", "warn"],
    ["listening on port 3471", "info"],
  ])("%s -> %s", (line, expected) => {
    expect(severityOf(line)).toBe(expected);
  });
});

describe("a word that merely contains a level name is not a level", () => {
  it.each([
    "errorProne.ts compiled",
    "loaded terrorism-dataset.json",
    "wrote failsafe.config",
    "warnings-as-values.md indexed",
  ])("%s counts as info", (line) => {
    expect(severityOf(line)).toBe("info");
  });
});

describe("the shape of the panel's own arithmetic", () => {
  // The clean-rate ring is 1 - errors/total, so a single false error on a
  // 20-line view moved the ring by five points. This holds the whole example
  // the finding was written about, end to end.
  it("reads a clean tsc run as clean", () => {
    const lines = ["> tsc --noEmit", "Found 0 errors, 0 warnings", "Done in 16.2s"];
    const errors = lines.filter((l) => severityOf(l) === "error").length;
    expect(errors).toBe(0);
  });
});
