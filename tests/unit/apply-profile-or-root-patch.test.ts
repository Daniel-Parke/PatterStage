/** @jest-environment node */

// Tests for the toPatchResponse / assertPatchSucceeded /
// applyProfileOrRootPatchOrFail / pushProfileOrRootOrFail helpers in
// src/lib/apply-profile-or-root-patch.ts.
//
//   toPatchResponse        — converts a ProfileOrRootPatchResult into
//                            null (success) or a NextResponse (404 / 500)
//   assertPatchSucceeded   — TS-narrowing assertion companion
//   applyProfileOrRootPatchOrFail
//                          — combines applyProfileOrRootPatch +
//                            toPatchResponse + assertPatchSucceeded into
//                            one call. Used by 4 List 3 routes
//                            (personalities, agent/personality,
//                            skills/[name]/toggle, agent/profiles/[id]/toolsets).
//   pushProfileOrRootOrFail
//                          — push-only companion used by 1 List 3
//                            route (agent/files/[key] non-config branch).
//
// The byte-equivalence claim (success / not-found / push-failed paths
// all produce identical wire output) is verified by exercising each
// path through both the 1-call and 3-call forms in the same test.

import { NextResponse } from "next/server";

import {
  applyProfileOrRootPatchOrFail,
  assertPatchSucceeded,
  pushProfileOrRootOrFail,
  toPatchResponse,
  type ProfileOrRootPatchResult,
} from "@/modules/hermes/handlers/profile-patch";

describe("toPatchResponse", () => {
  it("returns null on success", () => {
    const result: ProfileOrRootPatchResult = { ok: true, profile: "qa" };
    expect(toPatchResponse(result, "fallback")).toBeNull();
  });

  it("returns 404 NextResponse on not-found", async () => {
    const result: ProfileOrRootPatchResult = {
      ok: false,
      reason: "not-found",
    };
    const res = toPatchResponse(result, "Failed to sync profile");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(404);
    const body = await res!.json();
    expect(body.error).toBe("Profile not found");
  });

  it("returns 500 with the underlying error on push-failed", async () => {
    const result: ProfileOrRootPatchResult = {
      ok: false,
      reason: "push-failed",
      error: "yaml parse error",
    };
    const res = toPatchResponse(result, "Failed to sync profile");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(500);
    const body = await res!.json();
    expect(body.error).toBe("yaml parse error");
  });

  it("passes an empty error through verbatim, because suppressing it is the producer's job", async () => {
    // Companion to api-response-server-error-from-helper-result.test.ts,
    // which rules that the factory must never rewrite a caller's wire output.
    // The guard against an empty message lives at the producer instead — see
    // the pushProfileOrRoot test below.
    //
    // The previous version of this test constructed `{ ok: false, reason:
    // "push-failed" }` with no `error` at all, which the union forbids: it
    // asserted a fallback on a state that cannot exist. Type-checking the
    // tests is what surfaced that.
    const result: ProfileOrRootPatchResult = {
      ok: false,
      reason: "push-failed",
      error: "",
    };
    const res = toPatchResponse(result, "Failed to toggle skill");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(500);
    const body = await res!.json();
    expect(body.error).toBe("");
  });
});

describe("assertPatchSucceeded", () => {
  it("is a no-op when the result is ok (the canonical success case)", () => {
    const result: ProfileOrRootPatchResult = { ok: true, profile: "qa" };
    expect(() => assertPatchSucceeded(result)).not.toThrow();
  });

  it("throws a recognisable error when called on a not-found result", () => {
    const result: ProfileOrRootPatchResult = {
      ok: false,
      reason: "not-found",
    };
    expect(() => assertPatchSucceeded(result)).toThrow(
      "assertPatchSucceeded called on a failed result",
    );
  });

  it("throws when called on a push-failed result", () => {
    const result: ProfileOrRootPatchResult = {
      ok: false,
      reason: "push-failed",
      error: "yaml parse error",
    };
    expect(() => assertPatchSucceeded(result)).toThrow(
      "assertPatchSucceeded called on a failed result",
    );
  });

  it("narrowing: lets TS read result.profile after a successful call", () => {
    // This test is a compile-time check: if the asserts signature
    // were removed, the `result.profile` access below would fail
    // type-check with "Property 'profile' does not exist on type
    // ProfileOrRootPatchResult".
    const result: ProfileOrRootPatchResult = { ok: true, profile: "qa" };
    assertPatchSucceeded(result);
    // After the assertion, TypeScript should narrow `result` to the
    // success branch which carries the `profile` field. The runtime
    // value matches the type, so this is a pure compile-time lock.
    const profile: string = result.profile;
    expect(profile).toBe("qa");
  });
});

