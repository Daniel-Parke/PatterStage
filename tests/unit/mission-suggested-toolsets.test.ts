/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

import { execBaselineSchema } from "../helpers/baseline-db";

let testDb: import("better-sqlite3").Database | null = null;

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

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

beforeEach(() => {
  const Database = loadRealBetterSqlite3();
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("mission suggested_toolsets", () => {
  it("round-trips suggestedToolsets on create and update", () => {
    const { createMission, getMission, updateMission } =
      require("@/lib/mission-repository") as typeof import("@/lib/mission-repository");

    const created = createMission({
      name: "Tool hint mission",
      prompt: "Do work",
      suggestedToolsets: ["terminal", "file"],
    });
    expect(created.suggestedToolsets).toEqual(["terminal", "file"]);

    const loaded = getMission(created.id);
    expect(loaded?.suggestedToolsets).toEqual(["terminal", "file"]);

    updateMission(created.id, { suggestedToolsets: ["hermes-cli"] });
    const updated = getMission(created.id);
    expect(updated?.suggestedToolsets).toEqual(["hermes-cli"]);
  });
});
