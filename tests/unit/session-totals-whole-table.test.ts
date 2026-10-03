/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// ═══════════════════════════════════════════════════════════════
// T-0042 acceptance oracle, repository half.
//
// The defect: the Sessions insights strip is handed the 50-row PAGE and
// computes `total: sessions.length` from it, so the tile labelled TOTAL
// reported the page size while the header directly above it reported the
// real COUNT(*). ACTIVE, MESSAGES and CLI were page-scoped by the same
// mechanism; only TOTAL was caught, because only TOTAL had a contradicting
// number printed beside it.
//
// The fix the operator ruled is real totals for all four, which needs ONE
// aggregate in the sessions repository. This file holds the repository half
// of the claim:
//
//   1. the four figures are whole-table, not page-scoped;
//   2. `total` (the header's number) and `totals.total` (the tile's number)
//      are the SAME number under every filter, offset and search, because
//      they are read off the same aggregate rather than counted twice;
//   3. no row is silently dropped: the per-source counts sum to the total,
//      including source values the UI does not have a bucket for (the
//      operator's real database holds `subagent` and `tui` rows, which the
//      old fixed four-key map counted as nothing at all);
//   4. the number /api/monitor publishes as `sessions.total` is the same
//      number the tile shows.
//
// The seed is built to be hostile to the old behaviour: the newest 50 rows
// (exactly one page) are all completed `api` sessions carrying zero
// messages, so a page-scoped ACTIVE / MESSAGES / CLI reads 0 and a
// page-scoped TOTAL reads 50, against a table of 137.
//
// Authored before any file under src/ was edited. Every case below was red
// on write, except the one marked as a guard.
// ═══════════════════════════════════════════════════════════════

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

// ── The seed ────────────────────────────────────────────────

/** Exactly one page of the newest rows. */
const PAGE_ROWS = 50;
/** Everything the tiles are supposed to count lives below the fold. */
const OLDER_ROWS = 87;
const TOTAL_ROWS = PAGE_ROWS + OLDER_ROWS; // 137

const BASE_MS = Date.UTC(2026, 7, 26, 12, 0, 0);

interface Seed {
  id: string;
  source: string;
  status: string;
  messageCount: number | null;
  startedAt: string;
  title: string;
  profile: string | null;
}

/** A token planted on a known subset so the search path can be pinned exactly. */
const SEARCH_TOKEN = "quasar";
const SEARCH_MATCHES = 9; // j = 0, 10, 20, ... 80

function buildSeed(): Seed[] {
  const rows: Seed[] = [];

  // The newest 50: one full page, deliberately unrepresentative of the table.
  for (let i = 0; i < PAGE_ROWS; i++) {
    rows.push({
      id: `page-${String(i).padStart(3, "0")}`,
      source: "api",
      status: "completed",
      messageCount: 0,
      startedAt: new Date(BASE_MS - i * 60_000).toISOString(),
      title: `Routine api call ${i}`,
      profile: null,
    });
  }

  // The older 87: every active session, every cli session and every message
  // in the table sits here, out of reach of any page-scoped sum.
  for (let j = 0; j < OLDER_ROWS; j++) {
    const source =
      j < 61 ? "cli"
      : j < 74 ? "mission"
      : j < 81 ? "cron"
      : j < 84 ? "api"
      // Not one of the four the strip draws buckets for. The operator's real
      // database holds rows like this, so the aggregate has to carry them.
      : "subagent";
    const status = j < 21 ? "active" : j < 30 ? "failed" : "completed";
    rows.push({
      id: `old-${String(j).padStart(3, "0")}`,
      source,
      status,
      messageCount: j % 5 === 0 ? null : (j + 1) * 3,
      startedAt: new Date(BASE_MS - (60 + j) * 60_000).toISOString(),
      title: j % 10 === 0 ? `Deep dive ${j} ${SEARCH_TOKEN}` : `Deep dive ${j}`,
      profile: `profile-${j % 4}`,
    });
  }

  return rows;
}

const SEED = buildSeed();

