// Unit tests for the dashboard polling unwrap helper
// (src/lib/dashboard-poll.ts)

import { unwrapPollPath } from "@/lib/dashboard-poll";

describe("unwrapPollPath", () => {
  it("returns the inner object on a single-wrap envelope", () => {
    // /api/agents: { data: { processes: [...] } } — path is empty
    const result = unwrapPollPath({ data: { processes: ["a", "b"] } }, []);
    expect(result).toEqual({ processes: ["a", "b"] });
  });

  it("walks a multi-segment path through a double-wrap envelope", () => {
    // Mimics /api/monitor: { data: { data: MonitorData } } → walk ["data"] to reach the inner object
    const result = unwrapPollPath(
      { data: { data: { monitor: { foo: 1 } } } },
      ["data"],
    );
    expect(result).toEqual({ monitor: { foo: 1 } });
  });

  it("walks two segments to a triple-wrap envelope", () => {
    const result = unwrapPollPath(
      { data: { data: { data: { ok: true } } } },
      ["data", "data"],
    );
    expect(result).toEqual({ ok: true });
  });

  it("returns null when an intermediate path segment is missing", () => {
    // First segment exists but the second is undefined
    expect(unwrapPollPath({ data: { notdata: {} } }, ["data", "data"])).toBeNull();
  });

  it("returns null when envelope.data is missing", () => {
    expect(unwrapPollPath({}, ["data"])).toBeNull();
  });

  it("returns null when envelope.data is null", () => {
    expect(unwrapPollPath({ data: null }, ["data"])).toBeNull();
  });

  it("returns null when a path segment is not an object", () => {
    expect(unwrapPollPath({ data: "not-an-object" }, ["data", "data"])).toBeNull();
  });

  it("returns null when the final cursor is a primitive", () => {
    // The cursor must be an object at the end so the caller's key access is safe
    expect(unwrapPollPath({ data: 42 }, [])).toBeNull();
  });

  it("returns null when the final cursor is null", () => {
    expect(unwrapPollPath({ data: null }, [])).toBeNull();
  });

  it("returns null when the final cursor is undefined", () => {
    expect(unwrapPollPath({ data: undefined }, [])).toBeNull();
  });

  it("preserves an empty object at the final cursor", () => {
    expect(unwrapPollPath({ data: {} }, [])).toEqual({});
  });

  it("handles an empty path with a top-level data envelope", () => {
    // Polling for endpoints whose response is the inner data directly
    const result = unwrapPollPath({ data: { missions: [] } }, []);
    expect(result).toEqual({ missions: [] });
  });
});