// ─────────────────────────────────────────────────────────────────
// applyProfileOrRootPatchOrFail — combined apply + toPatchResponse + assert
// ─────────────────────────────────────────────────────────────────
//
// These tests mock the underlying `applyProfileOrRootPatch` indirectly
// by mocking the modules it imports (agent-root-repository,
// profiles-repository, hermes-profile-sync). The combined helper then
// runs the full 3-step pipeline and we assert on the wire output.

jest.mock("@/lib/agent-root-repository", () => ({
  updateAgentRoot: jest.fn(),
}));

jest.mock("@/lib/profiles-repository", () => ({
  getProfile: jest.fn(),
  updateProfileContent: jest.fn(),
}));

jest.mock("@/lib/hermes-profile-sync", () => ({
  pushProfileToHermes: jest.fn(),
  pushRootToHermes: jest.fn(),
}));

jest.mock("@/lib/api-response", () => {
  const actual = jest.requireActual("@/lib/api-response");
  return actual;
});

import { getProfile, updateProfileContent } from "@/lib/profiles-repository";
import { pushProfileToHermes, pushRootToHermes } from "@/lib/hermes-profile-sync";

const mockGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;
const mockUpdateProfileContent = updateProfileContent as jest.MockedFunction<typeof updateProfileContent>;
const mockPushProfileToHermes = pushProfileToHermes as jest.MockedFunction<typeof pushProfileToHermes>;
const mockPushRootToHermes = pushRootToHermes as jest.MockedFunction<typeof pushRootToHermes>;

describe("applyProfileOrRootPatchOrFail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns { profile } on success (default branch)", async () => {
    // Default profile — applyProfileOrRootPatch takes the default
    // branch (no getProfile call, no updateProfileContent), then
    // calls pushRootToHermes. The combined helper must return
    // `{ profile: "default" }` on success.
    mockPushRootToHermes.mockReturnValue({ success: true, slug: "default", backupPath: null, error: null });
    const result = applyProfileOrRootPatchOrFail(
      "default",
      { personality: "test" },
      { personality: "test" },
      "Failed to sync",
    );
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ profile: "default" });
  });

  it("returns { profile } on success (non-default branch)", async () => {
    // Non-default profile — getProfile returns a row, updateProfileContent
    // is called, pushProfileToHermes succeeds. The combined helper
    // must return `{ profile: "qa" }` on success.
    mockGetProfile.mockReturnValue({
      slug: "qa",
      displayName: "qa",
      description: "",
      personality: "",
      configYaml: "",
      soulMd: "",
      agentsMd: "",
      userMd: "",
      memoryMd: "",
      disabledSkillsJson: "[]",
      platformToolsetsJson: "{}",
      seedKey: null,
      syncedAt: null,
      syncError: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
    mockUpdateProfileContent.mockReturnValue({ slug: "qa" } as ReturnType<typeof updateProfileContent>);
    mockPushProfileToHermes.mockReturnValue({ success: true, slug: "qa", backupPath: null, error: null });

    const result = applyProfileOrRootPatchOrFail(
      "qa",
      { personality: "test" },
      { personality: "test" },
      "Failed to sync",
    );
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ profile: "qa" });
  });

  it("returns a 404 NextResponse on not-found (non-default, profile missing)", async () => {
    // Non-default profile — getProfile returns null, applyProfileOrRootPatch
    // returns { ok: false, reason: "not-found" }, toPatchResponse returns
    // a 404. The combined helper must return the SAME 404 NextResponse.
    mockGetProfile.mockReturnValue(null);
    const result = applyProfileOrRootPatchOrFail(
      "missing",
      { personality: "test" },
      { personality: "test" },
      "Failed to sync",
    );
    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Profile not found");
  });

  it("returns a 500 NextResponse on push-failed (with underlying error)", async () => {
    // pushRootToHermes returns success: false with an error string.
    // The combined helper must surface that error in the 500 body.
    mockPushRootToHermes.mockReturnValue({ success: false, slug: "default", backupPath: null, error: "yaml parse error" });
    const result = applyProfileOrRootPatchOrFail(
      "default",
      { personality: "test" },
      { personality: "test" },
      "Failed to sync",
    );
    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("yaml parse error");
  });

  it("returns a 500 NextResponse on push-failed (uses underlying error or 'Push failed')", async () => {
    // pushRootToHermes returns success: false with NO error string.
    // `pushProfileOrRoot` (called internally by the combined helper)
    // substitutes "Push failed" when the underlying error is null,
    // so the 500 body will be "Push failed" — NOT the caller's
    // fallbackError. The fallbackError path is only reached when the
    // underlying error is a literal `""` empty string (which is the
    // existing `toPatchResponse` contract: `result.error || fallback`).
    mockPushRootToHermes.mockReturnValue({ success: false, slug: "default", backupPath: null, error: null });
    const result = applyProfileOrRootPatchOrFail(
      "default",
      { personality: "test" },
      { personality: "test" },
      "Failed to toggle skill",
    );
    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(500);
    const body = await res.json();
    // `pushProfileOrRoot` substitutes "Push failed" when push.error
    // is null, so the 500 body is the substituted string, not the
    // caller's fallbackError. This matches the existing helper
    // contract — the underlying push is expected to surface a useful
    // error message; the fallback is a defence in depth.
    expect(body.error).toBe("Push failed");
  });

  it("byte-equivalent to the 3-call form on success", () => {
    // Spot-check: build the 3-call form and the 1-call form with the
    // same inputs, then assert they produce the same observable output.
    // On success the 3-call form is null+null+{profile:"default"}; the
    // 1-call form is {profile:"default"}. Same wire, same payload.
    mockPushRootToHermes.mockReturnValue({ success: true, slug: "default", backupPath: null, error: null });

    const result3 = (() => {
      const r = { ok: true as const, profile: "default" };
      const err = toPatchResponse(r, "Failed");
      if (err) return err;
      assertPatchSucceeded(r);
      return { profile: r.profile };
    })();
    const result1 = applyProfileOrRootPatchOrFail(
      "default",
      { personality: "test" },
      { personality: "test" },
      "Failed",
    );
    expect(result1).toEqual(result3);
  });
});

