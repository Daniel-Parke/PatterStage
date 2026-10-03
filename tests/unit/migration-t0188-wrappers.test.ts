/** @jest-environment node */
// Independent public contracts. Fixtures execute historical SQL, never replacement appliers.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrationsDir, openRealDb, type RealDb } from "../helpers/baseline-db";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { applyBenchmarkConfigMigration } from "@/lib/db/apply-benchmark-config-migration";
import { applyBenchGatewaysMigration } from "@/lib/db/apply-bench-gateways-migration";
import { applyMissionPhasesMigration } from "@/lib/db/apply-mission-phases-migration";
import { applyRetireMissionPhasesMigration } from "@/lib/db/apply-retire-mission-phases-migration";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyMemoryProvidersMigration } from "@/lib/db/apply-memory-providers-migration";
import { applyResearchOptionsMigration } from "@/lib/db/apply-research-options-migration";
import { applyModelsApiStyleMigration } from "@/lib/db/apply-models-api-style-migration";
import { applyResearchComposerLinkMigration } from "@/lib/db/apply-research-composer-link-migration";
import { applyComposerGroupLinkMigration } from "@/lib/db/apply-composer-group-link-migration";
import { applyFrameworksMigration } from "@/lib/db/apply-frameworks-migration";

type PublicApplier = (database: RealDb, directory: string) => number;
type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;
function publicContract<FunctionType extends PublicApplier>(apply: FunctionType &
  (Equal<Parameters<FunctionType>, [RealDb, string]> extends true ? unknown : never) &
  (Equal<ReturnType<FunctionType>, number> extends true ? unknown : never)): FunctionType {
  return apply;
}
type Wrapper = {
  name: string;
  version: number;
  apply: PublicApplier;
  history: string[];
  table?: string;
  column?: [string, string];
};
// Type checking locks the exact two-argument tuple and numeric return of every public export.
const wrappers: Wrapper[] = [
  { name: "apply-benchmark-config-migration", version: 15, apply: publicContract(applyBenchmarkConfigMigration),
    history: ["014_benchmarks.sql"], column: ["benchmark_runs", "model_id"] },
  { name: "apply-bench-gateways-migration", version: 17, apply: publicContract(applyBenchGatewaysMigration),
    history: ["014_benchmarks.sql", "015_benchmark_config.sql"], table: "bench_gateways" },
  { name: "apply-mission-phases-migration", version: 18, apply: publicContract(applyMissionPhasesMigration),
    history: [], table: "mission_phases" },
  { name: "apply-retire-mission-phases-migration", version: 20, apply: publicContract(applyRetireMissionPhasesMigration),
    history: ["018_mission_phases.sql"] },
  { name: "apply-composer-migration", version: 21, apply: publicContract(applyComposerMigration),
    history: [], column: ["runs", "composer_node_run_id"], table: "composer_workflows" },
  { name: "apply-memory-providers-migration", version: 22, apply: publicContract(applyMemoryProvidersMigration),
    history: [], table: "memory_providers" },
  { name: "apply-research-options-migration", version: 23, apply: publicContract(applyResearchOptionsMigration),
    history: ["019_deep_research.sql"], column: ["research_runs", "config_json"], table: "research_presets" },
  { name: "apply-models-api-style-migration", version: 24, apply: publicContract(applyModelsApiStyleMigration),
    history: [], column: ["models", "api_style"] },
  { name: "apply-research-composer-link-migration", version: 25, apply: publicContract(applyResearchComposerLinkMigration),
    history: ["019_deep_research.sql"], column: ["research_runs", "composer_node_run_id"] },
  { name: "apply-composer-group-link-migration", version: 26, apply: publicContract(applyComposerGroupLinkMigration),
    history: ["021_composer.sql"], column: ["composer_runs", "parent_node_run_id"] },
  { name: "apply-frameworks-migration", version: 27, apply: publicContract(applyFrameworksMigration),
    history: [], table: "frameworks" },
];

function history(db: RealDb, file: string): void {
  db.exec(readFileSync(join(migrationsDir, file), "utf8"));
}
function schema(db: RealDb): unknown[] {
  return db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name").all();
}
function pendingFixture(wrapper: Wrapper): RealDb {
  const db = openRealDb();
  try {
    db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    history(db, "001_baseline.sql");
    for (const file of wrapper.history) history(db, file);
    if (wrapper.version === 20) {
      db.exec("ALTER TABLE missions ADD COLUMN version TEXT DEFAULT 'v1'; ALTER TABLE missions ADD COLUMN current_phase_id TEXT; ALTER TABLE runs ADD COLUMN phase_action_id TEXT");
    }
    db.prepare("INSERT INTO missions (id, name, prompt) VALUES (?, ?, ?)")
      .run("owned-mission", "User mission", "Preserve this prompt");
    setSchemaVersion(db, wrapper.version - 1);
    return db;
  } catch (error) {
    db.close();
    throw new Error(`INFRASTRUCTURE: ${wrapper.name} fixture failed: ${String(error)}`);
  }
}

describe("T-0188 eleven public wrapper contracts (real SQLite)", () => {
  it.each(wrappers)("$name preserves pending return, schema and repeat stability", (wrapper) => {
    const db = pendingFixture(wrapper);
    try {
      expect(wrapper.apply(db, migrationsDir)).toBe(wrapper.version);
      expect(getSchemaVersion(db)).toBe(wrapper.version);
      if (wrapper.table) {
        expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(wrapper.table))
          .toEqual({ name: wrapper.table });
      }
      if (wrapper.column) {
        const [table, column] = wrapper.column;
        expect((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((row) => row.name))
          .toContain(column);
      }
      if (wrapper.version === 20) {
        expect(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'mission_phase%' OR name='mission_approvals'").all())
          .toEqual([]);
      }
      const before = schema(db);
      expect(wrapper.apply(db, join(migrationsDir, "absent-obsolete-sql"))).toBe(wrapper.version);
      expect(schema(db)).toEqual(before);
      expect(db.prepare("SELECT name, prompt FROM missions WHERE id='owned-mission'").get())
        .toEqual({ name: "User mission", prompt: "Preserve this prompt" });
    } finally { db.close(); }
  });

  it.each(wrappers)("$name refuses missing pending SQL without completing its step", (wrapper) => {
    const directory = mkdtempSync(join(tmpdir(), "t0188-wrapper-sql-"));
    const db = pendingFixture(wrapper);
    try {
      expect(() => wrapper.apply(db, directory)).toThrow();
      expect(getSchemaVersion(db)).toBe(wrapper.version - 1);
      expect(db.prepare("SELECT prompt FROM missions WHERE id='owned-mission'").get())
        .toEqual({ prompt: "Preserve this prompt" });
    } finally {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each(wrappers)("$name preserves already-applied returns without obsolete SQL or new shape checks", (wrapper) => {
    const db = openRealDb();
    try {
      db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
      for (const version of [wrapper.version, 43]) {
        setSchemaVersion(db, version);
        const before = schema(db);
        expect(wrapper.apply(db, join(migrationsDir, "absent-obsolete-sql"))).toBe(version);
        expect(getSchemaVersion(db)).toBe(version);
        expect(schema(db)).toEqual(before);
      }
    } finally { db.close(); }
  });
});
