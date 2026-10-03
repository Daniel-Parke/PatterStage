/** @jest-environment node */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");
const planPath = "org/plans/2026-09-refactor-programme.json";
const measuresPath = "org/plans/2026-09-refactor-measures.json";
const ownershipPath = "org/plans/2026-09-refactor-ownership.json";
const findingsPath = "org/reviews/2026-09-t0164-findings.jsonl";
const coveragePath = "org/reviews/2026-09-t0164-coverage.jsonl";

type Batch = {
  id: string;
  name: string;
  phase: string;
  tierProposed: string;
  claims: string[];
  dependsOn: string[];
  authority: string[];
  invariants: string[];
  rollback: string;
  verify: string;
};
type Owner = { id: string; outcome: string; task: string | null; reason: string };

// Q-015 amendment, 2026-10-01: requirements only, never execution evidence.
const releaseVerificationRequirements = {
  requiresAll: {
    "T-0202": {
      independentAcceptance: "required",
      closure: "required",
      localFullGate: { requiredResult: "pass" },
      sweep: { committed: true, clean: true },
      httpMatrix: { enabled: true, cases: 15, requiredResult: "all-pass" },
    },
    "T-0203": {
      independentAcceptance: "required",
      closure: "required",
      localFullGate: { revision: "current-head", requiredResult: "pass" },
      sweep: { committed: true, clean: true },
      hostedJobs: {
        revision: "exact-head",
        events: ["push", "pull_request"],
        selection: "every-required-job",
        requiredResult: "all-pass",
      },
      nativeMacHttp: {
        execution: "native-macos",
        enabled: true,
        cases: 21,
        requiredResult: "all-pass",
      },
    },
    "T-0204": {
      revision: "latest-repair-head",
      independentAcceptance: { tier: "R2", requiredResult: "accepted" },
      closure: "required",
      localFullGate: { scope: "complete", tree: "unchanged", requiredResult: "pass" },
      sweep: { committed: true, clean: true },
      scannerAcceptance: {
        execution: "actual",
        imageIdentity: "digest-pinned",
        cleanScan: { requiredResult: "accepted" },
        plantedScanner: { deterministic: true, requiredResult: "accepted" },
      },
      frozenT0203Checks: { selection: "all", requiredResult: "all-pass" },
      repairedCanary: { requiredResult: "pass" },
      hostedJobs: {
        revision: "exact-head",
        events: ["push", "pull_request"],
        selection: "every-required-job",
        requiredResult: "all-pass",
      },
    },
  },
} as const;
type ExternalPrerequisites = {
  "release-verification-repairs-complete": typeof releaseVerificationRequirements;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(root, path), "utf8")) as T;
}

function readJsonl(path: string): { id: string; status: string }[] {
  return readFileSync(join(root, path), "utf8").trim().split("\n")
    .map((line) => JSON.parse(line) as { id: string; status: string });
}

function committedJson<T>(revision: string, path: string): T {
  const content = execFileSync("git", ["show", `${revision}:${path}`], { cwd: root, encoding: "utf8" });
  return JSON.parse(content) as T;
}

