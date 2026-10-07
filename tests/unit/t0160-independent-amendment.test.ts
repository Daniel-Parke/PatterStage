/** @jest-environment node */

import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";

import { parseGateArgs } from "../../scripts/tooling/gate.mjs";
import { assessJestRun, sweepAtRoot } from "../../scripts/tooling/mutation-sweep.mjs";

const repositoryRoot = join(__dirname, "..", "..");

function inScratch(run: (scratch: string) => void): void {
  const temporaryRoot = realpathSync(tmpdir());
  const scratch = mkdtempSync(join(temporaryRoot, "ps-t0160-independent-"));
  try {
    run(scratch);
  } finally {
    const target = realpathSync(scratch);
    const child = relative(temporaryRoot, target);
    if (!child || child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child)) {
      throw new Error("refusing to clean a path outside the test's temporary root");
    }
    rmSync(target, { recursive: true, force: true });
  }
}

function git(root: string, ...args: string[]): void {
  execFileSync("git", ["-C", root, ...args], { stdio: ["ignore", "pipe", "pipe"] });
}

function jestReport(testFile: string, failed: boolean) {
  return {
    numTotalTests: 1,
    numFailedTests: failed ? 1 : 0,
    testResults: [{
      name: testFile,
      assertionResults: [{ status: failed ? "failed" : "passed", failureMessages: failed ? ["expect(source).toBe('baseline')"] : [] }],
    }],
  };
}

describe("T-0160 independent runner amendment", () => {
  it("rejects a symlinked checkout tmp root without deleting its external marker", () => {
    inScratch((scratch) => {
      const checkout = join(scratch, "checkout");
      const sourceDirectory = join(checkout, "tests", "e2e");
      const externalRoot = join(scratch, "external");
      const childTemp = join(scratch, "child-temp");
      const dataDir = join(checkout, "tmp", "e2e-data");
      const marker = join(externalRoot, "e2e-data", "marker.txt");
      mkdirSync(sourceDirectory, { recursive: true });
      mkdirSync(join(externalRoot, "e2e-data"), { recursive: true });
      mkdirSync(childTemp);
      writeFileSync(marker, "preserve me");
      copyFileSync(join(repositoryRoot, "tests", "e2e", "prepare-data-dir.mjs"), join(sourceDirectory, "prepare-data-dir.mjs"));
      git(checkout, "init", "--quiet");

      // The copied entry point needs its static dependency to load. The guard
      // must refuse before the stub can be constructed or migration can run.
      const packageDirectory = join(checkout, "node_modules", "better-sqlite3");
      mkdirSync(packageDirectory, { recursive: true });
      writeFileSync(join(packageDirectory, "package.json"), JSON.stringify({ name: "better-sqlite3", type: "module", exports: "./index.js" }));
      writeFileSync(join(packageDirectory, "index.js"), "export default class Database { constructor() { throw new Error('guard did not refuse'); } }\n");
      symlinkSync(externalRoot, join(checkout, "tmp"), process.platform === "win32" ? "junction" : "dir");

      const result = spawnSync(process.execPath, [join(sourceDirectory, "prepare-data-dir.mjs"), dataDir], {
        cwd: checkout,
        encoding: "utf8",
        timeout: 20_000,
        env: { ...process.env, TMP: childTemp, TEMP: childTemp, TMPDIR: childTemp },
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(existsSync(marker)).toBe(true);
      expect(result.stderr).toContain("refusing a path outside an isolated temporary directory");
      expect(readFileSync(marker, "utf8")).toBe("preserve me");
    });
  });

  it("never writes through a symlinked mutant path outside its disposable repository", () => {
    inScratch((scratch) => {
      const checkout = join(scratch, "checkout");
      const externalRoot = join(scratch, "external");
      mkdirSync(checkout);
      mkdirSync(externalRoot);
      const externalFile = join(externalRoot, "source.txt");
      const original = Buffer.from("baseline\n");
      writeFileSync(externalFile, original);
      writeFileSync(join(checkout, ".gitignore"), "bridge\n");
      writeFileSync(join(checkout, "oracle.test.ts"), "test fixture\n");
      writeFileSync(join(checkout, "mutants.json"), JSON.stringify({
        task: "T-0160-independent",
        mutants: [{ id: "external", file: "bridge/source.txt", anchor: "baseline", replacement: "mutated", tests: ["oracle.test.ts"] }],
      }));
      git(checkout, "init", "--quiet");
      git(checkout, "add", ".");
      git(checkout, "-c", "user.name=Oracle", "-c", "user.email=oracle@example.invalid", "commit", "--quiet", "-m", "fixture");
      symlinkSync(externalRoot, join(checkout, "bridge"), process.platform === "win32" ? "junction" : "dir");

      const observed: Buffer[] = [];
      const testFile = join(checkout, "oracle.test.ts");
      const runner = () => {
        const bytes = readFileSync(externalFile);
        observed.push(bytes);
        const failed = !bytes.equals(original);
        return { status: failed ? 1 : 0, report: jestReport(testFile, failed) };
      };
      const exit = sweepAtRoot(checkout, "mutants.json", null, runner);
      expect(readFileSync(externalFile)).toEqual(original);
      expect(observed.every((bytes) => bytes.equals(original))).toBe(true);
      expect(exit).not.toBe(0);
    });
  });

  it("does not call a thrown test error an assertion kill", () => {
    const testFile = join(repositoryRoot, "tests", "unit", "oracle.test.ts");
    const report = {
      numTotalTests: 1,
      numFailedTests: 1,
      testResults: [{
        name: testFile,
        assertionResults: [{ status: "failed", failureMessages: ["TypeError: Cannot read properties of undefined"] }],
      }],
    };
    expect(assessJestRun({ status: 1, report }, [testFile])).toBe("infrastructure");
  });

  it("rejects an absent rerun spec during selection", () => {
    const missingSpec = "tests/e2e/t0160-independent-absent.spec.ts";
    expect(existsSync(join(repositoryRoot, missingSpec))).toBe(false);
    expect(() => parseGateArgs(["--rerun-alone", missingSpec])).toThrow();
  });
});
