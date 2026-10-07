/** @jest-environment node */

// Independent T-0204 ORACLE. The CLI is executed; its source is never imported.
// Real Git is forwarded. Only GITLEAKS_BIN=t0204-test-scanner is substituted.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type Scan = {
  args: string[]; timeout: number; root: string; freshReport: boolean;
  copied: { name: string; exists: boolean; matchesRoot: boolean }[];
  candidate: { sha256: string; length: number; letters: number; digits: number; other: boolean } | null;
  head: string; commits: number; committedFiles: string[]; plantedHistory: string[];
  status: number | null; signal: string | null; errorCode: string | null;
  findings: { RuleID: string; File: string; Commit: string }[] | "malformed" | null;
};
type Instrument = {
  mode: string; scannerSubstitute: boolean; normalProcessExit: number;
  roots: { path: string; created: boolean; existsAfter: boolean; removals: { recursive: boolean; force: boolean }[] }[];
  scans: Scan[];
  gitCalls: { timeout: number; status: number | null; errorCode: string | null }[];
};
type Outcome = { status: number; output: string; instrument: Instrument };
const calibratedBalancedHash = "b71d62069ae86ead306feee85b6107c8f79e179e5babc1adfdd81ff8073d3f38";
const cases = new Map<string, Outcome>();
let root: string;

function execute(mode: string, random = "letters"): Outcome {
  const key = `${mode}-${random}`;
  const cached = cases.get(key);
  if (cached) return cached;
  const receipt = join(root, `${key}.json`);
  const env: NodeJS.ProcessEnv = { ...process.env, GITLEAKS_BIN: "t0204-test-scanner", T0204_ORACLE_MODE: mode,
    T0204_ORACLE_RANDOM: random, T0204_ORACLE_RECEIPT: receipt };
  if (mode === "git-failure") {
    // Exercise a real OS launch failure. Git is never replaced by the preload.
    for (const name of Object.keys(env)) if (name.toLowerCase() === "path") delete env[name];
    env.PATH = root;
  }
  const child = spawnSync(process.execPath, ["--import", pathToFileURL(resolve("tests/helpers/secret-scan-canary-preload.mjs")).href,
    "tests/security/secret-scan-canary.mjs"], {
    encoding: "utf8", timeout: 20_000, maxBuffer: 1024 * 1024,
    env,
  });
  // Invalid test launch or missing instrumentation is infrastructure, not red.
  if (child.error || child.signal || child.status === null || !existsSync(receipt)) {
    throw new Error("T-0204 oracle CLI infrastructure failed");
  }
  const instrument = JSON.parse(readFileSync(receipt, "utf8")) as Instrument;
  const output = `${child.stdout}${child.stderr}`;
  if (output.includes("T-0204 oracle uncalibrated") || output.includes("T-0204 oracle candidate extraction")) {
    throw new Error("T-0204 oracle scanner control uncalibrated");
  }
  const outcome = { status: child.status, output, instrument };
  cases.set(key, outcome);
  return outcome;
}

function assertBoundary(outcome: Outcome): void {
  expect(outcome.instrument.scannerSubstitute).toBe(true);
  expect(outcome.instrument.normalProcessExit).toBe(outcome.status);
  expect(outcome.instrument.roots).toHaveLength(1);
  for (const owned of outcome.instrument.roots) {
    expect(owned).toMatchObject({ created: true, existsAfter: false });
    expect(owned.removals).toEqual([{ recursive: true, force: true }]);
    expect(existsSync(owned.path)).toBe(false);
  }
  expect(outcome.instrument.gitCalls.length).toBeGreaterThan(0);
  expect(outcome.instrument.gitCalls.every(call => call.timeout === 120_000)).toBe(true);
  for (const scan of outcome.instrument.scans) {
    expect(scan.timeout).toBe(120_000);
    expect(scan.freshReport).toBe(true);
    expect(scan.copied).toEqual([
      { name: ".gitleaks.toml", exists: true, matchesRoot: true },
      { name: ".gitleaksignore", exists: true, matchesRoot: true },
    ]);
    expect(scan.args.slice(0, 2)).toEqual(["git", "."]);
    expect(scan.args).toEqual(expect.arrayContaining(["--no-banner", "--redact=100", "--report-format", "json",
      "--config", join(scan.root, ".gitleaks.toml"), "--gitleaks-ignore-path", join(scan.root, ".gitleaksignore")]));
    expect(scan.commits).toBe(scan.candidate ? 2 : 1);
    if (scan.candidate) {
      expect(scan.committedFiles).toContain("planted.txt");
      expect(scan.plantedHistory).toEqual([scan.head]);
    }
  }
  // Compare boolean leak witnesses to avoid putting candidates in matcher output.
  const knownValues = ["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopA", Buffer.alloc(32).toString("base64url"),
    Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index) + String(index % 10)).join("")];
  expect(knownValues.some(value => outcome.output.includes(value))).toBe(false);
}

