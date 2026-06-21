/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */
// CRUD coverage for the Mission V2 phases repository against REAL SQLite
// (the @/lib/db singleton is mocked to a fresh in-memory DB per test).

import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";
import { applyMissionPhasesMigration } from "@/lib/db/apply-mission-phases-migration";

let testDb: import("better-sqlite3").Database | null = null;

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

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

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

beforeEach(() => {
  const Database = loadRealBetterSqlite3();
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb); // missions + runs tables, schema_version 3
  applyMissionPhasesMigration(testDb, migrationsDir); // phase tables + columns, version 18
  testDb.prepare("INSERT INTO missions (id, name, prompt) VALUES ('m1', 'M', 'p')").run();
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

type Repo = typeof import("@/lib/mission-phases-repository");
type Schema = typeof import("@/lib/schema/mission-v2");

describe("mission-phases-repository", () => {
  it("scaffolds phases + actions from a plan and marks the mission v2", () => {
    const repo = require("@/lib/mission-phases-repository") as Repo;
    const { DEFAULT_V2_PLAN } = require("@/lib/schema/mission-v2") as Schema;

    const phases = repo.scaffoldMissionPhases("m1", DEFAULT_V2_PLAN);

    expect(phases).toHaveLength(4);
    expect(phases.map((p) => p.kind)).toEqual(["prepare", "implement", "test", "release"]);
    expect(phases[0].actions.map((a) => a.kind)).toEqual(["plan", "review", "validate"]);
    expect(phases.every((p) => p.status === "pending")).toBe(true);

    const version = (testDb!.prepare("SELECT version FROM missions WHERE id='m1'").get() as {
      version: string;
    }).version;
    expect(version).toBe("v2");
  });

  it("records an approval and resolves the phase decision + status", () => {
    const repo = require("@/lib/mission-phases-repository") as Repo;
    const { DEFAULT_V2_PLAN } = require("@/lib/schema/mission-v2") as Schema;

    const phases = repo.scaffoldMissionPhases("m1", DEFAULT_V2_PLAN);
    const phaseId = phases[0].id;

    const approval = repo.recordApproval(phaseId, { approved: true, note: "looks good" });
    expect(approval.approved).toBe(true);

    const phase = repo.getPhase(phaseId);
    expect(phase?.approvalDecision).toBe("approved");
    expect(phase?.status).toBe("approved");
    expect(phase?.approvalNote).toBe("looks good");
    expect(repo.listApprovals(phaseId)).toHaveLength(1);
  });

  it("updates an action's status + run linkage", () => {
    const repo = require("@/lib/mission-phases-repository") as Repo;
    const { DEFAULT_V2_PLAN } = require("@/lib/schema/mission-v2") as Schema;

    const phases = repo.scaffoldMissionPhases("m1", DEFAULT_V2_PLAN);
    const actionId = phases[0].actions[0].id;
    testDb!.prepare("INSERT INTO runs (id) VALUES ('r1')").run();

    const updated = repo.updateAction(actionId, { status: "completed", runId: "r1", output: "done" });
    expect(updated?.status).toBe("completed");
    expect(updated?.runId).toBe("r1");
    expect(updated?.output).toBe("done");
  });

  it("rejecting a phase records the negative decision", () => {
    const repo = require("@/lib/mission-phases-repository") as Repo;
    const { DEFAULT_V2_PLAN } = require("@/lib/schema/mission-v2") as Schema;

    const phases = repo.scaffoldMissionPhases("m1", DEFAULT_V2_PLAN);
    repo.recordApproval(phases[1].id, { approved: false, note: "needs rework" });

    const phase = repo.getPhase(phases[1].id);
    expect(phase?.approvalDecision).toBe("rejected");
    expect(phase?.status).toBe("rejected");
  });
});
