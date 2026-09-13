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

/**
 * The three defects an independent review found in the first version of this
 * rule, each pinned so it cannot come back.
 *
 * They are grouped together deliberately: two of them exist because the finding
 * that motivated this whole change was overstated, and one because a narrowing
 * went undisclosed. Getting the story of a heuristic wrong is how the next
 * person "fixes" it back.
 */
describe("severityOf: the review's findings", () => {
  it("counts npm ERR!, the commonest failure line in a Node project", () => {
    // The first version lost this. `ERR!` has no delimiter the tag pass
    // recognised, so it fell through to prose, where a bare `err` is
    // deliberately not an error word. It was classified info.
    expect(severityOf("npm ERR! code ELIFECYCLE")).toBe("error");
    expect(severityOf("npm ERR! errno 1")).toBe("error");
    expect(severityOf("npm ERR! Failed at the build script")).toBe("error");
  });

  it("does not count a zero-valued singular level field", () => {
    // `error: 0` matched the tag pass on `error:` and returned before the
    // zero-strike could run. The plural was already handled; the singular
    // was not.
    expect(severityOf("error: 0")).toBe("info");
    expect(severityOf("errors: 0")).toBe("info");
    expect(severityOf("error_count=0")).toBe("info");
  });

  it("leaves a bare err in prose alone, which is the disclosed narrowing", () => {
    // The old rule called this an error. This one does not, because `err` in
    // running text is as often the verb. Pinned so the trade is deliberate
    // rather than rediscovered as a bug.
    expect(severityOf("connection err after 3 tries")).toBe("info");
    expect(severityOf("to err is human")).toBe("info");
  });

  it("was never wrong about the plural, whatever the first write-up said", () => {
    // The old regex ended in \b and so could not match "errors" at all. These
    // two were cited as the motivation for the change and were already correct.
    expect(severityOf("Found 0 errors.")).toBe("info");
    expect(severityOf("completed with no errors")).toBe("info");
  });

  it("still catches what it is actually for", () => {
    expect(severityOf("[ERROR] database is locked")).toBe("error");
    expect(severityOf("Unhandled exception in worker")).toBe("error");
    expect(severityOf("level=error something broke")).toBe("error");
    expect(severityOf("[WARN] one probe failed")).toBe("warn");
  });
});
