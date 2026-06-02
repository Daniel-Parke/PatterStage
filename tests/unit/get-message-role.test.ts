// Unit tests for getMessageRole (src/components/session/constants.tsx).
//
// The session detail page calls this in 3 places: role counts, the role
// filter, and the "scroll to next role" jump. The shared helper
// guarantees a single source of truth for the "unknown" default and
// the lower-casing so the tests below cover the contract rather than
// any individual callsite.

import { getMessageRole } from "@/components/session/constants";

describe("getMessageRole", () => {
  it("returns the role when present", () => {
    expect(getMessageRole({ role: "user" })).toBe("user");
    expect(getMessageRole({ role: "assistant" })).toBe("assistant");
    expect(getMessageRole({ role: "tool" })).toBe("tool");
  });

  it("lowercases the role for direct `===` comparison with the ROLE_META keys", () => {
    expect(getMessageRole({ role: "USER" })).toBe("user");
    expect(getMessageRole({ role: "Assistant" })).toBe("assistant");
    expect(getMessageRole({ role: "Tool" })).toBe("tool");
  });

  it("returns 'unknown' when the role field is missing", () => {
    expect(getMessageRole({})).toBe("unknown");
  });

  it("returns 'unknown' when the role is null or empty string", () => {
    expect(getMessageRole({ role: null })).toBe("unknown");
    expect(getMessageRole({ role: "" })).toBe("unknown");
  });

  it("lowercases whitespace-only 'unknown' to the same value", () => {
    // The original code had `(msg.role || "unknown").toLowerCase()`,
    // so any falsy role becomes "unknown". A whitespace string is
    // truthy and would round-trip to the lowercased version.
    expect(getMessageRole({ role: "  " })).toBe("  ");
  });
});