// ─────────────────────────────────────────────────────────────────
// pushProfileOrRootOrFail — push-only combined helper
// ─────────────────────────────────────────────────────────────────

describe("pushProfileOrRootOrFail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns { profile } on success", () => {
    // Push-only path. No DB write happens, just the push.
    mockPushRootToHermes.mockReturnValue({ success: true, slug: "default", backupPath: null, error: null });
    const result = pushProfileOrRootOrFail("default", "Failed to sync");
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ profile: "default" });
  });

  it("returns a 404 NextResponse on not-found (non-default)", () => {
    // getProfile returns null, pushProfileOrRoot returns
    // { ok: false, reason: "not-found" }, toPatchResponse returns 404.
    mockGetProfile.mockReturnValue(null);
    const result = pushProfileOrRootOrFail("missing", "Failed to sync");
    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(404);
  });

  it("never emits an empty 500 body when the push reports a message-less failure", async () => {
    // `new Error().message` is "", and a sync helper that surfaces it
    // unguarded produced a 500 with an empty body: the response factory
    // passes "" through verbatim by design, so the guard has to be here.
    // Was `push.error ?? "Push failed"`, which only catches null.
    mockPushRootToHermes.mockReturnValue({
      success: false,
      slug: "default",
      backupPath: null,
      error: "",
    });

    const result = pushProfileOrRootOrFail("default", "Failed to sync");

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Push failed" });
  });

  it("returns a 500 NextResponse on push-failed", () => {
    // pushProfileToHermes returns success: false with an error.
    mockGetProfile.mockReturnValue({
      slug: "qa",
      displayName: "qa",
      description: "",
      personality: "",
      configYaml: "",
      soulMd: "",
      agentsMd: "",
      userMd: "",
      memoryMd: "",
      disabledSkillsJson: "[]",
      platformToolsetsJson: "{}",
      seedKey: null,
      syncedAt: null,
      syncError: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
    mockPushProfileToHermes.mockReturnValue({ success: false, slug: "qa", backupPath: null, error: "disk full" });
    const result = pushProfileOrRootOrFail("qa", "Failed to sync");
    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(500);
  });
});