beforeAll(() => { root = mkdtempSync(join(tmpdir(), "t0204-cli-oracle-")); });
afterAll(() => {
  try {
    const destination = process.env.T0204_ORACLE_SUITE_RECEIPTS;
    if (destination) {
      mkdirSync(destination, { recursive: true });
      for (const [key, outcome] of cases) writeFileSync(join(destination, `${key}.json`), JSON.stringify(outcome, null, 2) + "\n");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

describe("T-0204 configured scanner CLI canary", () => {
  it("C01 accepts clean then calibrated balanced planted history with exact scanner witnesses", () => {
    const outcome = execute("normal");
    assertBoundary(outcome);
    expect(outcome.status).toBe(0);
    expect(outcome.instrument.scans).toHaveLength(2);
    expect(outcome.instrument.scans[0]).toMatchObject({ candidate: null, status: 0, findings: [] });
    expect(outcome.instrument.scans[1]).toMatchObject({ status: 1,
      findings: [{ RuleID: "generic-api-key", File: "planted.txt", Commit: outcome.instrument.scans[1].head }] });
  });

  it("C02 constructs one calibrated balanced noncredential independently of crypto output", () => {
    const candidates = [execute("normal", "letters"), execute("normal", "zeros")].map(outcome => {
      assertBoundary(outcome);
      expect(outcome.instrument.scans).toHaveLength(2);
      return outcome.instrument.scans[1].candidate;
    });
    expect(candidates).toEqual(Array(2).fill({ sha256: calibratedBalancedHash, length: 52, letters: 26, digits: 26, other: false }));
  });

  const refused = [
    ["C03 rejects findings in a clean scan even with exit zero", "clean-findings", "semantic"],
    ["C04 rejects scanner refusal of clean history as infrastructure", "clean-refusal", "infrastructure"],
    ["C05 rejects a completed planted scan that misses detection as semantic evidence", "miss", "semantic"],
    ["C06 rejects a planted report with the wrong rule", "wrong-rule", "semantic"],
    ["C07 rejects a planted report with the wrong file", "wrong-file", "semantic"],
    ["C08 rejects planted findings without required scanner exit one", "wrong-detection-exit", "semantic"],
    ["C09 rejects invalid planted scanner exit as infrastructure", "invalid-exit", "infrastructure"],
    ["C10 rejects scanner launch failure as infrastructure", "launch", "infrastructure"],
    ["C11 rejects scanner timeout as infrastructure", "timeout", "infrastructure"],
    ["C12 rejects a missing fresh JSON report as infrastructure", "missing-report", "infrastructure"],
    ["C13 rejects a malformed JSON report as infrastructure", "malformed-report", "infrastructure"],
    ["C14 rejects Git failure as infrastructure and cleans owned storage", "git-failure", "infrastructure"],
  ] as const;
  for (const [name, mode, classification] of refused) {
    it(name, () => {
      const outcome = execute(mode);
      assertBoundary(outcome);
      const witnesses: Record<string, Partial<Scan>> = {
        "clean-findings": { status: 0, findings: [{ RuleID: "generic-api-key", File: "clean.txt", Commit: outcome.instrument.scans[0]?.head || "" }] },
        "clean-refusal": { status: 2, findings: [] }, "miss": { status: 0, findings: [] },
        "wrong-rule": { status: 1, findings: [{ RuleID: "unrelated-rule", File: "planted.txt", Commit: outcome.instrument.scans[1]?.head || "" }] },
        "wrong-file": { status: 1, findings: [{ RuleID: "generic-api-key", File: "unrelated.txt", Commit: outcome.instrument.scans[1]?.head || "" }] },
        "wrong-detection-exit": { status: 0, findings: [{ RuleID: "generic-api-key", File: "planted.txt", Commit: outcome.instrument.scans[1]?.head || "" }] },
        "invalid-exit": { status: 2 }, "launch": { status: null, errorCode: "ENOENT" },
        "timeout": { status: null, errorCode: "ETIMEDOUT" }, "missing-report": { findings: null },
        "malformed-report": { findings: "malformed" },
      };
      if (mode === "git-failure") {
        expect(outcome.instrument.scans).toHaveLength(0);
        expect(outcome.instrument.gitCalls).toEqual([{ timeout: 120_000, status: null, errorCode: "ENOENT", args: ["init", "-q"], signal: null }]);
      } else {
        const plantedModes = ["miss", "wrong-rule", "wrong-file", "wrong-detection-exit", "invalid-exit"];
        expect(outcome.instrument.scans[plantedModes.includes(mode) ? 1 : 0]).toMatchObject(witnesses[mode]);
      }
      expect(outcome.status).not.toBe(0);
      // Error wording is flexible, but infrastructure must remain identifiable
      // and must not masquerade as a completed missed-detection result.
      const summary = outcome.output.split(/\r?\n/).find(line => /^(?:Error|SyntaxError|TypeError):/.test(line)) || "";
      const infrastructure = /infrastructure|ENOENT|ETIMEDOUT|unavailable|deadline|timed out|failed to launch|invalid.*exit|report.*(?:missing|malformed|invalid)|(?:missing|malformed|invalid).*report|JSON/i;
      expect(infrastructure.test(summary)).toBe(classification === "infrastructure");
      if (classification === "infrastructure") expect(/did not reject the planted history secret/i.test(outcome.output)).toBe(false);
    });
  }
});
