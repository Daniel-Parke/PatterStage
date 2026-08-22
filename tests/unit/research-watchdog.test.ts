/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// Watchdog: standalone research runs are fire-and-forget, so a crashed/restarted
// process can leave a row 'running' forever. failStuckResearchRuns() (run on
// boot) must fail the stuck ones without touching fresh or terminal runs.

import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";
import { applyDeepResearchMigration } from "@/lib/db/apply-deep-research-migration";
import { applyResearchOptionsMigration } from "@/lib/db/apply-research-options-migration";
import { applyResearchComposerLinkMigration } from "@/lib/db/apply-research-composer-link-migration";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    getDb: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});

import {
  createResearchRun,
  failStuckResearchRuns,
  getResearchRun,
  updateResearchRun,
} from "@/lib/laboratory/deep-research/research-repository";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  applyDeepResearchMigration(testDb, migrationsDir); // research_runs/steps (v19)
  applyResearchOptionsMigration(testDb, migrationsDir); // research_runs.config_json (v23)
  applyResearchComposerLinkMigration(testDb, migrationsDir); // research_runs.composer_node_run_id (v25)
});
afterEach(() => {
  testDb?.close();
  testDb = null;
});

function setCreatedAt(id: string, iso: string): void {
  testDb!.prepare("UPDATE research_runs SET created_at = ? WHERE id = ?").run(iso, id);
}

describe("failStuckResearchRuns (deep-research watchdog)", () => {
  it("fails a stale running run, leaves fresh + terminal runs untouched", () => {
    const stuck = createResearchRun({ query: "old" });
    updateResearchRun(stuck.id, { status: "running" });
    setCreatedAt(stuck.id, new Date(Date.now() - 60 * 60 * 1000).toISOString()); // 60m ago

    const fresh = createResearchRun({ query: "new" });
    updateResearchRun(fresh.id, { status: "running" }); // created_at = now

    const done = createResearchRun({ query: "done" });
    updateResearchRun(done.id, { status: "completed" });
    setCreatedAt(done.id, new Date(Date.now() - 60 * 60 * 1000).toISOString());

    const failed = failStuckResearchRuns(30);

    expect(failed).toBe(1);
    expect(getResearchRun(stuck.id)!.status).toBe("failed");
    expect(getResearchRun(stuck.id)!.error).toMatch(/interrupted|maximum runtime/i);
    expect(getResearchRun(fresh.id)!.status).toBe("running");
    expect(getResearchRun(done.id)!.status).toBe("completed");
  });

  it("is a no-op when nothing is stuck", () => {
    const fresh = createResearchRun({ query: "x" });
    updateResearchRun(fresh.id, { status: "running" });
    expect(failStuckResearchRuns(30)).toBe(0);
    expect(getResearchRun(fresh.id)!.status).toBe("running");
  });
});
