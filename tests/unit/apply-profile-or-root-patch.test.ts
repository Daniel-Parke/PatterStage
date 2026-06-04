/** @jest-environment node */

// Tests for the toPatchResponse helper in
// src/lib/apply-profile-or-root-patch.ts. The helper converts a
// ProfileOrRootPatchResult discriminated union into either null
// (success — caller continues) or a NextResponse (404 on not-found,
// 500 on push-failed). Six call sites across the agent / skills /
// personalities / files routes have been collapsed onto this helper.

import {
  assertPatchSucceeded,
  toPatchResponse,
  type ProfileOrRootPatchResult,
} from "@/lib/apply-profile-or-root-patch";

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

  it("falls back to the supplied error message when push-failed has no error", async () => {
    const result: ProfileOrRootPatchResult = {
      ok: false,
      reason: "push-failed",
    };
    // When `error` is missing the helper must NOT crash on `result.error`
    // and must use the caller's fallback string.
    const res = toPatchResponse(result, "Failed to toggle skill");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(500);
    const body = await res!.json();
    expect(body.error).toBe("Failed to toggle skill");
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
