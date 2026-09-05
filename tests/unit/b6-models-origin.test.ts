/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform, and the 039 applier is read through a loose require so this file loads before it exists */

// ═══════════════════════════════════════════════════════════════
// B6 oracle, group models-origin (T-0100, D10). Section 1 of the contract,
// the server half: migration 039, the repository keep-rule, the import
// route's reason. The page half lives in b6-models-page-reimport.test.tsx.
//
// Written before the product code moved. What it holds:
//
//   (A) migration 039: the head is 39 and it is MODELS_ORIGIN_SCHEMA_VERSION,
//       one above operator prefs; the highest-numbered file on disk is 039;
//       runMigrations on a v38 database adds origin / last_imported_name /
//       last_imported_base_url and backfills them from import_key and
//       name = model_id; a v3 prebuild-shaped row with import_key reaches
//       'import' on the app's first climb; a second run is a no-op; the
//       applier guards on >= 39.
//   (B) the keep-rule in upsertModel, contract lines (a) to (e): an operator's
//       rename or base URL survives a re-import, a name still equal to the
//       last import follows the import, a createModel row is 'user' and stays
//       'user', an upsert-inserted row is 'import' with last_imported_* set,
//       and UpsertModelResult says what it kept in `preserved`.
//   (C) route-level, contract line (f) against a real database and a temp
//       Hermes root: PUT /api/models/[id] { name: 'Renamed' } then
//       POST /api/models/import leaves GET /api/models/[id] at 'Renamed', and
//       details[].reason says 'kept operator edits: name'.
//
// Reds here are the implementation's to-do list. The GREEN CONTROLs pin what
// B6 keeps: the older ladder rungs, a matching import still claiming its
// default slots and sparing credentials_id / context_length.
//
// Type-tolerance: `npm run lint` type-checks tests/ (tsconfig.tests.json), so
// the shapes the contract adds (origin / lastImportedName / lastImportedBaseUrl
// on ModelRecord, preserved on UpsertModelResult, the 039 applier module) are
// read through loose casts and one try/catch require. Every runtime assertion
// is exactly what the contract says; only the compile-time view is loosened.
// Once B6 lands, strip `Origin`, `originOf`, `preservedOf` and
// `loadOriginApplier` so the file re-tightens to the real types.
//
// FUSE: the Hermes home is a mkdtemp under the OS temp directory and BOTH
// path resolvers are mocked to it, for the reason written at length in
// the-push-either-works-or-says-what-happened.test.ts: a missed mock once
// wrote fixture files over an operator's real Hermes home.
// ═══════════════════════════════════════════════════════════════

import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as yaml from "js-yaml";
import type DatabaseNs from "better-sqlite3";

import { execBaselineSchema } from "../helpers/baseline-db";
import {
  MIGRATION_HEAD_SCHEMA_VERSION,
  getSchemaVersion,
  setSchemaVersion,
} from "@/lib/db-schema";
import { OPERATOR_PREFS_SCHEMA_VERSION } from "@/lib/db/apply-operator-prefs-migration";
import { COMPOSER_NODE_CANCELLED_SCHEMA_VERSION } from "@/lib/db/apply-composer-node-cancelled-migration";

type RealDb = DatabaseNs.Database;

const hermesHome = mkdtempSync(join(tmpdir(), "ps-b6-origin-"));
const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

// ── mocks ───────────────────────────────────────────────────────

// The real database the repository and the routes write to. runMigrations is
// pulled from the REAL @/lib/db below, so this mock only serves the
// repository-facing surface.
let testDb: RealDb | null = null;

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

jest.mock("@/modules/hermes/lib/profile-paths", () => ({
  getHermesDefaultRoot: () => hermesHome,
  resolveProfileHermesHome: (slug: string) => join(hermesHome, "profiles", slug),
  isProfileHermesHome: () => false,
}));

jest.mock("@/modules/hermes/lib/agent-runtime", () => {
  const { buildHermesPathBundle } = jest.requireActual(
    "@/modules/hermes/lib/paths",
  ) as typeof import("@/modules/hermes/lib/paths");
  return {
    getHermesDefaultRoot: () => hermesHome,
    getActiveHermesPaths: () => buildHermesPathBundle(hermesHome),
    getActiveHermesHome: () => hermesHome,
  };
});

