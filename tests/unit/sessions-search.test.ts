/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// Server-side session search (QA #12): the term must match across the FULL
// table (title / id / profile / mission), not just a loaded page. Drives
// listSessions against a real in-memory SQLite DB with the @/lib/db singleton
// mocked.

import { readFileSync } from "fs";
import { join } from "path";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => {
  const actual = jest.requireActual("@/lib/db") as typeof import("@/lib/db");
  return { ...actual, getDb: () => testDb! };
});

import { listSessions } from "@/lib/sessions/session-repository";

const baselineSql = readFileSync(
  join(process.cwd(), "src", "lib", "db", "migrations", "001_baseline.sql"),
  "utf-8",
);

function seedSession(args: {
  id: string;
  title?: string | null;
  profile?: string | null;
  missionId?: string | null;
  source?: string;
}): void {
  testDb!
    .prepare(
      `INSERT INTO sessions (id, agent_type, source, mission_id, profile_name, title, size, started_at, status)
       VALUES (?, 'hermes', ?, ?, ?, ?, 0, ?, 'completed')`,
    )
    .run(
      args.id,
      args.source ?? "cli",
      args.missionId ?? null,
      args.profile ?? null,
      args.title ?? null,
      new Date().toISOString(),
    );
}

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(":memory:");
  // Leave FK enforcement OFF — the search test seeds arbitrary mission_ids
  // without standing up parent mission rows (the baseline enables FKs).
  testDb.exec(baselineSql);
  testDb.pragma("foreign_keys = OFF");
  // Noise so the matching row is NOT in any "first page".
  for (let i = 0; i < 60; i++) seedSession({ id: `noise-${i}`, title: `Routine session ${i}` });
});
afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("listSessions — server-side search", () => {
  it("finds a match by title regardless of page position", () => {
    seedSession({ id: "s-hydro", title: "Hydrogen production research" });
    const { sessions, total } = listSessions({ search: "hydrogen", limit: 50 });
    expect(total).toBe(1);
    expect(sessions[0]?.id).toBe("s-hydro");
  });

  it("matches id, profile, and mission too, case-insensitively", () => {
    seedSession({ id: "WEIRD-ID-123", title: "x" });
    seedSession({ id: "p1", title: "y", profile: "DevOps-Engineer" });
    seedSession({ id: "m1", title: "z", missionId: "mission-abc-99" });
    expect(listSessions({ search: "weird-id" }).total).toBe(1);
    expect(listSessions({ search: "devops" }).total).toBe(1);
    expect(listSessions({ search: "abc-99" }).total).toBe(1);
  });

  it("treats % and _ as literals (escaped)", () => {
    seedSession({ id: "lit", title: "50% complete" });
    expect(listSessions({ search: "50%" }).total).toBe(1);
    // '%' must NOT behave as a wildcard matching the noise rows.
    expect(listSessions({ search: "%" }).total).toBe(1);
  });

  it("returns everything when search is blank", () => {
    expect(listSessions({ search: "  " }).total).toBe(60);
  });
});
