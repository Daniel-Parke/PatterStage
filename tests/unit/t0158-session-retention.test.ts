/** @jest-environment node */
/** ADR-0014: browser-session retention through the public session API and real SQLite. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { migrationsDir, openRealDb, type RealDb } from "../helpers/baseline-db";

let testDb: RealDb | null = null;
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));

const NOW = Date.parse("2026-10-28T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 30 * DAY_MS;
const VERIFIED_ROOT_TOKEN = "t0158-retention-oracle-root-token";
const previousToken = process.env.PS_AUTH_TOKEN;

type SessionApi = typeof import("@/lib/auth/session-store");
type CreateWithVerifiedCredential = (verifiedCredential: string) => ReturnType<SessionApi["createBrowserSession"]>;
type SessionRow = { id: string };

function sessionApi(): SessionApi {
  return jest.requireActual("@/lib/auth/session-store") as SessionApi;
}

function createWithVerifiedCredential(): ReturnType<SessionApi["createBrowserSession"]> {
  return (sessionApi().createBrowserSession as CreateWithVerifiedCredential)(VERIFIED_ROOT_TOKEN);
}

function rowIds(): string[] {
  return (testDb!.prepare("SELECT id FROM auth_sessions ORDER BY id").all() as SessionRow[]).map((row) => row.id);
}

function mint(): { id: string; secret: string } {
  const before = new Set(rowIds());
  const { secret } = createWithVerifiedCredential();
  const added = rowIds().filter((id) => !before.has(id));
  expect(added).toHaveLength(1);
  return { id: added[0], secret };
}

function setTimes(
  id: string,
  times: { created: number; lastActive: number; idle: number; absolute: number; revoked?: number | null },
): void {
  testDb!.prepare(`
    UPDATE auth_sessions
       SET created_at_ms = ?, last_active_at_ms = ?, idle_expires_at_ms = ?,
           absolute_expires_at_ms = ?, revoked_at_ms = ?
     WHERE id = ?
  `).run(times.created, times.lastActive, times.idle, times.absolute, times.revoked ?? null, id);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  process.env.PS_AUTH_TOKEN = VERIFIED_ROOT_TOKEN;
  jest.resetModules();
  (jest.requireActual("@/lib/auth/boot-state") as typeof import("@/lib/auth/boot-state")).initialiseBootState();
  testDb = openRealDb();
  testDb.pragma("foreign_keys = ON");
  testDb.exec(readFileSync(join(migrationsDir, "043_auth_sessions.sql"), "utf8"));
});

afterEach(() => {
  testDb?.close();
  testDb = null;
  jest.useRealTimers();
  if (previousToken === undefined) delete process.env.PS_AUTH_TOKEN;
  else process.env.PS_AUTH_TOKEN = previousToken;
});

test("Given revoked sessions straddling 30 days, the next sign-in retains minus one millisecond and prunes equality", () => {
  const justInside = mint();
  const atBoundary = mint();
  const insideRevokedAt = NOW - RETENTION_MS + 1;
  const boundaryRevokedAt = NOW - RETENTION_MS;
  for (const [id, revokedAt] of [[justInside.id, insideRevokedAt], [atBoundary.id, boundaryRevokedAt]] as const) {
    setTimes(id, {
      created: revokedAt - 60 * 60 * 1000,
      lastActive: revokedAt - 60 * 60 * 1000,
      revoked: revokedAt,
      idle: revokedAt + 60 * 60 * 1000,
      absolute: revokedAt + 60 * 60 * 1000,
    });
  }

  const newSession = mint();
  expect(rowIds()).toContain(justInside.id);
  expect(rowIds()).not.toContain(atBoundary.id);
  expect(rowIds()).toContain(newSession.id);
});

test("Given idle expiry reached the retention boundary first, sign-in prunes that row", () => {
  const idleExpired = mint();
  setTimes(idleExpired.id, {
    created: NOW - RETENTION_MS - DAY_MS,
    lastActive: NOW - RETENTION_MS - DAY_MS,
    idle: NOW - RETENTION_MS,
    absolute: NOW - RETENTION_MS + DAY_MS,
  });

  mint();
  expect(rowIds()).not.toContain(idleExpired.id);
});

test("Given absolute expiry reached the retention boundary first, sign-in prunes it but preserves an old active row", () => {
  const absoluteExpired = mint();
  const active = mint();
  setTimes(absoluteExpired.id, {
    created: NOW - RETENTION_MS - DAY_MS,
    lastActive: NOW - RETENTION_MS - DAY_MS,
    idle: NOW - RETENTION_MS + DAY_MS,
    absolute: NOW - RETENTION_MS,
  });
  setTimes(active.id, {
    created: NOW - 60 * DAY_MS,
    lastActive: NOW - 60 * 1000,
    idle: NOW + 29 * 60 * 1000,
    absolute: NOW + 60 * 60 * 1000,
  });

  mint();
  expect(rowIds()).not.toContain(absoluteExpired.id);
  expect(rowIds()).toContain(active.id);
});

test("Given eligible cleanup fails, sign-in rolls back and returns no browser secret", () => {
  const expired = mint();
  setTimes(expired.id, {
    created: NOW - RETENTION_MS - DAY_MS,
    lastActive: NOW - RETENTION_MS - DAY_MS,
    idle: NOW - RETENTION_MS,
    absolute: NOW - RETENTION_MS + DAY_MS,
  });
  testDb!.exec(`
    CREATE TRIGGER refuse_retention_delete BEFORE DELETE ON auth_sessions
    BEGIN SELECT RAISE(ABORT, 'forced retention delete failure'); END;
  `);
  const before = rowIds();
  let issued: ReturnType<SessionApi["createBrowserSession"]> | undefined;

  expect(() => { issued = createWithVerifiedCredential(); }).toThrow(/forced retention delete failure/);
  expect(issued).toBeUndefined();
  expect(rowIds()).toEqual(before);
});

test("Given insertion fails after eligible cleanup, the transaction restores the deleted row", () => {
  const expired = mint();
  setTimes(expired.id, {
    created: NOW - RETENTION_MS - DAY_MS,
    lastActive: NOW - RETENTION_MS - DAY_MS,
    idle: NOW - RETENTION_MS,
    absolute: NOW - RETENTION_MS + DAY_MS,
  });
  testDb!.exec(`
    CREATE TRIGGER refuse_retention_insert BEFORE INSERT ON auth_sessions
    BEGIN SELECT RAISE(ABORT, 'forced retention insert failure'); END;
  `);
  const before = rowIds();
  let issued: ReturnType<SessionApi["createBrowserSession"]> | undefined;

  expect(() => { issued = createWithVerifiedCredential(); }).toThrow(/forced retention insert failure/);
  expect(issued).toBeUndefined();
  expect(rowIds()).toEqual(before);
});

// One synchronous in-memory connection cannot pause renewal between SELECT and UPDATE.
// A concurrent renewal that read a row just before expiry must recheck expiry and
// revocation in its UPDATE; otherwise it could extend idle expiry after eligibility.
test("Given a row is pruned, a later renewal cannot recreate or validate it", () => {
  const expired = mint();
  setTimes(expired.id, {
    created: NOW - RETENTION_MS - DAY_MS,
    lastActive: NOW - RETENTION_MS - DAY_MS,
    idle: NOW - RETENTION_MS,
    absolute: NOW - RETENTION_MS + DAY_MS,
  });

  mint();
  expect(rowIds()).not.toContain(expired.id);
  expect(sessionApi().validateBrowserSession(expired.secret, true)).toBeNull();
  expect(rowIds()).not.toContain(expired.id);
});
