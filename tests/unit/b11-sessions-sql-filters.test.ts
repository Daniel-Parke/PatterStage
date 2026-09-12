/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3 is loaded by its real path so the moduleNameMapper's stub is bypassed; the sessions repository is exercised against a real table, exactly as session-totals-whole-table.test.ts does */
// ═══════════════════════════════════════════════════════════════
// B11 oracle, the repository half (T-0105, contract §1 §2 §3 §4).
//
// Written before the product code moved. What each case pins:
//
//   D31  "Hide API noise" measures the wrong quantity. isApiNoiseSession
//        computes `now - startedAt` and drops anything older than a minute,
//        so it hides RECENT api rows rather than SHORT-LIVED ones, and the
//        list is sorted started_at DESC — the toggle therefore removes the
//        top of the list and leaves the stress-test noise it was written to
//        hide untouched. The predicate becomes a duration, and it moves into
//        SQL so `total` and the tiles describe the same set the rows do.
//   D30  A Failed filter needs a status condition the API can ask for.
//   D29  Filtering by a source the UI has no word for has to be possible,
//        so the listing publishes the source values that EXIST rather than
//        the four the badge map knows, and it keeps publishing them while a
//        source filter is in force (otherwise narrowing to `cli` deletes
//        every other button and traps the user).
//   D35  Every list GET syncs up to 10,000 rows from the agent's state.db
//        inline. A short guard makes a burst pay for one sync, not N.
//
// The seed is hostile to the old behaviour: the api rows that ARE noise are
// days old, and the api row that is not noise is recent.
// ═══════════════════════════════════════════════════════════════

import { readFileSync } from "fs";
import { join } from "path";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => {
  const actual = jest.requireActual("@/lib/db") as typeof import("@/lib/db");
  return { ...actual, getDb: () => testDb! };
});

const mockSync = jest.fn();
jest.mock("@/lib/sessions/session-sync", () => ({
  syncHermesSessionsToDb: (...args: unknown[]) => mockSync(...args),
}));

// The query parser pulls the background sync layer in through its module
// graph; nothing here wants it started.
jest.mock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn() }));

import { NextRequest } from "next/server";

import * as sessionRepo from "@/lib/sessions/session-repository";
import type { ListSessionsOptions, SessionRecord } from "@/lib/sessions/session-repository";
import {
  parseSessionQuery,
  type ParsedSessionQuery,
} from "@/lib/sessions/sessions-api-helpers";

// ── post-B11 signature shim ─────────────────────────────────
//
// `source` widens to the free-text column it always was, and three options
// join it. The cast is the pre-B11 shim, not a way round the type: after the
// contract lands, every field below exists on the real signature.

type B11ListOptions = Omit<ListSessionsOptions, "source"> & {
  source?: string;
  status?: "active" | "completed" | "failed";
  excludeApiNoise?: boolean;
};

interface B11ListResult {
  sessions: SessionRecord[];
  total: number;
  totals: { total: number; active: number; messages: number; bySource: Record<string, number> };
  /** Every source value in the table, so a filter cannot delete its own buttons. */
  sources: string[];
}

const listSessions = sessionRepo.listSessions as unknown as (
  opts?: B11ListOptions,
) => B11ListResult;

/** The same widening on the parsed query the route hands to the repository. */
type B11Query = Omit<ParsedSessionQuery, "source"> & {
  source?: string;
  status?: "active" | "completed" | "failed";
  excludeApiNoise?: boolean;
};

const resetInlineSyncGuard = (
  sessionRepo as unknown as { _resetInlineSyncGuardForTests?: () => void }
)._resetInlineSyncGuardForTests;

const baselineSql = readFileSync(
  join(process.cwd(), "src", "lib", "db", "migrations", "001_baseline.sql"),
  "utf-8",
);

// ── The seed ────────────────────────────────────────────────

const NOW_MS = Date.UTC(2026, 8, 5, 12, 0, 0);
const at = (msBefore: number): string => new Date(NOW_MS - msBefore).toISOString();

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface Seed {
  id: string;
  source: string;
  status: string;
  size: number;
  startedAt: string;
  endedAt: string | null;
}

/**
 * Six rows chosen so that "short-lived" and "recent" point in opposite
 * directions. `api-short-old` is the row the operator wants gone: 30 seconds
 * of work, three days ago. The current age predicate keeps it and drops
 * `api-live` instead, which is the one session on the list still running.
 */