// The same NextRequest / NextResponse doubles models-api.test.ts uses: the
// routes answer through NextResponse.json and parse-json-body checks
// `instanceof NextResponse`, and both hold against this class.
jest.mock("next/server", () => ({
  NextRequest: class NextRequest {
    url: string;
    method: string;
    headers: Headers;
    nextUrl: URL;
    bodyUsed: boolean = false;
    private _body: string;
    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this.method = init?.method ?? "GET";
      this.headers = new Headers(init?.headers as HeadersInit);
      this._body = typeof init?.body === "string" ? init.body : JSON.stringify(init?.body ?? {});
      this.nextUrl = new URL(url);
    }
    async json() {
      return JSON.parse(this._body);
    }
  },
  NextResponse: class NextResponse {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      this.status = status;
      this.body = body;
    }
    async json() {
      return this.body;
    }
    static json(data: unknown, init?: ResponseInit) {
      return new NextResponse(init?.status ?? 200, data);
    }
  },
}));

jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.requireActual("@/lib/api-logger").serverErrorFromCatch,
}));

// jest.setup globally mocks "@/lib/db" and so does this file; runMigrations is
// the real wiring, pulled past both.
const { runMigrations } = jest.requireActual<typeof import("@/lib/db")>("@/lib/db");

import {
  createModel,
  getModel,
  listModels,
  updateModel,
  upsertModel,
  type ModelRecord,
  type UpsertModelResult,
} from "@/lib/models-repository";

// ── pre-B6 type shims (see header) ──────────────────────────────

/** ModelRecord plus the three fields 039 adds. Identical to ModelRecord after B6. */
type Origin = ModelRecord & {
  origin?: "import" | "user";
  lastImportedName?: string | null;
  lastImportedBaseUrl?: string | null;
};

const originOf = (model: ModelRecord | null): Origin => model as Origin;

const preservedOf = (result: UpsertModelResult): string[] | undefined =>
  (result as UpsertModelResult & { preserved?: string[] }).preserved;

interface OriginApplier {
  MODELS_ORIGIN_SCHEMA_VERSION: number;
  applyModelsOriginMigration: (database: RealDb, dir: string) => number;
}

/** The new applier module, read loosely so this file loads before it exists. */
function loadOriginApplier(): OriginApplier | null {
  try {
    return require("@/lib/db/apply-models-origin-migration") as OriginApplier;
  } catch {
    return null;
  }
}

// ── helpers ─────────────────────────────────────────────────────

function openMemoryDb(): RealDb {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  const db = new (Database as unknown as new (path: string) => RealDb)(":memory:");
  db.pragma("foreign_keys = ON");
  return db;
}

function cols(db: RealDb, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}

function tableNames(db: RealDb): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
  ).map((r) => r.name);
}

interface RawModelRow {
  id: string;
  name: string;
  model_id: string;
  base_url: string | null;
  import_key: string | null;
  origin?: string;
  last_imported_name?: string | null;
  last_imported_base_url?: string | null;
}

function rawRow(db: RealDb, id: string): RawModelRow {
  return db.prepare("SELECT * FROM models WHERE id = ?").get(id) as RawModelRow;
}

