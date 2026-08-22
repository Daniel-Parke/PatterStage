/**
 * sessions-api-helpers — unit tests for the pure helpers extracted
 * from /api/sessions/route.ts. The route handler isn't invoked here;
 * we exercise the helpers directly. `pickEnum` and `parseSessionQuery`
 * take a `NextRequest` and only read from `request.url`, so a
 * constructed request with a synthetic URL is sufficient.
 */

/** @jest-environment node */

import { NextRequest } from "next/server";

import {
  pickEnum,
  parseSessionQuery,
  triggerSyncOnce,
  _resetSyncDebounceForTests,
  ALL_AGENT_TYPES,
  ALL_SOURCES,
  type ParsedSessionQuery,
} from "@/lib/sessions/sessions-api-helpers";

// Mock the sync layer so triggerSyncOnce doesn't try to initialize
// the real background syncer (which would touch the filesystem).
jest.mock("@/lib/sync", () => ({
  ensureSyncLayer: jest.fn(),
}));

import { ensureSyncLayer } from "@/lib/sync";

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/sessions?${query}`);
}

beforeEach(() => {
  jest.clearAllMocks();
  _resetSyncDebounceForTests();
});

describe("pickEnum", () => {
  it("returns the raw value when it matches the allowed tuple", () => {
    expect(pickEnum("cli", ALL_SOURCES)).toBe("cli");
    expect(pickEnum("cron", ALL_SOURCES)).toBe("cron");
    expect(pickEnum("mission", ALL_SOURCES)).toBe("mission");
    expect(pickEnum("api", ALL_SOURCES)).toBe("api");
  });

  it("returns undefined for a null input", () => {
    expect(pickEnum(null, ALL_SOURCES)).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(pickEnum("", ALL_SOURCES)).toBeUndefined();
  });

  it("returns undefined for a value not in the tuple", () => {
    expect(pickEnum("not-a-source", ALL_SOURCES)).toBeUndefined();
    expect(pickEnum("CLI", ALL_SOURCES)).toBeUndefined(); // case-sensitive
  });

  it("works with the agentType tuple too", () => {
    expect(pickEnum("hermes", ALL_AGENT_TYPES)).toBe("hermes");
    expect(pickEnum("nope", ALL_AGENT_TYPES)).toBeUndefined();
  });
});

describe("parseSessionQuery", () => {
  it("returns defaults when no query params are present", () => {
    const result: ParsedSessionQuery = parseSessionQuery(
      new NextRequest("http://localhost/api/sessions"),
    );
    expect(result.agentType).toBeUndefined();
    expect(result.source).toBeUndefined();
    expect(result.missionId).toBeUndefined();
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
    expect(result.id).toBeUndefined();
  });

  it("parses a well-formed id query", () => {
    const result = parseSessionQuery(makeRequest("id=session-42"));
    expect(result.id).toBe("session-42");
  });

  it("parses the agentType and source filters (typed)", () => {
    const result = parseSessionQuery(
      makeRequest("agentType=hermes&source=cron"),
    );
    expect(result.agentType).toBe("hermes");
    expect(result.source).toBe("cron");
  });

  it("ignores unknown enum values rather than throwing", () => {
    const result = parseSessionQuery(
      makeRequest("agentType=nope&source=not-a-source"),
    );
    expect(result.agentType).toBeUndefined();
    expect(result.source).toBeUndefined();
  });

  it("caps limit at 100 to prevent unbounded queries", () => {
    const result = parseSessionQuery(makeRequest("limit=9999"));
    expect(result.limit).toBe(100);
  });

  it("parses the offset", () => {
    const result = parseSessionQuery(makeRequest("offset=150"));
    expect(result.offset).toBe(150);
  });

  it("treats a missing missionId as undefined (not 'any')", () => {
    const result = parseSessionQuery(makeRequest("source=cli"));
    expect(result.missionId).toBeUndefined();
  });

  it("returns empty-string missionId for missionId= (no special null handling)", () => {
    // The current parser does not distinguish ?missionId= from no key at
    // all — both flow through as-is. The empty-string path falls into
    // the `mission_id = ?` SQL branch with `""` as the bound param, which
    // matches no rows. This test pins the current behaviour so a future
    // intentional change (treating empty as explicit null) is a visible
    // break, not a silent regression.
    const result = parseSessionQuery(makeRequest("missionId="));
    expect(result.missionId).toBe("");
  });

  it("treats missionId=foo as a string filter", () => {
    const result = parseSessionQuery(makeRequest("missionId=mission-abc"));
    expect(result.missionId).toBe("mission-abc");
  });

  it("parses a trimmed search term", () => {
    expect(parseSessionQuery(makeRequest("search=hydrogen")).search).toBe("hydrogen");
    expect(parseSessionQuery(makeRequest("search=%20%20spaced%20%20")).search).toBe("spaced");
  });

  it("treats a missing or blank search as undefined", () => {
    expect(parseSessionQuery(makeRequest("")).search).toBeUndefined();
    expect(parseSessionQuery(makeRequest("search=")).search).toBeUndefined();
    expect(parseSessionQuery(makeRequest("search=%20%20")).search).toBeUndefined();
  });
});

describe("triggerSyncOnce", () => {
  it("calls ensureSyncLayer on the first invocation", () => {
    triggerSyncOnce();
    expect(ensureSyncLayer).toHaveBeenCalledTimes(1);
  });

  it("coalesces calls within the debounce window", () => {
    triggerSyncOnce();
    triggerSyncOnce();
    triggerSyncOnce();
    expect(ensureSyncLayer).toHaveBeenCalledTimes(1);
  });

  it("calls ensureSyncLayer again after the debounce expires", () => {
    jest.useFakeTimers();
    try {
      triggerSyncOnce();
      expect(ensureSyncLayer).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(30_000);
      triggerSyncOnce();
      expect(ensureSyncLayer).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it("respects a custom debounceMs value", () => {
    jest.useFakeTimers();
    try {
      triggerSyncOnce(100);
      expect(ensureSyncLayer).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(99);
      triggerSyncOnce(100);
      expect(ensureSyncLayer).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      triggerSyncOnce(100);
      expect(ensureSyncLayer).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
