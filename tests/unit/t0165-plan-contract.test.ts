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
  claims: string[];
  dependsOn: string[];
  authority: string[];
  invariants: string[];
  rollback: string;
  verify: string;
};
type Owner = { id: string; outcome: string; task: string | null; reason: string };

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
      batches: Batch[];
      closing: { measureFile: string; oracle: string; missPolicy: string };
    }>(planPath);
    expect(plan.approval).toBe("pending-operator-approval");
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
    expect(plan.closing.oracle).toBe("scripts/tooling/refactor-closing-oracle.mjs");
    expect(plan.closing.missPolicy).toMatch(/every miss/i);
  });

  it("assigns every finding and atomic proof exactly once without reviving refuted items", () => {
    expect(existsSync(join(root, ownershipPath))).toBe(true);
    if (!existsSync(join(root, ownershipPath))) return;
    const ownership = readJson<{ findings: Owner[]; coverage: Owner[] }>(ownershipPath);
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
  });
});