/** What the four figures must be, derived from the seed rather than guessed. */
const EXPECTED = {
  total: TOTAL_ROWS,
  active: SEED.filter((r) => r.status === "active").length,
  messages: SEED.reduce((sum, r) => sum + (r.messageCount ?? 0), 0),
  cli: SEED.filter((r) => r.source === "cli").length,
  bySource: SEED.reduce<Record<string, number>>((acc, r) => {
    acc[r.source] = (acc[r.source] ?? 0) + 1;
    return acc;
  }, {}),
};

/** What each figure would read if it were computed from the loaded page. */
const PAGE_SCOPED = {
  total: PAGE_ROWS,
  active: 0,
  messages: 0,
  cli: 0,
};

function openDb(withMessageCountColumn = true): void {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  testDb.exec(baselineSql);
  // The seed carries no parent missions, and the baseline enables FKs.
  testDb.pragma("foreign_keys = OFF");
  // 001_baseline predates 006_sessions_message_count, so a baseline-only
  // database is exactly the shape a fresh install has on its first boot.
  if (withMessageCountColumn) {
    testDb.exec("ALTER TABLE sessions ADD COLUMN message_count INTEGER");
  }
  const insert = testDb.prepare(
    `INSERT INTO sessions (id, agent_type, source, profile_name, title, size, started_at, status${
      withMessageCountColumn ? ", message_count" : ""
    })
     VALUES (?, 'hermes', ?, ?, ?, 0, ?, ?${withMessageCountColumn ? ", ?" : ""})`,
  );
  const insertAll = testDb.transaction((rows: Seed[]) => {
    for (const r of rows) {
      const args: (string | number | null)[] = [
        r.id,
        r.source,
        r.profile,
        r.title,
        r.startedAt,
        r.status,
      ];
      if (withMessageCountColumn) args.push(r.messageCount);
      insert.run(...args);
    }
  });
  insertAll(SEED);
}

beforeEach(() => openDb());
afterEach(() => {
  testDb?.close();
  testDb = null;
});

function sum(counts: Record<string, number>): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

// ── 1. The four figures are whole-table ─────────────────────

describe("listSessions totals are whole-table, not page-scoped", () => {
  it("counts every row, not the 50 the page loaded", () => {
    const { sessions, totals } = listSessions({ limit: PAGE_ROWS });

    // The page really is one page: this is the number the old tile printed.
    expect(sessions).toHaveLength(PAGE_ROWS);
    expect(PAGE_SCOPED.total).toBe(PAGE_ROWS);

    expect(totals.total).toBe(EXPECTED.total);
    expect(totals.total).not.toBe(PAGE_SCOPED.total);
  });

  it("counts active sessions the page cannot see", () => {
    const { sessions, totals } = listSessions({ limit: PAGE_ROWS });
    expect(sessions.filter((s) => s.status === "active")).toHaveLength(PAGE_SCOPED.active);
    expect(totals.active).toBe(EXPECTED.active);
    expect(EXPECTED.active).toBeGreaterThan(0);
  });

  it("sums messages across the table, not across the page", () => {
    const { sessions, totals } = listSessions({ limit: PAGE_ROWS });
    const onPage = sessions.reduce((n, s) => n + (s.messageCount ?? 0), 0);
    expect(onPage).toBe(PAGE_SCOPED.messages);
    expect(totals.messages).toBe(EXPECTED.messages);
    expect(EXPECTED.messages).toBeGreaterThan(0);
  });

  it("counts cli sessions across the table, not across the page", () => {
    const { sessions, totals } = listSessions({ limit: PAGE_ROWS });
    expect(sessions.filter((s) => s.source === "cli")).toHaveLength(PAGE_SCOPED.cli);
    expect(totals.bySource.cli).toBe(EXPECTED.cli);
  });
});

// ── 2. Header and tile cannot disagree ──────────────────────