const SEED: Seed[] = [
  {
    id: "api-short-old",
    source: "api",
    status: "completed",
    size: 200,
    startedAt: at(3 * DAY),
    endedAt: at(3 * DAY - 30 * SECOND),
  },
  {
    id: "api-short-recent",
    source: "api",
    status: "completed",
    size: 200,
    startedAt: at(20 * SECOND),
    endedAt: at(10 * SECOND),
  },
  {
    id: "api-long",
    source: "api",
    status: "completed",
    size: 200,
    startedAt: at(40 * MINUTE),
    endedAt: at(10 * MINUTE),
  },
  {
    id: "api-live",
    source: "api",
    status: "active",
    size: 200,
    startedAt: at(10 * MINUTE),
    endedAt: null,
  },
  {
    id: "api-big",
    source: "api",
    status: "failed",
    size: 4096,
    startedAt: at(2 * DAY),
    endedAt: at(2 * DAY - 5 * SECOND),
  },
  {
    id: "cli-short",
    source: "cli",
    status: "completed",
    size: 100,
    startedAt: at(5 * DAY),
    endedAt: at(5 * DAY - 5 * SECOND),
  },
  {
    id: "subagent-run",
    source: "subagent",
    status: "failed",
    size: 900,
    startedAt: at(6 * HOUR),
    endedAt: at(5 * HOUR),
  },
  {
    id: "tui-run",
    source: "tui",
    status: "completed",
    size: 900,
    startedAt: at(7 * HOUR),
    endedAt: at(6 * HOUR),
  },
];

/** The two rows the toggle exists to remove: api, under 1KB, under a minute. */
const NOISE_IDS = ["api-short-old", "api-short-recent"];
const KEPT_IDS = SEED.map((r) => r.id).filter((id) => !NOISE_IDS.includes(id));

function openDb(): void {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  testDb.exec(baselineSql);
  testDb.pragma("foreign_keys = OFF");
  testDb.exec("ALTER TABLE sessions ADD COLUMN message_count INTEGER");
  const insert = testDb.prepare(
    `INSERT INTO sessions (id, agent_type, source, title, size, started_at, ended_at, status, message_count)
     VALUES (?, 'hermes', ?, ?, ?, ?, ?, ?, 1)`,
  );
  for (const r of SEED) {
    insert.run(r.id, r.source, `Session ${r.id}`, r.size, r.startedAt, r.endedAt, r.status);
  }
}

function idsOf(result: B11ListResult): string[] {
  return result.sessions.map((s) => s.id).sort();
}

