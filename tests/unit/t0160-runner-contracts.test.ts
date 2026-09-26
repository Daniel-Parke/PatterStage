/** @jest-environment node */

import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as gate from "../../scripts/tooling/gate.mjs";
import * as sweep from "../../scripts/tooling/mutation-sweep.mjs";

type GateContracts = {
  stampTree(root: string): string;
  parseGateArgs(args: string[]): { kind: string; planned: { name: string }[]; evidenceFile: string };
};
type SweepContracts = {
  selectMutants(manifest: { task: string; mutants: unknown[] }, onlyId?: string | null): unknown[];
  assessJestRun(run: { status: number | null; report?: Record<string, unknown> }, expected: string[]): string;
  sweepAtRoot(root: string, manifestPath: string, onlyId: string | null, runner: (tests: string[]) => unknown): number;
};
const gateContract = gate as unknown as GateContracts;
const sweepContract = sweep as unknown as SweepContracts;

function git(root: string, ...args: string[]) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function repository(files: Record<string, string>, verify: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), "ps-t0160-"));
  try {
    git(root, "init", "--quiet");
    for (const [name, content] of Object.entries(files)) {
      const path = join(root, name);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, content);
    }
    git(root, "add", ".");
    git(root, "-c", "user.name=Oracle", "-c", "user.email=oracle@example.invalid", "commit", "--quiet", "-m", "fixture");
    verify(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const manifest = {
  task: "T-0160",
  mutants: [{ id: "m1", file: "source.txt", anchor: "good", replacement: "broken", tests: ["oracle.test.ts"], why: "the oracle must detect a broken value" }],
};

function jestReport(file: string, failed: boolean) {
  return {
    numTotalTests: 1,
    numFailedTests: failed ? 1 : 0,
    testResults: [{ name: file, status: failed ? "failed" : "passed", assertionResults: [{ fullName: "the value", status: failed ? "failed" : "passed", failureMessages: failed ? ["expect(received).toBe(expected)"] : [] }] }],
  };
}

describe("T-0160 gate evidence", () => {
  it("stamps actual untracked bytes, tracked bytes and index executable mode", () => {
    repository({ "tracked.txt": "original" }, (root) => {
      const first = gateContract.stampTree(root);
      writeFileSync(join(root, "new.txt"), "one");
      const added = gateContract.stampTree(root);
      writeFileSync(join(root, "new.txt"), "two");
      expect(gateContract.stampTree(root)).not.toBe(added);
      expect(added).not.toBe(first);
      rmSync(join(root, "new.txt"));
      writeFileSync(join(root, "tracked.txt"), "changed");
      expect(gateContract.stampTree(root)).not.toBe(first);
      writeFileSync(join(root, "tracked.txt"), "original");
      git(root, "update-index", "--chmod=+x", "tracked.txt");
      expect(gateContract.stampTree(root)).not.toBe(first);
    });
  });

  it("rejects invalid or empty selections before any run", () => {
    for (const args of [["--only"], ["--only", ""], ["--only", "missing"], ["--from"], ["--from", "missing"], ["--from", "build", "--only", "lint"], ["--unknown"]]) {
      expect(() => gateContract.parseGateArgs(args)).toThrow();
    }
  });

  it("keeps partial and rerun evidence away from the full success record", () => {
    const full = gateContract.parseGateArgs([]);
    const partial = gateContract.parseGateArgs(["--only", "lint"]);
    const rerun = gateContract.parseGateArgs(["--rerun-alone", "tests/e2e/phone.spec.ts"]);
    expect(full.planned).toHaveLength(9);
    expect(full.evidenceFile).toBe("summary.json");
    expect(partial.kind).toBe("partial");
    expect(partial.evidenceFile).not.toBe(full.evidenceFile);
    expect(rerun.evidenceFile).not.toBe(full.evidenceFile);
  });
});

describe("T-0160 mutation evidence", () => {
  it("rejects unknown and empty mutant selections", () => {
    expect(() => sweepContract.selectMutants(manifest, "missing")).toThrow();
    expect(() => sweepContract.selectMutants({ task: "empty", mutants: [] })).toThrow();
  });

  it("distinguishes assertion kills from launch and zero-test failures", () => {
    const expected = ["C:/repo/oracle.test.ts"];
    expect(sweepContract.assessJestRun({ status: 1, report: jestReport(expected[0], true) }, expected)).toBe("assertion-failed");
    expect(sweepContract.assessJestRun({ status: 1 }, expected)).toBe("infrastructure");
    expect(sweepContract.assessJestRun({ status: 1, report: { numTotalTests: 0, numFailedTests: 0, testResults: [] } }, expected)).toBe("infrastructure");
    expect(sweepContract.assessJestRun({ status: 0, report: jestReport(expected[0], false) }, expected)).toBe("passed");
  });

  it("runs clean controls before and after a mutant and restores the file", () => {
    repository({ "source.txt": "good", "oracle.test.ts": "test", "mutants.json": JSON.stringify(manifest) }, (root) => {
      const seen: string[] = [];
      const run = () => {
        const source = readFileSync(join(root, "source.txt"), "utf8");
        seen.push(source);
        return { status: source === "broken" ? 1 : 0, report: jestReport(join(root, "oracle.test.ts"), source === "broken") };
      };
      expect(sweepContract.sweepAtRoot(root, "mutants.json", null, run)).toBe(0);
      expect(seen).toEqual(["good", "broken", "good"]);
      expect(readFileSync(join(root, "source.txt"), "utf8")).toBe("good");
      expect(git(root, "status", "--porcelain")).toBe("");
    });
  });

  it("restores bytes and mode even when mutant execution crashes", () => {
    repository({ "source.txt": "good", "oracle.test.ts": "test", "mutants.json": JSON.stringify(manifest) }, (root) => {
      chmodSync(join(root, "source.txt"), 0o600);
      const seen: string[] = [];
      const run = () => {
        const source = readFileSync(join(root, "source.txt"), "utf8");
        seen.push(source);
        if (source === "broken") throw new Error("runner crashed");
        return { status: 0, report: jestReport(join(root, "oracle.test.ts"), false) };
      };
      expect(sweepContract.sweepAtRoot(root, "mutants.json", null, run)).not.toBe(0);
      expect(seen).toEqual(["good", "broken", "good"]);
      expect(readFileSync(join(root, "source.txt"), "utf8")).toBe("good");
    });
  });
});
