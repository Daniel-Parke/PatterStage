/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B3 (T-0097): migration 038, operator_prefs. One small table for the things
 * the operator sets about the console itself (the rail collapsed, the dispatch
 * strip open, quests completed or skipped, the guide hidden, the last help
 * page), behind a Zod allow-list so the route cannot become a free-form store.
 */
import { join } from "path";
import { openBaselineDb } from "../helpers/baseline-db";
import { mockRequest } from "../helpers/api-test-helpers";
import { MIGRATION_HEAD_SCHEMA_VERSION, getSchemaVersion } from "@/lib/db-schema";
import { OPERATOR_PREFS_SCHEMA_VERSION, applyOperatorPrefsMigration } from "@/lib/db/sql-migrations";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));

import { OPERATOR_PREF_KEYS, readOperatorPrefs, writeOperatorPref } from "@/lib/system/operator-prefs-repository";
import { GET, PUT } from "@/app/api/prefs/route";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

beforeEach(() => {
  testDb = openBaselineDb([applyOperatorPrefsMigration]);
});
afterEach(() => {
  testDb?.close();
  testDb = null;
  delete process.env.PS_READ_ONLY;
});

describe("migration 038", () => {
  it("is a rung the head counts, and creates the table", () => {
    expect(OPERATOR_PREFS_SCHEMA_VERSION).toBe(38);
    // 038 was the head when B3 landed; T-0100's 039 moved it. The head is
    // pinned to the newest applier by run-migrations-upgrade.integration,
    // which is where that check belongs. What matters here is that 038 is
    // still on the ladder the head counts to.
    expect(MIGRATION_HEAD_SCHEMA_VERSION).toBeGreaterThanOrEqual(OPERATOR_PREFS_SCHEMA_VERSION);
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

  // "PUT is refused under PS_READ_ONLY with the read-only sentence" was here.
  // It called PUT() directly, and app-06 (ruled 2026-09-12) deleted the route's
  // own requireNotReadOnly("preferences"): /api/prefs is not host-side, so
  // src/proxy.ts refuses the method before the handler and is the only
  // boundary. k5-the-ruled-security-fixes.test.ts drives PUT /api/prefs through
  // proxy() under the mode and requires the 503 and its remedy sentence.
});
