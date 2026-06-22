/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// CRUD + idempotent capture for the artifacts registry (real SQLite; the
// @/lib/db singleton is mocked to a fresh in-memory DB per test).

import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";
import { applyArtifactsMigration } from "@/lib/db/apply-artifacts-migration";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    db: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});

import {
  captureArtifactOnce,
  createArtifact,
  deleteArtifact,
  getArtifact,
  hasArtifactForSource,
  listArtifacts,
} from "@/lib/artifacts-repository";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  applyArtifactsMigration(testDb, migrationsDir);
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
