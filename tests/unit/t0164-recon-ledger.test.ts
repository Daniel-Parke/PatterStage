/** @jest-environment node */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");
const sourcePath = "org/reviews/2026-09-evidence-ledger.jsonl";
const scopePath = "org/reviews/2026-09-t0164-coverage-scope.json";
const findingPath = "org/reviews/2026-09-t0164-findings.jsonl";
const coveragePath = "org/reviews/2026-09-t0164-coverage.jsonl";
const readRows = (path: string): Record<string, unknown>[] => readFileSync(join(root, path), "utf8")
  .trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);

type Source = { file: string; line: number };
type Disposition = { id: string; kind: string; record: string };
type ReconRow = {
  id: string;
  parentId?: string;
  source: Source;
  inspectedRevision: string;
  method: string;
  evidence: string;
  sceptic: { verdict: string; evidence: string };
  ruling: string;
  operatorDispositions?: Disposition[];
  owningTask: string;
  uncertainty: string;
  status: "verified" | "refuted" | "unresolved" | "deferred";
  nextProof?: string;
};

const validStatus = new Set(["verified", "refuted", "unresolved", "deferred"]);
function expectEvidence(row: ReconRow) {
  expect(row.source.file).toBeTruthy();
  expect(row.source.line).toBeGreaterThan(0);
  expect(row.inspectedRevision).toMatch(/^[0-9a-f]{7,40}$/);
  expect(row.method.trim().length).toBeGreaterThan(9);
  expect(row.evidence.trim()).not.toBe("");
  expect(row.sceptic.verdict.trim()).not.toBe("");
  expect(row.sceptic.evidence.trim()).not.toBe("");
  expect(row.ruling.trim()).not.toBe("");
  expect(row.owningTask).toMatch(/^T-\d{4}$/);
  expect(row.uncertainty.trim()).not.toBe("");
  expect(validStatus.has(row.status)).toBe(true);
  if (row.status === "unresolved" || row.status === "deferred") {
    expect(row.nextProof?.trim()).toBeTruthy();
  }
}

describe("T-0164 itemised reconnaissance", () => {
  it("freezes one unique atomic child set for each of the 107 original coverage bullets", () => {
    const source = readRows(sourcePath).filter((row) => row.kind === "gap");
    const scope = JSON.parse(readFileSync(join(root, scopePath), "utf8")) as {
      atomsByParent: Record<string, string[]>;
    };
    expect(source).toHaveLength(107);
    expect(Object.keys(scope.atomsByParent).sort()).toEqual(source.map((row) => String(row.id)).sort());
    const ids = Object.values(scope.atomsByParent).flat();
    expect(ids).toHaveLength(285);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [parent, children] of Object.entries(scope.atomsByParent)) {
      expect(children.length).toBeGreaterThan(0);
      expect(children.every((child) => child.startsWith(`${parent}.`))).toBe(true);
    }
  });

  it("accounts for all 265 findings and preserves every split operator disposition", () => {
    const original = readRows(sourcePath).filter((row) => row.kind === "finding");
    expect(original).toHaveLength(265);
    const path = join(root, findingPath);
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;
    const current = readRows(findingPath) as ReconRow[];
    expect(current).toHaveLength(original.length);
    expect(new Set(current.map((row) => row.id)).size).toBe(current.length);
    const byId = new Map(current.map((row) => [row.id, row]));
    expect([...byId.keys()].sort()).toEqual(original.map((row) => String(row.id)).sort());
    const originalChildren = original.flatMap((row) => row.operatorDispositions as Disposition[] ?? []);
    const currentChildren = current.flatMap((row) => row.operatorDispositions ?? []);
    expect(originalChildren).toHaveLength(163);
    expect(currentChildren.map((child) => child.id).sort()).toEqual(originalChildren.map((child) => child.id).sort());
    for (const source of original) {
      const row = byId.get(String(source.id))!;
      expect(row.source).toEqual(source.source);
      expectEvidence(row);
    }
  });

  it("accounts for every atomic coverage child with an honest present or unresolved verdict", () => {
    const scope = JSON.parse(readFileSync(join(root, scopePath), "utf8")) as {
      atomsByParent: Record<string, string[]>;
    };
    const expected = Object.values(scope.atomsByParent).flat();
    const path = join(root, coveragePath);
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;
    const rows = readRows(coveragePath) as ReconRow[];
    expect(rows).toHaveLength(expected.length);
    expect(rows.map((row) => row.id).sort()).toEqual(expected.sort());
    const source = new Map(readRows(sourcePath).filter((row) => row.kind === "gap")
      .map((row) => [String(row.id), row.source]));
    for (const row of rows) {
      expect(row.source).toEqual(source.get(row.parentId ?? ""));
      expect(scope.atomsByParent[row.parentId ?? ""]).toContain(row.id);
      expectEvidence(row);
    }
  });
});
