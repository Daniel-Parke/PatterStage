/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- real DB module with an owned in-memory constructor */
import { openRealDb, type RealDb } from "../helpers/baseline-db";
let testDb: RealDb | null = null;
jest.mock("better-sqlite3", () => function OracleDatabase() {
  if (!testDb) throw new Error("INFRASTRUCTURE: owned SQLite handle is not ready");
  return testDb;
});
jest.mock("@/lib/db", () => jest.requireActual("@/lib/db"));
jest.mock("next/server", () => require("../helpers/mocks").nextServerMock());
jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn() }));

import { getDb, getSchemaHealth } from "@/lib/db";
import { GET } from "@/app/api/mission-categories/route";
import type { NextRequest } from "next/server";

beforeAll(() => {
  testDb = openRealDb();
  expect(getDb()).toBe(testDb);
});
afterAll(() => { testDb?.close(); testDb = null; });
const request = () => new (jest.requireMock("next/server").NextRequest)("http://localhost/api/mission-categories") as NextRequest;

describe("T-0189 actual schema-health boundary", () => {
  it("healthy SQLite produces real schema health and a normal categories response", async () => {
    expect(getSchemaHealth()).toMatchObject({ schemaVersion: 43, hasMissionCategoriesTable: true });
    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.schemaVersion).toBe(43);
    expect(Array.isArray(body.data.categories)).toBe(true);
  });
  it("a genuinely missing category table produces migrationRequired 503 rather than a generic 500", async () => {
    testDb!.pragma("foreign_keys = OFF");
    testDb!.exec("DROP TABLE mission_categories");
    expect(getSchemaHealth()).toMatchObject({ schemaVersion: 43, hasMissionCategoriesTable: false, categoryCount: 0 });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ migrationRequired: true, schemaVersion: 43,
      error: expect.stringContaining("mission_categories table is missing") });
    expect(testDb!.prepare("SELECT name FROM sqlite_master WHERE name='mission_categories'").get()).toBeUndefined();
  });
});
