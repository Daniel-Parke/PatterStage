/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B3 (T-0097): migration 038, operator_prefs. One small table for the things
 * the operator sets about the console itself (the rail collapsed, the dispatch
 * strip open, quests completed or skipped, the guide hidden, the last help
 * page), behind a Zod allow-list so the route cannot become a free-form store.
 */
import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";
import { mockRequest } from "../helpers/api-test-helpers";
import { MIGRATION_HEAD_SCHEMA_VERSION, getSchemaVersion } from "@/lib/db-schema";
import { OPERATOR_PREFS_SCHEMA_VERSION, applyOperatorPrefsMigration } from "@/lib/db/apply-operator-prefs-migration";

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

import { OPERATOR_PREF_KEYS, readOperatorPrefs, writeOperatorPref } from "@/lib/operator-prefs-repository";
import { GET, PUT } from "@/app/api/prefs/route";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  applyOperatorPrefsMigration(testDb, migrationsDir);
});
afterEach(() => {
  testDb?.close();
  testDb = null;
  delete process.env.PS_READ_ONLY;
});

describe("migration 038", () => {
  it("is the head, and creates the table", () => {
    expect(OPERATOR_PREFS_SCHEMA_VERSION).toBe(38);
    expect(MIGRATION_HEAD_SCHEMA_VERSION).toBe(38);
    const cols = (testDb!.prepare("PRAGMA table_info(operator_prefs)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["key", "value_json", "updated_at"]));
    expect(getSchemaVersion(testDb!)).toBe(38);
  });

  it("is idempotent", () => {
    expect(applyOperatorPrefsMigration(testDb!, migrationsDir)).toBe(38);
  });
});

describe("the repository", () => {
  it("starts empty and round-trips a known key", () => {
    expect(readOperatorPrefs()).toEqual({});
    writeOperatorPref("sidebar.collapsed", true);
    expect(readOperatorPrefs()).toEqual({ "sidebar.collapsed": true });
    writeOperatorPref("sidebar.collapsed", false);
    expect(readOperatorPrefs()["sidebar.collapsed"]).toBe(false);
  });

  it("knows the six keys the plan names", () => {
    expect([...OPERATOR_PREF_KEYS].sort()).toEqual(
      ["dispatchStrip.open", "guide.hidden", "help.lastSlug", "quests.completedAt", "quests.skipped", "sidebar.collapsed"].sort(),
    );
  });

  it("refuses an unknown key and a value of the wrong shape", () => {
    expect(() => writeOperatorPref("theme.colour", "red")).toThrow(/unknown/i);
    expect(() => writeOperatorPref("sidebar.collapsed", "yes")).toThrow();
    expect(() => writeOperatorPref("quests.completedAt", { "1.1": 42 })).toThrow();
    expect(readOperatorPrefs()).toEqual({});
  });

  it("stores the structured keys as they are", () => {
    writeOperatorPref("quests.completedAt", { "1.1": "2026-09-05T10:00:00Z" });
    writeOperatorPref("quests.skipped", ["2.3"]);
    writeOperatorPref("help.lastSlug", "start-here/first-hour");
    expect(readOperatorPrefs()).toEqual({
      "quests.completedAt": { "1.1": "2026-09-05T10:00:00Z" },
      "quests.skipped": ["2.3"],
      "help.lastSlug": "start-here/first-hour",
    });
  });
});

describe("GET and PUT /api/prefs", () => {
  it("PUT writes a known key and answers the whole map", async () => {
    const res = await PUT(mockRequest("http://localhost/api/prefs", "PUT", { key: "sidebar.collapsed", value: true }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { prefs: Record<string, unknown> } };
    expect(body.data.prefs).toEqual({ "sidebar.collapsed": true });

    const got = await GET();
    expect(got.status).toBe(200);
    expect(((await got.json()) as { data: { prefs: Record<string, unknown> } }).data.prefs).toEqual({ "sidebar.collapsed": true });
  });

  it("PUT refuses an unknown key and a wrong shape with 400, naming the key", async () => {
    const unknown = await PUT(mockRequest("http://localhost/api/prefs", "PUT", { key: "theme.colour", value: "red" }));
    expect(unknown.status).toBe(400);
    expect(((await unknown.json()) as { error: string }).error).toMatch(/theme\.colour/);

    const wrong = await PUT(mockRequest("http://localhost/api/prefs", "PUT", { key: "sidebar.collapsed", value: "yes" }));
    expect(wrong.status).toBe(400);

    const empty = await PUT(mockRequest("http://localhost/api/prefs", "PUT", {}));
    expect(empty.status).toBe(400);
    expect(readOperatorPrefs()).toEqual({});
  });

  it("PUT is refused under PS_READ_ONLY with the read-only sentence", async () => {
    process.env.PS_READ_ONLY = "1";
    const res = await PUT(mockRequest("http://localhost/api/prefs", "PUT", { key: "sidebar.collapsed", value: true }));
    expect(res.status).toBe(503);
    expect(readOperatorPrefs()).toEqual({});
  });
});