describe("T-0165 Phase 2 plan contract", () => {
  it("freezes historical commitments and new targets against committed baseline files", () => {
    expect(existsSync(join(root, measuresPath))).toBe(true);
    if (!existsSync(join(root, measuresPath))) return;
    const measures = readJson<{
      historical: { key: string; baseline: number; target: number }[];
      rows: { key: string; scope: "line" | "toolingLive" | "documentationLive" | "organisationLive"; baseline: number; target: number; rationale: string }[];
      lineRevision: string;
      scopeRevision: string;
    }>(measuresPath);
    expect(measures.historical).toEqual([
      { key: "srcLines", baseline: 100983, target: 98000 },
      { key: "testLines", baseline: 124351, target: 116000 },
      { key: "srcRepeatedWindowLines", baseline: 1000, target: 600 },
      { key: "testRepeatedWindowLines", baseline: 4345, target: 2500 },
      { key: "oneImporterComponents", baseline: 103, target: 95 },
    ]);
    const line = committedJson<{ counts: Record<string, number> }>(measures.lineRevision, "scripts/tooling/line-census.baseline.json");
    const scope = committedJson<{ scopes: Record<string, { lines: number }> }>(measures.scopeRevision, "org/reviews/2026-09-t0164-scope-baseline.json");
    const keys = ["srcLines", "testLines", "srcRepeatedWindowLines", "testRepeatedWindowLines", "oneImporterComponents", "toolingLive", "documentationLive", "organisationLive"];
    expect(measures.rows.map((row) => row.key).sort()).toEqual([...keys].sort());
    for (const row of measures.rows) {
      expect(row.baseline).toBe(row.scope === "line" ? line.counts[row.key] : scope.scopes[row.key].lines);
      expect(Number.isInteger(row.target)).toBe(true);
      expect(row.target).toBeGreaterThan(0);
      expect(row.target).toBeLessThan(row.baseline);
      expect(row.rationale.length).toBeGreaterThan(25);
    }
  });

  it("provides sequential, reversible batches with authority and exact verification", () => {
    expect(existsSync(join(root, planPath))).toBe(true);
    if (!existsSync(join(root, planPath))) return;
    const plan = readJson<{
      approval: string;
      releaseGate: string;
      decisionAuthority: string[];
      externalPrerequisites: ExternalPrerequisites;
      batches: Batch[];
      closing: { measureFile: string; dispositionFile: string; oracle: string; missPolicy: string };
    }>(planPath);
    expect(plan.approval).toBe("operator-approved-2026-09-28");
    expect(plan.decisionAuthority).toContain("Q-032");
    expect(plan.externalPrerequisites?.["release-verification-repairs-complete"])
      .toEqual(releaseVerificationRequirements);
    expect(plan.batches).toHaveLength(22);
    const migrations = plan.batches.find((batch) => batch.id === "T-0188");
    expect(migrations?.dependsOn).toEqual(["T-0187", "release-verification-repairs-complete"]);
    expect(migrations?.phase).toBe("prerelease-structural");
    expect(migrations?.authority).toContain("Q-032");
    const removal = plan.batches.find((batch) => batch.id === "T-0199");
    expect(removal?.dependsOn).toEqual(["T-0198"]);
    expect(removal?.phase).toBe("prerelease-removal");
    expect(removal?.authority).toContain("Q-032");
    expect(plan.releaseGate).toContain("Q-011");
    expect(plan.batches.length).toBeGreaterThanOrEqual(12);
    expect(plan.batches.map((batch) => batch.id)).toEqual(
      plan.batches.map((_, index) => `T-${String(180 + index).padStart(4, "0")}`),
    );
    for (const batch of plan.batches) {
      expect(batch.name.trim()).not.toBe("");
      expect(batch.phase.trim()).not.toBe("");
      expect(batch.claims.length).toBeGreaterThan(0);
      expect(batch.authority.length).toBeGreaterThan(0);
      expect(batch.invariants.length).toBeGreaterThan(0);
      expect(batch.rollback.length).toBeGreaterThan(20);
      expect(batch.verify.length).toBeGreaterThan(30);
      for (const dependency of batch.dependsOn) {
        if (dependency.startsWith("T-")) {
          const earlier = plan.batches.findIndex((candidate) => candidate.id === dependency);
          expect(earlier).toBeGreaterThanOrEqual(0);
          expect(earlier).toBeLessThan(plan.batches.indexOf(batch));
        }
      }
    }
    expect(plan.closing.measureFile).toBe(measuresPath);
    expect(plan.closing.dispositionFile).toBe("org/plans/2026-09-refactor-final-dispositions.json");
    expect(plan.closing.oracle).toBe("scripts/tooling/refactor-closing-oracle.mjs");
    expect(plan.closing.missPolicy).toMatch(/every miss/i);
    const releaseContract = plan.batches.find((batch) => batch.id === "T-0187");
    expect(releaseContract?.claims).toContain("scripts/tooling/eos-compile.mjs");
    expect(releaseContract?.claims).toContain("tests/unit/b15-corpus-moves-under-org.test.ts");
    expect(releaseContract?.claims).toContain("org/EOS_FEEDBACK.md");
    expect(releaseContract?.claims).toContain("scripts/hardware/ch-db-backup.sh");
    expect(plan.batches.find((batch) => batch.id === "T-0199")?.claims).toContain("package.json");
    expect(plan.batches.find((batch) => batch.id === "T-0199")?.claims).not.toContain("scripts/maintenance/**");
    const retirement = plan.batches.find((batch) => batch.id === "T-0200");
    expect(retirement?.tierProposed).toBe("R3");
    expect(retirement?.phase).toBe("post-v1-removal");
    expect(retirement?.dependsOn).toEqual(["T-0199", "operator-v1-release"]);
    expect(plan.batches.find((batch) => batch.id === "T-0201")?.dependsOn).toEqual(["T-0200"]);
    expect(retirement?.claims).toContain("src/lib/host/paths.ts");
    const aliasReaders = execFileSync("git", ["grep", "-l", "-E", "CH_|CONTROL_HUB_|AGENT_HOME|x-ch-|ch[.]sessions[.]", "--", "src", "scripts", "next.config.ts"], {
      cwd: root, encoding: "utf8",
    }).trim().split("\n");
    for (const file of aliasReaders) expect(retirement?.claims).toContain(file.trim());
    expect(retirement?.invariants.join(" ")).toMatch(/ch_data\/ch_hermes Compose volume names survive/);
  });

  it("assigns every finding and atomic proof exactly once without reviving refuted items", () => {
    expect(existsSync(join(root, ownershipPath))).toBe(true);
    if (!existsSync(join(root, ownershipPath))) return;
    const ownership = readJson<{ findings: Owner[]; coverage: Owner[]; operatorDispositions: Owner[] }>(ownershipPath);
    for (const id of ["lib-data-01", "lib-data-02"]) {
      expect(ownership.findings.find((row) => row.id === id)?.task).toBe("T-0188");
    }
    expect(ownership.operatorDispositions.find((row) => row.id === "lib-data-01")?.task).toBe("T-0188");
    const findings = readJsonl(findingsPath);
    const coverage = readJsonl(coveragePath);
    expect(ownership.findings.map((row) => row.id).sort()).toEqual(findings.map((row) => row.id).sort());
    expect(ownership.coverage.map((row) => row.id).sort()).toEqual(coverage.map((row) => row.id).sort());
    expect(new Set(ownership.findings.map((row) => row.id)).size).toBe(265);
    expect(new Set(ownership.coverage.map((row) => row.id)).size).toBe(285);
    const plan = readJson<{ batches: Batch[] }>(planPath);
    const tasks = new Set(plan.batches.map((batch) => batch.id));
    for (const row of [...ownership.findings, ...ownership.coverage]) {
      expect(["planned", "already-addressed", "ruled-out", "deferred"].includes(row.outcome)).toBe(true);
      expect(row.reason.trim().length).toBeGreaterThan(10);
      if (row.outcome === "planned") expect(tasks.has(row.task ?? "")).toBe(true);
      else expect(row.task).toBeNull();
    }
    for (const finding of findings.filter((row) => row.status === "refuted")) {
      expect(ownership.findings.find((row) => row.id === finding.id)?.outcome).toBe("ruled-out");
    }
    const splitIds = readFileSync(join(root, findingsPath), "utf8").trim().split("\n")
      .flatMap((line) => (JSON.parse(line) as { operatorDispositions?: { id: string }[] }).operatorDispositions ?? [])
      .map((row) => row.id);
    expect(splitIds).toHaveLength(163);
    expect(ownership.operatorDispositions).toBeDefined();
    if (!ownership.operatorDispositions) return;
    expect(ownership.operatorDispositions.map((row) => row.id).sort()).toEqual(splitIds.sort());
    for (const row of ownership.operatorDispositions) {
      expect(row.reason.length).toBeGreaterThan(10);
      if (row.outcome === "planned") expect(tasks.has(row.task ?? "")).toBe(true);
      else expect(row.task).toBeNull();
    }
    for (const id of ["app-01h", "cross-cutting-04b", "docs-05b"]) {
      expect(ownership.operatorDispositions.find((row) => row.id === id)?.outcome).toBe("planned");
    }
    expect(ownership.operatorDispositions.find((row) => row.id === "cross-cutting-04b")?.task).toBe("T-0200");
    expect(ownership.operatorDispositions.find((row) => row.id === "docs-05a")?.outcome).toBe("deferred");
    expect(ownership.operatorDispositions.find((row) => row.id === "tooling-11b")?.task).toBe("T-0196");
    expect(ownership.operatorDispositions.find((row) => row.id === "tooling-11b")?.reason).toMatch(/keep ch_data/i);
    expect(ownership.operatorDispositions.find((row) => row.id === "tooling-10b")?.task).toBe("T-0187");
    expect(ownership.operatorDispositions.find((row) => row.id === "critic-05b")?.task).toBe("T-0200");
    expect(ownership.operatorDispositions.find((row) => row.id === "tooling-12b")?.outcome).toBe("ruled-out");
    for (const id of ["app-01a", "app-01b", "app-01c", "app-01d", "app-01h"]) {
      expect(ownership.operatorDispositions.find((row) => row.id === id)?.task).toBe("T-0192");
    }
    expect(ownership.findings.find((row) => row.id === "org-11")?.task).toBe("T-0187");
    expect(ownership.findings.find((row) => row.id === "lib-data-05")?.task).toBe("T-0199");
    for (const row of ownership.operatorDispositions.filter((item) => item.id.startsWith("lib-data-05"))) {
      expect(row.task).toBe("T-0199");
    }
    for (const id of ["gap-074.b", "gap-080.a", "gap-083.b", "gap-095.c", "gap-101.a"]) {
      expect(ownership.coverage.find((row) => row.id === id)?.outcome).toBe("planned");
    }
  });
});
