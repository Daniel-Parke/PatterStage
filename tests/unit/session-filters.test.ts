/**
 * session-filters — unit tests for the pure predicates extracted from
 * the Sessions page (src/app/(main)/sessions/page.tsx). The page isn't
 * rendered here; we just exercise the helpers directly. The fixtures
 * are typed as `SessionRecord` so a future schema change will surface
 * here first.
 */

import {
  searchSessionsByQuery,
  sessionMatchesQuery,
  isApiNoiseSession,
} from "@/lib/session-filters";
import type { SessionRecord } from "@/lib/session-repository";

const FIXED_NOW = new Date("2026-06-02T12:00:00Z").getTime();

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    source: "cli",
    status: "completed",
    startedAt: "2026-06-02T11:59:00Z",
    size: 100,
    ...overrides,
  };
}

describe("sessionMatchesQuery", () => {
  it("returns true for an empty query", () => {
    expect(sessionMatchesQuery(makeSession(), "")).toBe(true);
  });

  it("matches the title (case-insensitive)", () => {
    const s = makeSession({ title: "Hello World" });
    expect(sessionMatchesQuery(s, "hello")).toBe(true);
    expect(sessionMatchesQuery(s, "WORLD")).toBe(true);
  });

  it("matches the id (case-insensitive)", () => {
    const s = makeSession({ id: "AbCdEf-1234" });
    expect(sessionMatchesQuery(s, "abcd")).toBe(true);
  });

  it("matches profileName when present", () => {
    const s = makeSession({ profileName: "default" });
    expect(sessionMatchesQuery(s, "fault")).toBe(true);
  });

  it("matches missionId when present", () => {
    const s = makeSession({ missionId: "mission-42" });
    expect(sessionMatchesQuery(s, "42")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    const s = makeSession({
      id: "aaa",
      title: "Hello",
      profileName: "default",
      missionId: "m-1",
    });
    expect(sessionMatchesQuery(s, "zzz")).toBe(false);
  });

  it("treats null title/profileName/missionId as empty", () => {
    const s = makeSession({
      id: "aaa",
      title: null,
      profileName: null,
      missionId: null,
    });
    // No field can match "zzz" — title/profileName/missionId are null,
    // id is "aaa" which doesn't contain "zzz".
    expect(sessionMatchesQuery(s, "zzz")).toBe(false);
  });
});

describe("searchSessionsByQuery", () => {
  it("returns a new array (defensive copy) for an empty query", () => {
    const sessions = [makeSession({ id: "a" })];
    const result = searchSessionsByQuery(sessions, "");
    expect(result).toEqual(sessions);
    expect(result).not.toBe(sessions); // new reference
  });

  it("filters by id (case-insensitive)", () => {
    const sessions = [
      makeSession({ id: "AAA" }),
      makeSession({ id: "BBB" }),
      makeSession({ id: "AAC" }),
    ];
    expect(searchSessionsByQuery(sessions, "aa").map((s) => s.id)).toEqual([
      "AAA",
      "AAC",
    ]);
  });

  it("filters by title", () => {
    const sessions = [
      makeSession({ id: "1", title: "Refactor plan" }),
      makeSession({ id: "2", title: "Other session" }),
    ];
    expect(searchSessionsByQuery(sessions, "refactor").map((s) => s.id)).toEqual([
      "1",
    ]);
  });

  it("filters by profileName", () => {
    const sessions = [
      makeSession({ id: "1", profileName: "production" }),
      makeSession({ id: "2", profileName: "staging" }),
    ];
    expect(searchSessionsByQuery(sessions, "prod").map((s) => s.id)).toEqual([
      "1",
    ]);
  });

  it("filters by missionId", () => {
    const sessions = [
      makeSession({ id: "1", missionId: "mission-foo" }),
      makeSession({ id: "2", missionId: "mission-bar" }),
    ];
    expect(searchSessionsByQuery(sessions, "foo").map((s) => s.id)).toEqual([
      "1",
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    const sessions = [makeSession({ id: "1", title: "Hello" })];
    expect(searchSessionsByQuery(sessions, "zzz")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const sessions = [makeSession({ id: "AAA" })];
    const original = [...sessions];
    searchSessionsByQuery(sessions, "nothing-matches");
    expect(sessions).toEqual(original);
  });
});

describe("isApiNoiseSession", () => {
  it("returns false for non-api sources", () => {
    const s = makeSession({ source: "cli", size: 10, startedAt: "2026-06-02T11:59:30Z" });
    expect(isApiNoiseSession(s, FIXED_NOW)).toBe(false);
  });

  it("returns true for api sources that are tiny and recent", () => {
    const s = makeSession({
      source: "api",
      size: 100, // < 1KB
      startedAt: "2026-06-02T11:59:30Z", // 30s ago
    });
    expect(isApiNoiseSession(s, FIXED_NOW)).toBe(true);
  });

  it("returns false for api sources that are large enough", () => {
    const s = makeSession({
      source: "api",
      size: 1024, // exactly 1KB — not noise
      startedAt: "2026-06-02T11:59:30Z",
    });
    expect(isApiNoiseSession(s, FIXED_NOW)).toBe(false);
  });

  it("returns false for api sources that are over a minute old", () => {
    const s = makeSession({
      source: "api",
      size: 100,
      startedAt: "2026-06-02T11:58:30Z", // 90s ago
    });
    expect(isApiNoiseSession(s, FIXED_NOW)).toBe(false);
  });

  it("treats the 60s boundary as inclusive (exactly 60s old is still noise)", () => {
    // isApiNoiseSession uses `ageMs > 60_000` to *exclude*; so an exact
    // 60_000 ms age is NOT greater than 60_000, and the session is still
    // classified as noise. The boundary only flips at 60_000 + 1 ms.
    const s = makeSession({
      source: "api",
      size: 100,
      startedAt: new Date(FIXED_NOW - 60_000).toISOString(),
    });
    expect(isApiNoiseSession(s, FIXED_NOW)).toBe(true);
  });

  it("returns false at 60_001ms (just past the boundary)", () => {
    const s = makeSession({
      source: "api",
      size: 100,
      startedAt: new Date(FIXED_NOW - 60_001).toISOString(),
    });
    expect(isApiNoiseSession(s, FIXED_NOW)).toBe(false);
  });

  it("returns true for an api session that is < 1s old", () => {
    const s = makeSession({
      source: "api",
      size: 0,
      startedAt: new Date(FIXED_NOW - 100).toISOString(),
    });
    expect(isApiNoiseSession(s, FIXED_NOW)).toBe(true);
  });
});