beforeEach(() => {
  jest.clearAllMocks();
  resetInlineSyncGuard?.();
  openDb();
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

// ═══════════════════════════════════════════════════════════════
// D31 — the noise predicate is a duration, and it is in SQL
// ═══════════════════════════════════════════════════════════════

describe("hiding API noise removes short-lived api sessions, whatever their age", () => {
  it("GREEN CONTROL: without the option every row is listed", () => {
    const result = listSessions({ limit: 100 });

    expect(idsOf(result)).toEqual(SEED.map((r) => r.id).sort());
    expect(result.total).toBe(SEED.length);
  });

  it("drops a 30-second api session that ran three days ago", () => {
    const result = listSessions({ limit: 100, excludeApiNoise: true });

    expect(result.sessions.map((s) => s.id)).not.toContain("api-short-old");
  });

  it("GUARD: keeps the api session that is still running, however recent it is", () => {
    // The age predicate hid exactly this row — the one session on the page a
    // person is most likely to be waiting on. The guard is green before and
    // after (the old filter ran in the browser, not here); it is the thing
    // the duration predicate must not break.
    const result = listSessions({ limit: 100, excludeApiNoise: true });

    expect(result.sessions.map((s) => s.id)).toContain("api-live");
  });

  it("keeps a long api session, a big one, and anything that is not api", () => {
    const result = listSessions({ limit: 100, excludeApiNoise: true });

    expect(idsOf(result)).toEqual([...KEPT_IDS].sort());
  });

  it("the count and the tiles describe the filtered set, not the unfiltered one", () => {
    // The old filter ran on the loaded page in the browser, so `total` and
    // every tile still counted the rows the list no longer showed.
    const result = listSessions({ limit: 100, excludeApiNoise: true });

    expect(result.total).toBe(KEPT_IDS.length);
    expect(result.totals.total).toBe(KEPT_IDS.length);
    expect(result.totals.bySource.api).toBe(3);
  });

  it("composes with a source filter", () => {
    const result = listSessions({ limit: 100, source: "api", excludeApiNoise: true });

    expect(idsOf(result)).toEqual(["api-big", "api-live", "api-long"]);
  });
});

// ═══════════════════════════════════════════════════════════════
// D30 — a status filter, so "Failed" is a filter and not a search
// ═══════════════════════════════════════════════════════════════

describe("the listing can be narrowed to one status", () => {
  it("returns only the failed rows, and counts only them", () => {
    const result = listSessions({ limit: 100, status: "failed" });

    expect(idsOf(result)).toEqual(["api-big", "subagent-run"]);
    expect(result.total).toBe(2);
    expect(result.totals.total).toBe(2);
  });

  it("composes with a source filter", () => {
    // `api` holds five rows and exactly one of them failed, so a status
    // filter that is quietly ignored answers with five.
    const result = listSessions({ limit: 100, status: "failed", source: "api" });

    expect(idsOf(result)).toEqual(["api-big"]);
  });

  it("active is still active", () => {
    const result = listSessions({ limit: 100, status: "active" });

    expect(idsOf(result)).toEqual(["api-live"]);
    expect(result.totals.active).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// D29 — the source vocabulary comes from the table
// ═══════════════════════════════════════════════════════════════

describe("the listing publishes the source values that exist", () => {
  it("names every source in the table, including ones the badge map has no word for", () => {
    const result = listSessions({ limit: 100 });

    expect(result.sources).toEqual(["api", "cli", "subagent", "tui"]);
  });

  it("keeps naming them while a source filter is in force", () => {
    // Otherwise narrowing to one source deletes every other filter button and
    // the only way back is the browser's Back.
    const result = listSessions({ limit: 100, source: "cli" });

    expect(result.sources).toEqual(["api", "cli", "subagent", "tui"]);
    expect(idsOf(result)).toEqual(["cli-short"]);
  });

  it("GUARD: filters by a source the UI has no badge for", () => {
    // The repository always passed `source` through as a string; the gate that
    // dropped `subagent` is `parseSessionQuery`, below. Green before and after.
    const result = listSessions({ limit: 100, source: "subagent" });

    expect(idsOf(result)).toEqual(["subagent-run"]);
    expect(result.total).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// The query string is where D29, D30 and D31 reach the repository
// ═══════════════════════════════════════════════════════════════

describe("the query string carries the new filters", () => {
  function parse(query: string): B11Query {
    return parseSessionQuery(
      new NextRequest(`http://localhost/api/sessions?${query}`),
    ) as B11Query;
  }

  it("accepts a source the badge map has no word for", () => {
    // pickEnum against the four known names is what makes `subagent` and
    // `tui` unfilterable today: the parameter is dropped and the answer is
    // the unfiltered list, which reads as "the filter did nothing".
    expect(parse("source=subagent").source).toBe("subagent");
    expect(parse("source=tui").source).toBe("tui");
    expect(parse("source=chat").source).toBe("chat");
  });

  it("GUARD: still refuses a source that is not a source", () => {
    expect(parse("source=" + encodeURIComponent("../../etc/passwd")).source).toBeUndefined();
    expect(parse("source=" + encodeURIComponent("a b")).source).toBeUndefined();
    expect(parse("").source).toBeUndefined();
  });

  it("reads the status filter", () => {
    expect(parse("status=failed").status).toBe("failed");
    expect(parse("status=active").status).toBe("active");
    expect(parse("status=nonsense").status).toBeUndefined();
    expect(parse("").status).toBeUndefined();
  });

  it("reads the hide-API-noise toggle", () => {
    expect(parse("hideApiNoise=1").excludeApiNoise).toBe(true);
    expect(parse("").excludeApiNoise).toBeFalsy();
  });

  it("GUARD: the bounds it already parsed are untouched", () => {
    const q = parse("limit=100&offset=50&search=%20quasar%20");
    expect({ limit: q.limit, offset: q.offset, search: q.search }).toEqual({
      limit: 100,
      offset: 50,
      search: "quasar",
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// D35 — one inline state.db sync per burst
// ═══════════════════════════════════════════════════════════════

describe("the inline state.db sync is guarded", () => {
  it("syncs once for a burst of list reads", () => {
    listSessions({ limit: 50, syncIfActive: true });
    listSessions({ limit: 50, syncIfActive: true });
    listSessions({ limit: 50, syncIfActive: true });

    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  it("syncs again once the guard window has passed", () => {
    const realNow = Date.now;
    try {
      let clock = NOW_MS;
      Date.now = () => clock;

      listSessions({ limit: 50, syncIfActive: true });
      clock += 3_000;
      listSessions({ limit: 50, syncIfActive: true });

      expect(mockSync).toHaveBeenCalledTimes(2);
    } finally {
      Date.now = realNow;
    }
  });

  it("a throwing sync does not re-arm itself on the next request", () => {
    mockSync.mockImplementation(() => {
      throw new Error("state.db is locked");
    });

    expect(() => listSessions({ limit: 50, syncIfActive: true })).not.toThrow();
    listSessions({ limit: 50, syncIfActive: true });

    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  it("GREEN CONTROL: a caller that did not ask for a sync never triggers one", () => {
    listSessions({ limit: 50 });

    expect(mockSync).not.toHaveBeenCalled();
  });
});
