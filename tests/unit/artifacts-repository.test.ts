/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// CRUD + idempotent capture for the artifacts registry (real SQLite; the
// @/lib/db singleton is mocked to a fresh in-memory DB per test).

import { openBaselineDb } from "../helpers/baseline-db";
import { applyArtifactsMigration } from "@/lib/db/sql-migrations";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));

import {
  captureArtifactOnce,
  createArtifact,
  deleteArtifact,
  getArtifact,
  hasArtifactForSource,
  listArtifacts,
} from "@/lib/runs/artifacts-repository";

beforeEach(() => {
  testDb = openBaselineDb([applyArtifactsMigration]);
});
afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("artifacts-repository", () => {
  it("creates, reads, lists (content omitted), and deletes", () => {
    const a = createArtifact({
      sourceKind: "research", sourceRunId: "r1", name: "Hydrogen report",
      content: "# Hydrogen\nA report.", mimeType: "text/markdown", tags: ["report"],
    });
    expect(a.sizeBytes).toBeGreaterThan(0);
    expect(a.tags).toEqual(["report"]);
    expect(getArtifact(a.id)?.content).toContain("Hydrogen");

    const list = listArtifacts({ sourceKind: "research" });
    expect(list).toHaveLength(1);
    expect((list[0] as { content?: string }).content).toBeUndefined(); // list omits the body
    expect(listArtifacts({ sourceKind: "mission" })).toHaveLength(0);

    expect(deleteArtifact(a.id)).toBe(true);
    expect(getArtifact(a.id)).toBeNull();
  });

  it("captureArtifactOnce dedupes per source and skips empty content", () => {
    expect(captureArtifactOnce({ sourceKind: "composer", sourceRunId: "c1", name: "out", content: "" })).toBeNull();
    expect(captureArtifactOnce({ sourceKind: "composer", sourceRunId: "c1", name: "out", content: "   " })).toBeNull();

    const first = captureArtifactOnce({ sourceKind: "composer", sourceRunId: "c1", name: "out", content: "the deliverable" });
    expect(first).not.toBeNull();
    expect(hasArtifactForSource("composer", "c1")).toBe(true);

    // Same source again → no duplicate.
    expect(captureArtifactOnce({ sourceKind: "composer", sourceRunId: "c1", name: "out", content: "changed" })).toBeNull();
    expect(listArtifacts({ sourceRunId: "c1" })).toHaveLength(1);
  });
});
