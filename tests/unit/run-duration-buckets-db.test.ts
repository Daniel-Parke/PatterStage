/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// Regression: getRunDurationBuckets must compute real durations from the
// ISO-8601 (Z-suffixed) timestamps that now() writes. A prior version appended
// a second 'Z' before Date.parse, yielding NaN → an all-zero histogram.

import { openBaselineDb } from "../helpers/baseline-db";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));

import { getRunDurationBuckets } from "@/lib/analytics/run-aggregates";

describe("getRunDurationBuckets (DB, ISO-with-Z timestamps)", () => {
  beforeEach(() => {
    testDb = openBaselineDb(); // includes the runs table
  });
  afterEach(() => {
    testDb?.close();
    testDb = null;
  });

  it("buckets a completed run's real duration (not lost to a double-Z NaN)", () => {
    const submitted = new Date().toISOString();
    const completed = new Date(Date.parse(submitted) + 7000).toISOString(); // +7s
    testDb!
      .prepare(
        "INSERT INTO runs (id, status, submitted_at, completed_at, updated_at) VALUES (?, 'completed', ?, ?, ?)",
      )
      .run("r1", submitted, completed, completed);

    const bins = getRunDurationBuckets(90);
    const byLabel = Object.fromEntries(bins.map((b) => [b.label, b.value]));
    expect(byLabel["5–15s"]).toBe(1); // 7s landed in its bucket
    expect(bins.reduce((s, b) => s + b.value, 0)).toBe(1);
  });
});
