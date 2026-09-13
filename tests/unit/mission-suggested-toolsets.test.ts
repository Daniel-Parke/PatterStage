/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

import { openBaselineDb } from "../helpers/baseline-db";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));

beforeEach(() => {
  testDb = openBaselineDb();
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("mission suggested_toolsets", () => {
  it("round-trips suggestedToolsets on create and update", () => {
    const { createMission, getMission, updateMission } =
      require("@/lib/missions/mission-repository") as typeof import("@/lib/missions/mission-repository");

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