describe("the header number and the tile number are one number", () => {
  it.each([
    ["page 1", { limit: 50, offset: 0 }],
    ["page 2", { limit: 50, offset: 50 }],
    ["page 3", { limit: 50, offset: 100 }],
    ["past the end", { limit: 50, offset: 500 }],
    ["monitor's five-row peek", { limit: 5, offset: 0 }],
  ])("agree for %s", (_label, opts) => {
    const { total, totals } = listSessions(opts);
    expect(total).toBe(totals.total);
    expect(total).toBe(TOTAL_ROWS);
  });

  it.each([
    ["source filter", { source: "cli" as const }, EXPECTED.cli],
    ["search", { search: SEARCH_TOKEN }, SEARCH_MATCHES],
    ["source filter and search together", { source: "cli" as const, search: SEARCH_TOKEN }, 7],
  ])("agree under a %s", (_label, opts, expected) => {
    const { total, totals } = listSessions({ ...opts, limit: PAGE_ROWS });
    expect(total).toBe(expected);
    expect(totals.total).toBe(total);
  });

  it("stays in agreement when the filter empties the table", () => {
    const { sessions, total, totals } = listSessions({ search: "no-such-session-anywhere" });
    expect(sessions).toHaveLength(0);
    expect(total).toBe(0);
    expect(totals.total).toBe(0);
    expect(totals.active).toBe(0);
    expect(totals.messages).toBe(0);
    expect(sum(totals.bySource)).toBe(0);
  });
});

// ── 3. Nothing is silently dropped ──────────────────────────

describe("the per-source breakdown accounts for every row", () => {
  it("sums to the total", () => {
    const { totals } = listSessions({ limit: PAGE_ROWS });
    expect(sum(totals.bySource)).toBe(totals.total);
  });

  it("carries source values the strip has no bucket for", () => {
    const { totals } = listSessions({ limit: PAGE_ROWS });
    // A fixed {cli, mission, cron, api} map counts these as nothing, which is
    // how a donut can be drawn whose segments do not add up to its own centre.
    expect(totals.bySource.subagent).toBe(EXPECTED.bySource.subagent);
    expect(totals.bySource).toEqual(EXPECTED.bySource);
  });

  it("narrows the breakdown with the filter, still summing to the total", () => {
    const { total, totals } = listSessions({ source: "cli", limit: PAGE_ROWS });
    expect(totals.bySource).toEqual({ cli: EXPECTED.cli });
    expect(sum(totals.bySource)).toBe(total);
  });

  it("never reports more active sessions than sessions", () => {
    const { totals } = listSessions({ limit: PAGE_ROWS });
    expect(totals.active).toBeLessThanOrEqual(totals.total);
  });
});

// ── 4. Agreement with /api/monitor ──────────────────────────

describe("agreement with the number /api/monitor publishes", () => {
  it("monitor's sessions.total is the tile's total", () => {
    // src/app/api/monitor/route.ts calls listSessions({ limit: 5 }) and
    // publishes its `total` as MonitorData.sessions.total.
    const monitor = listSessions({ limit: 5 });
    // src/app/api/sessions/route.ts serves the Sessions page.
    const page = listSessions({ limit: PAGE_ROWS, offset: 0 });

    expect(monitor.total).toBe(page.totals.total);
    expect(monitor.totals).toEqual(page.totals);
  });
});

// ── 5. Guard: the pre-006 schema ────────────────────────────

describe("a database without sessions.message_count", () => {
  // Not red on write: today's listSessions never names the column in SQL, so
  // it cannot fail on its absence. It is here because the new aggregate DOES
  // name it, and 001_baseline.sql does not create it, which is the exact
  // shape of a fresh install on its first boot (runMigrations returns early
  // after applying the baseline, before apply-legacy-column-repair runs).
  // A totals query that throws here takes the whole Sessions page down.
  beforeEach(() => {
    testDb?.close();
    openDb(false);
  });

  it("still lists and still counts, reporting zero messages", () => {
    const { sessions, total, totals } = listSessions({ limit: PAGE_ROWS });
    expect(sessions).toHaveLength(PAGE_ROWS);
    expect(total).toBe(TOTAL_ROWS);
    expect(totals.total).toBe(TOTAL_ROWS);
    expect(totals.active).toBe(EXPECTED.active);
    expect(totals.messages).toBe(0);
  });
});