/** A models row as 001_baseline knows it: no origin columns. */
function insertLegacyRow(
  db: RealDb,
  row: { id: string; name: string; modelId: string; baseUrl?: string | null; importKey?: string | null },
): void {
  db.prepare(
    `INSERT INTO models (id, name, provider, model_id, base_url, import_key, created_at, updated_at)
     VALUES (?, ?, 'anthropic', ?, ?, ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  ).run(row.id, row.name, row.modelId, row.baseUrl ?? null, row.importKey ?? null);
}

/** A models row with the 039 columns set explicitly (contract fixtures a to c). */
function insertOriginRow(
  db: RealDb,
  row: {
    id: string;
    name: string;
    modelId: string;
    baseUrl?: string | null;
    lastImportedName: string | null;
    lastImportedBaseUrl: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO models (id, name, provider, model_id, base_url, origin, last_imported_name, last_imported_base_url, created_at, updated_at)
     VALUES (?, ?, 'anthropic', ?, ?, 'import', ?, ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  ).run(row.id, row.name, row.modelId, row.baseUrl ?? null, row.lastImportedName, row.lastImportedBaseUrl);
}

const SONNET = "anthropic/claude-sonnet-4";

function importSonnet(over: { name?: string; baseUrl?: string | null } = {}): UpsertModelResult {
  return upsertModel({
    name: over.name ?? SONNET,
    provider: "anthropic",
    modelId: SONNET,
    baseUrl: over.baseUrl === undefined ? null : over.baseUrl,
    contextLength: null,
    defaultSlots: [],
  });
}

function freshHome(): void {
  rmSync(hermesHome, { recursive: true, force: true });
  mkdirSync(hermesHome, { recursive: true });
}

beforeEach(() => {
  testDb = openMemoryDb();
  execBaselineSchema(testDb);
  // The contract has tests/helpers/baseline-db.ts apply 039 itself. Until it
  // does, apply the applier here when it exists, so the repository tests red on
  // the keep-rule rather than on a column the fixture forgot.
  const applier = loadOriginApplier();
  if (applier && !cols(testDb, "models").includes("origin")) {
    applier.applyModelsOriginMigration(testDb, migrationsDir);
  }
  jest.clearAllMocks();
  freshHome();
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

afterAll(() => rmSync(hermesHome, { recursive: true, force: true }));

// ═══════════════════════════════════════════════════════════════
// FUSE
// ═══════════════════════════════════════════════════════════════

describe("FUSE: this file writes only where it is allowed to", () => {
  it("resolves the Hermes home inside the OS temp directory", () => {
    const { getHermesDefaultRoot } = require("@/modules/hermes/lib/profile-paths") as {
      getHermesDefaultRoot: () => string;
    };
    expect(getHermesDefaultRoot().startsWith(tmpdir())).toBe(true);
  });

  it("agrees with the path bundle the import will read", () => {
    const { getActiveHermesPaths } = require("@/modules/hermes/lib/agent-runtime") as {
      getActiveHermesPaths: () => { root: string; config: string };
    };
    expect(getActiveHermesPaths().root).toContain("ps-b6-origin-");
    expect(getActiveHermesPaths().config).toContain("ps-b6-origin-");
  });
});

// ═══════════════════════════════════════════════════════════════
// (A) migration 039
// ═══════════════════════════════════════════════════════════════

describe("migration 039: models.origin and the last-imported pair", () => {
  describe("the head constant cannot drift from the chain", () => {
    it("the applier module exists and claims 39", () => {
      const applier = loadOriginApplier();
      expect(applier).not.toBeNull();
      expect(applier?.MODELS_ORIGIN_SCHEMA_VERSION).toBe(39);
    });

    it("039 is on the ladder at or below the head", () => {
      // 039 was the head when this oracle was written; 040 displaced it in
      // T-0108. The head-equality assertion moved with it, to
      // b14-runs-spend-source-migration.test.ts, which is where the head is now
      // pinned. What stays here is the part that is about 039: its gate is a
      // real rung, and the ladder never walks backwards past it.
      const applier = loadOriginApplier();
      expect(applier?.MODELS_ORIGIN_SCHEMA_VERSION).toBe(39);
      expect(MIGRATION_HEAD_SCHEMA_VERSION).toBeGreaterThanOrEqual(39);
    });

    it("sits exactly one above the gate it displaced", () => {
      const applier = loadOriginApplier();
      expect(applier?.MODELS_ORIGIN_SCHEMA_VERSION).toBe(OPERATOR_PREFS_SCHEMA_VERSION + 1);
    });

    it("GREEN CONTROL: the older rung still holds", () => {
      // Deepening the ladder, not replacing it: operator prefs stays one above
      // composer-node-cancelled, so no exported gate goes unchecked.
      expect(OPERATOR_PREFS_SCHEMA_VERSION).toBe(COMPOSER_NODE_CANCELLED_SCHEMA_VERSION + 1);
    });

    it("039_models_origin.sql is on disk, at or below the highest number", () => {
      const numbers = readdirSync(migrationsDir)
        .filter((f) => /^\d{3}_.*\.sql$/.test(f))
        .map((f) => parseInt(f.slice(0, 3), 10));
      expect(numbers.length).toBeGreaterThan(20);
      expect(Math.max(...numbers)).toBeGreaterThanOrEqual(39);
      expect(readdirSync(migrationsDir)).toContain("039_models_origin.sql");
    });
  });

  describe("runMigrations on a v38 database", () => {
    // A pre-039 database with its rows ALREADY IN IT, which is the shape an
    // installed database has when it climbs. Seeding before the climb is the
    // only way to exercise the backfill: execMigrationFile runs the whole .sql
    // in one exec() and execIdempotent swallows the first "duplicate column
    // name", so re-running 039 against a database that already has the columns
    // silently skips the UPDATE that follows them.
    function legacyDbWithRows(seed: (db: RealDb) => void = () => {}): RealDb {
      const db = openMemoryDb();
      db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
      db.exec(readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8"));
      setSchemaVersion(db, 2);
      seed(db);
      return db;
    }

    it("adds the three columns and climbs to the head", () => {
      const db = legacyDbWithRows();
      runMigrations(db);

      expect(cols(db, "models")).toEqual(
        expect.arrayContaining(["origin", "last_imported_name", "last_imported_base_url"]),
      );
      expect(getSchemaVersion(db)).toBe(MIGRATION_HEAD_SCHEMA_VERSION);
      expect(tableNames(db)).toContain("operator_prefs");
      db.close();
    });

    it("backfills origin from import_key and name = model_id", () => {
      const db = legacyDbWithRows((seeded) => {
        // A: imported through POST /api/models/import (import_key NULL, named after its id).
        insertLegacyRow(seeded, { id: "A", name: SONNET, modelId: SONNET, baseUrl: "https://api.anthropic.com" });
        // B: imported by the prebuild script (import_key set).
        insertLegacyRow(seeded, { id: "B", name: "Opus", modelId: "anthropic/claude-opus-4", importKey: "deadbeefdeadbeef" });
        // C: an operator's own row.
        insertLegacyRow(seeded, { id: "C", name: "My proxy", modelId: "anthropic/claude-haiku-4", baseUrl: "https://proxy.local/v1" });
      });

      runMigrations(db);

      const a = rawRow(db, "A");
      expect(a.origin).toBe("import");
      expect(a.last_imported_name).toBe(SONNET);
      expect(a.last_imported_base_url).toBe("https://api.anthropic.com");

      const b = rawRow(db, "B");
      expect(b.origin).toBe("import");
      expect(b.last_imported_name).toBe("Opus");
      expect(b.last_imported_base_url).toBeNull();

      const c = rawRow(db, "C");
      expect(c.origin).toBe("user");
      expect(c.last_imported_name).toBeNull();
      expect(c.last_imported_base_url).toBeNull();
      // The backfill classifies; it never rewrites the operator's values.
      expect(c.name).toBe("My proxy");
      expect(c.base_url).toBe("https://proxy.local/v1");
      db.close();
    });

    it("a second runMigrations on the upgraded database is a no-op", () => {
      const db = legacyDbWithRows((seeded) =>
        insertLegacyRow(seeded, { id: "A", name: SONNET, modelId: SONNET }),
      );
      runMigrations(db);
      const before = rawRow(db, "A");
      // Anchor the idempotence check on a row the backfill actually touched.
      expect(before.origin).toBe("import");

      expect(() => runMigrations(db)).not.toThrow();
      expect(getSchemaVersion(db)).toBe(MIGRATION_HEAD_SCHEMA_VERSION);
      expect(rawRow(db, "A")).toEqual(before);
      db.close();
    });

    it("a prebuild-shaped v3 database with an import_key row reaches 'import' on the first climb", () => {
      // prebuild-db.mjs applies 001 and pins 3, then hermes-registry-import.mjs
      // inserts rows with import_key and no origin columns. The app's first
      // getDb() climbs the ladder; the 039 backfill is what classifies them.
      const db = openMemoryDb();
      db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
      db.exec(readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8"));
      setSchemaVersion(db, 3);
      insertLegacyRow(db, { id: "P", name: SONNET, modelId: SONNET, importKey: "0123456789abcdef" });

      let last = getSchemaVersion(db);
      for (let i = 0; i < 8; i++) {
        runMigrations(db);
        const next = getSchemaVersion(db);
        if (next === last) break;
        last = next;
      }

      expect(getSchemaVersion(db)).toBe(MIGRATION_HEAD_SCHEMA_VERSION);
      expect(rawRow(db, "P").origin).toBe("import");
      expect(rawRow(db, "P").last_imported_name).toBe(SONNET);
      db.close();
    });
  });

  describe("the applier on its own", () => {
    it("applies 039 to a database at 38 and returns 39", () => {
      const applier = loadOriginApplier();
      expect(applier).not.toBeNull();
      // NOT execBaselineSchema: after B6 that helper applies 039 itself, so the
      // columns would be there whatever the applier did.
      const db = openMemoryDb();
      db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
      db.exec(readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8"));
      setSchemaVersion(db, 38);

      expect(applier!.applyModelsOriginMigration(db, migrationsDir)).toBe(39);
      expect(cols(db, "models")).toContain("origin");
      // 039 alone, not the whole chain: this case is about the applier's own
      // gate, so the version afterwards is 39 however far the ladder now goes.
      expect(getSchemaVersion(db)).toBe(39);
      db.close();
    });

    it("guards on >= 39 and returns the current version untouched", () => {
      const applier = loadOriginApplier();
      expect(applier).not.toBeNull();
      // NOT execBaselineSchema: after B6 that helper applies 039 itself, so the
      // columns would be there whatever the applier did.
      const db = openMemoryDb();
      db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
      db.exec(readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8"));
      setSchemaVersion(db, 40);

      expect(applier!.applyModelsOriginMigration(db, migrationsDir)).toBe(40);
      expect(cols(db, "models")).not.toContain("origin");
      expect(getSchemaVersion(db)).toBe(40);
      db.close();
    });

    it("origin refuses a value outside import | user", () => {
      // CHECK (origin IN ('import','user')): a typo cannot land as a third
      // origin the keep-rule does not know about.
      const applier = loadOriginApplier();
      expect(applier).not.toBeNull();
      expect(() =>
        testDb!
          .prepare(
            `INSERT INTO models (id, name, provider, model_id, origin, created_at, updated_at)
             VALUES ('X', 'x', 'anthropic', 'x', 'seed', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
          )
          .run(),
      ).toThrow(/CHECK|constraint/i);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// (B) the keep-rule
// ═══════════════════════════════════════════════════════════════

describe("upsertModel keeps operator edits (D10)", () => {
  it("(a) a renamed row keeps its name through a re-import, and says so", () => {
    insertOriginRow(testDb!, {
      id: "m1",
      name: "Claude Sonnet 4 (production)",
      modelId: SONNET,
      lastImportedName: SONNET,
      lastImportedBaseUrl: null,
    });

    const result = importSonnet();

    expect(result.action).toBe("updated");
    expect(result.id).toBe("m1");
    expect(preservedOf(result)).toEqual(["name"]);
    expect(getModel("m1")?.name).toBe("Claude Sonnet 4 (production)");
  });

  it("(b) a name still equal to the last import follows the import", () => {
    insertOriginRow(testDb!, {
      id: "m1",
      name: SONNET,
      modelId: SONNET,
      lastImportedName: SONNET,
      lastImportedBaseUrl: null,
    });

    const result = importSonnet({ name: `${SONNET} (v2)` });

    expect(result.action).toBe("updated");
    expect(preservedOf(result)).toEqual([]);
    const row = originOf(getModel("m1"));
    expect(row.name).toBe(`${SONNET} (v2)`);
    expect(row.lastImportedName).toBe(`${SONNET} (v2)`);
  });

  it("(c) an operator's base URL survives, and the import records what it wanted", () => {
    insertOriginRow(testDb!, {
      id: "m1",
      name: SONNET,
      modelId: SONNET,
      baseUrl: "https://proxy.local/v1",
      lastImportedName: SONNET,
      lastImportedBaseUrl: null,
    });

    const result = importSonnet({ baseUrl: "https://api.anthropic.com" });

    expect(preservedOf(result)).toEqual(["baseUrl"]);
    const row = originOf(getModel("m1"));
    expect(row.baseUrl).toBe("https://proxy.local/v1");
    expect(row.lastImportedBaseUrl).toBe("https://api.anthropic.com");
  });

  it("(c) a base URL still equal to the last import is overwritten", () => {
    insertOriginRow(testDb!, {
      id: "m1",
      name: SONNET,
      modelId: SONNET,
      baseUrl: "https://api.anthropic.com",
      lastImportedName: SONNET,
      lastImportedBaseUrl: "https://api.anthropic.com",
    });

    const result = importSonnet({ baseUrl: "https://gateway.example/v1" });

    expect(preservedOf(result)).toEqual([]);
    const row = originOf(getModel("m1"));
    expect(row.baseUrl).toBe("https://gateway.example/v1");
    expect(row.lastImportedBaseUrl).toBe("https://gateway.example/v1");
  });

  it("(d) a createModel row is 'user' with nothing imported yet", () => {
    const created = originOf(
      createModel({ name: "My Sonnet", provider: "anthropic", modelId: SONNET, baseUrl: "https://proxy.local/v1" }),
    );

    expect(created.origin).toBe("user");
    expect(created.lastImportedName).toBeNull();
    expect(created.lastImportedBaseUrl).toBeNull();
  });

  it("(d) a matching import leaves a 'user' row's name, base URL and origin alone", () => {
    const created = createModel({
      name: "My Sonnet",
      provider: "anthropic",
      modelId: SONNET,
      baseUrl: "https://proxy.local/v1",
    });

    const result = importSonnet({ baseUrl: "https://api.anthropic.com" });

    expect(result.action).toBe("updated");
    expect(result.id).toBe(created.id);
    expect(preservedOf(result)).toEqual(["name", "baseUrl"]);
    const row = originOf(getModel(created.id));
    expect(row.origin).toBe("user");
    expect(row.name).toBe("My Sonnet");
    expect(row.baseUrl).toBe("https://proxy.local/v1");
    expect(row.lastImportedName).toBe(SONNET);
    expect(row.lastImportedBaseUrl).toBe("https://api.anthropic.com");
  });

  it("(d) a 'user' row that never had a base URL still has none after an import", () => {
    // Sweep survivor `keep-never-imported-loses`. The never-imported disjunct
    // in the keep-rule is redundant for `name` (a non-null name can never equal
    // a null last_imported_name) and load-bearing only here: with base_url and
    // last_imported_base_url both NULL, dropping it makes the two equal, and an
    // import would quietly give an operator's own row a base URL it never had.
    const created = createModel({ name: "My Sonnet", provider: "anthropic", modelId: SONNET, baseUrl: null });

    const result = importSonnet({ baseUrl: "https://api.anthropic.com" });

    expect(result.id).toBe(created.id);
    const row = originOf(getModel(created.id));
    expect(row.baseUrl).toBeNull();
    expect(row.lastImportedBaseUrl).toBe("https://api.anthropic.com");
    expect(row.origin).toBe("user");
  });

  it("(e) an upsert-inserted row is 'import' with last_imported_* equal to its values", () => {
    const result = importSonnet({ baseUrl: "https://api.anthropic.com" });

    expect(result.action).toBe("inserted");
    expect(preservedOf(result)).toEqual([]);
    const row = originOf(getModel(result.id));
    expect(row.origin).toBe("import");
    expect(row.name).toBe(SONNET);
    expect(row.lastImportedName).toBe(SONNET);
    expect(row.lastImportedBaseUrl).toBe("https://api.anthropic.com");
  });

  it("the whole loop: import, rename, re-import, and the rename is still there", () => {
    // The defect as the operator met it, in repository terms: every page load
    // ran this sequence and the rename lasted until the next render.
    const first = importSonnet();
    updateModel(first.id, { name: "Claude Sonnet 4 (production)" });

    const second = importSonnet();

    expect(second.id).toBe(first.id);
    expect(preservedOf(second)).toEqual(["name"]);
    expect(getModel(first.id)?.name).toBe("Claude Sonnet 4 (production)");
    expect(listModels()).toHaveLength(1);
  });

  it("GREEN CONTROL: a matching import still claims its default slots", () => {
    const { getModelDefaults } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const first = importSonnet();

    upsertModel({
      name: SONNET,
      provider: "anthropic",
      modelId: SONNET,
      baseUrl: null,
      contextLength: null,
      defaultSlots: ["agent", "vision"],
    });

    expect(getModelDefaults().agent).toBe(first.id);
    expect(getModelDefaults().vision).toBe(first.id);
  });

  it("GREEN CONTROL: a matching import spares context_length and credentials_id, as today", () => {
    const created = createModel({
      name: "My Sonnet",
      provider: "anthropic",
      modelId: SONNET,
      contextLength: 200000,
    });

    importSonnet();

    expect(getModel(created.id)?.contextLength).toBe(200000);
    expect(getModel(created.id)?.credentialsId).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// (C) route-level, contract line (f)
// ═══════════════════════════════════════════════════════════════

describe("PUT /api/models/[id] then POST /api/models/import (real DB, temp Hermes root)", () => {
  interface RouteResponse {
    status: number;
    json: () => Promise<unknown>;
  }
  type Ctx = { params: Promise<{ id: string }> };

  function makeRequest(url: string, method?: string, body?: unknown) {
    const { NextRequest } = jest.requireMock("next/server") as {
      NextRequest: new (url: string, init?: RequestInit) => unknown;
    };
    return new NextRequest(url, {
      method: method ?? "GET",
      headers: body ? new Headers({ "content-type": "application/json" }) : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  function importRoute() {
    return require("@/app/api/models/import/route") as {
      POST: (req: unknown) => Promise<RouteResponse>;
    };
  }

  function idRoute() {
    return require("@/app/api/models/[id]/route") as {
      GET: (req: unknown, ctx: Ctx) => Promise<RouteResponse>;
      PUT: (req: unknown, ctx: Ctx) => Promise<RouteResponse>;
    };
  }

  const ctxFor = (id: string): Ctx => ({ params: Promise.resolve({ id }) });

  async function bodyOf<T = Record<string, unknown>>(res: RouteResponse): Promise<{ status: number; data: T }> {
    const json = (await res.json()) as { data: T };
    return { status: res.status, data: json.data };
  }

  function writeConfigNaming(modelId: string): void {
    writeFileSync(
      join(hermesHome, "config.yaml"),
      yaml.dump({
        model: { default: modelId, provider: "anthropic", base_url: "https://api.anthropic.com" },
        agent: { max_turns: 40 },
      }),
      "utf-8",
    );
  }

  async function postImport() {
    return bodyOf<{
      modelsImported: number;
      details: Array<{ name: string; action: string; reason?: string }>;
    }>(await importRoute().POST(makeRequest("http://localhost/api/models/import", "POST")));
  }

  it("(f) a rename survives a re-import against a config.yaml naming that model", async () => {
    writeConfigNaming(SONNET);

    const first = await postImport();
    expect(first.status).toBe(200);
    expect(first.data.modelsImported).toBe(1);
    const id = listModels()[0]!.id;

    const put = await idRoute().PUT(
      makeRequest(`http://localhost/api/models/${id}`, "PUT", { name: "Renamed" }),
      ctxFor(id),
    );
    expect(put.status).toBe(200);

    const second = await postImport();
    expect(second.status).toBe(200);

    const got = await bodyOf<{ model: { name: string } }>(
      await idRoute().GET(makeRequest(`http://localhost/api/models/${id}`), ctxFor(id)),
    );
    expect(got.status).toBe(200);
    expect(got.data.model.name).toBe("Renamed");
    // One row, not a duplicate under the imported name.
    expect(listModels()).toHaveLength(1);
  });

  it("the import's details say what it kept", async () => {
    writeConfigNaming(SONNET);
    await postImport();
    const id = listModels()[0]!.id;
    await idRoute().PUT(
      makeRequest(`http://localhost/api/models/${id}`, "PUT", { name: "Renamed" }),
      ctxFor(id),
    );

    const second = await postImport();

    const detail = second.data.details.find((d) => d.name === SONNET);
    expect(detail?.action).toBe("updated");
    expect(detail?.reason).toContain("kept operator edits: name");
  });

  it("GREEN CONTROL: a first import against an empty registry inserts, with the plain reason", async () => {
    writeConfigNaming(SONNET);

    const first = await postImport();

    const detail = first.data.details.find((d) => d.name === SONNET);
    expect(detail?.action).toBe("inserted");
    expect(detail?.reason).toContain(`provider=anthropic model=${SONNET}`);
    expect(detail?.reason ?? "").not.toContain("kept operator edits");
  });
});
