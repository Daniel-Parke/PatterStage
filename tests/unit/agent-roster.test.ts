/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// The neutral agent roster: core's only question about agent_profiles.
//
// That table belongs to the hermes module (ADR-0005 rule 2), so mission dispatch
// can no longer read it. What dispatch actually needed was never the 17-column
// row -- only "which agents exist", to resolve what the operator typed into a
// canonical slug. These tests pin the two behaviours dispatch relied on: an
// unknown key passes through unchanged, and a broken module store cannot take
// the dispatch path down.
// ═══════════════════════════════════════════════════════════════

const mockListAgentRoster = jest.fn();
jest.mock("@/lib/modules/server", () => ({
  SERVER_MODULES: [
    { id: "rec-room" }, // a module supplying no roster at all
    { id: "hermes", listAgentRoster: () => mockListAgentRoster() },
  ],
}));

import { listAgentRoster, resolveAgentSlug } from "@/lib/agents/roster";

beforeEach(() => {
  jest.clearAllMocks();
  mockListAgentRoster.mockReturnValue([
    { slug: "qa", displayName: "QA Engineer" },
    { slug: "swe", displayName: "SWE" },
  ]);
});

describe("listAgentRoster", () => {
  it("collects across modules and ignores those that supply none", () => {
    expect(listAgentRoster()).toEqual([
      { slug: "qa", displayName: "QA Engineer" },
      { slug: "swe", displayName: "SWE" },
    ]);
  });

  it("returns [] when a module's store throws, rather than propagating", () => {
    // An operator with no agent installed should see an empty picker, not a crash.
    mockListAgentRoster.mockImplementation(() => {
      throw new Error("no such table: agent_profiles");
    });
    expect(listAgentRoster()).toEqual([]);
  });
});

describe("resolveAgentSlug", () => {
  it("resolves a slug to itself", () => {
    expect(resolveAgentSlug("qa")).toBe("qa");
  });

  it("resolves a display name to its slug", () => {
    // This is the case that matters: the composer shows display names.
    expect(resolveAgentSlug("QA Engineer")).toBe("qa");
  });

  it("passes an unknown key through unchanged", () => {
    // Preserves the pre-move behaviour: an unknown profile reaches the runtime,
    // so the error comes from the thing that actually knows it does not exist,
    // not from a resolver guessing.
    expect(resolveAgentSlug("does-not-exist")).toBe("does-not-exist");
  });

  it("short-circuits 'default' without consulting any module", () => {
    expect(resolveAgentSlug("default")).toBe("default");
    expect(mockListAgentRoster).not.toHaveBeenCalled();
  });

  it("still resolves when the store is broken, by passing the key through", () => {
    mockListAgentRoster.mockImplementation(() => {
      throw new Error("db locked");
    });
    expect(resolveAgentSlug("qa")).toBe("qa");
  });
});
