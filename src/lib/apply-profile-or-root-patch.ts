// ═══════════════════════════════════════════════════════════════
// applyProfileOrRootPatch — dispatch a patch to the right repo and
// push to Hermes, returning a discriminated union for the caller.
// ═══════════════════════════════════════════════════════════════
//
// The "default" profile is the special agent root (singleton row in
// `agent_root` table), while every other profile lives in `profiles`.
// Routes that update a single field on either the default or a named
// profile all repeat the same shape:
//
//   if (slug === "default") {
//     updateAgentRoot(patchRoot);
//     const push = pushRootToHermes();
//     if (!push.success) return 500;
//   } else {
//     const row = getProfile(slug);
//     if (!row) return 404;
//     updateProfileContent(slug, patchProfile);
//     const push = pushProfileToHermes(slug);
//     if (!push.success) return 500;
//   }
//
// The duplication was 3 places (api/agent/personality/route.ts PUT,
// api/personalities/route.ts upsertPersonality, etc.) and they all
// diverged in subtle ways (e.g. one did `getProfile` first, another
// used the boolean return value of `updateProfileContent`). This
// helper consolidates the dispatch + 404 + push-fail handling into a
// single place so callers only describe WHAT to update, not HOW to
// route the update.
//
// The returned union is shaped so the caller can produce the right
// NextResponse status with a single `switch`. To skip writing the
// switch at every call site, use `toPatchResponse(result, fallback)`
// below — it returns `null` on success (caller continues) or a
// NextResponse (caller returns it) for not-found / push-failed.

import { NextResponse } from "next/server";

import { notFound, serverError } from "./api-response";
import { updateAgentRoot, type AgentRootPatch } from "./agent-root-repository";
import { getProfile, updateProfileContent } from "./profiles-repository";
import { pushProfileToHermes, pushRootToHermes } from "./hermes-profile-sync";

/**
 * Outcome of `applyProfileOrRootPatch`. Discriminated by `ok` so the
 * caller can produce the right HTTP status with a single `switch`.
 */
export type ProfileOrRootPatchResult =
  | { ok: true; profile: string }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "push-failed"; error: string };

/**
 * Apply `rootPatch` to the singleton default profile (agent root), or
 * `profilePatch` to the named profile, then push the result to Hermes.
 *
 * The two patches are passed separately because the two repository
 * types have slightly different shapes (e.g. `AgentRootPatch` has a
 * `hermesMd` field that `ProfileContentPatch` does not). Callers that
 * only want to update the overlapping fields can pass the same object
 * to both — TypeScript will narrow as needed.
 */
export function applyProfileOrRootPatch(
  slug: string,
  rootPatch: AgentRootPatch,
  profilePatch: Parameters<typeof updateProfileContent>[1],
): ProfileOrRootPatchResult {
  if (slug === "default") {
    updateAgentRoot(rootPatch);
    const push = pushRootToHermes();
    if (!push.success) {
      return { ok: false, reason: "push-failed", error: push.error ?? "Push failed" };
    }
    return { ok: true, profile: slug };
  }

  // Non-default profile: check existence first (matches the
  // `personalities` route's pre-check) so we can return 404
  // distinctly from "push failed" / "update returned null".
  if (!getProfile(slug)) {
    return { ok: false, reason: "not-found" };
  }
  updateProfileContent(slug, profilePatch);
  const push = pushProfileToHermes(slug);
  if (!push.success) {
    return { ok: false, reason: "push-failed", error: push.error ?? "Push failed" };
  }
  return { ok: true, profile: slug };
}

/**
 * Push-only variant: dispatch a Hermes push to the right sync function
 * without writing to the DB. Use this when the route has already
 * mutated a file on disk (or in the case of a managed non-column
 * file, written via `writeManagedFileContent`) and just needs the
 * current DB state mirrored to disk via the same push pipeline.
 *
 * Returns the same union as `applyProfileOrRootPatch` so callers can
 * share a single 404/500 switch.
 */
export function pushProfileOrRoot(slug: string): ProfileOrRootPatchResult {
  if (slug === "default") {
    const push = pushRootToHermes();
    if (!push.success) {
      return { ok: false, reason: "push-failed", error: push.error ?? "Push failed" };
    }
    return { ok: true, profile: slug };
  }
  if (!getProfile(slug)) {
    return { ok: false, reason: "not-found" };
  }
  const push = pushProfileToHermes(slug);
  if (!push.success) {
    return { ok: false, reason: "push-failed", error: push.error ?? "Push failed" };
  }
  return { ok: true, profile: slug };
}

/**
 * Convert a `ProfileOrRootPatchResult` into either a ready-to-return
 * `NextResponse` (404 on not-found, 500 on push-failed) or `null` on
 * success. Lets the 5 call sites of `applyProfileOrRootPatch` /
 * `pushProfileOrRoot` collapse their identical 7-line if/else switch
 * into:
 *
 *   const result = applyProfileOrRootPatch(...);
 *   const err = toPatchResponse(result, "Failed to sync profile");
 *   if (err) return err;
 *   assertPatchSucceeded(result);
 *   return NextResponse.json({ data: { success: true, profile: result.profile } });
 *
 * `fallbackError` is the body of the 500 response when the underlying
 * push didn't supply its own `error` message. The not-found error
 * string is always "Profile not found" to match the prior inline
 * copy.
 */
export function toPatchResponse(
  result: ProfileOrRootPatchResult,
  fallbackError: string,
): NextResponse | null {
  if (result.ok) return null;
  if (result.reason === "not-found") {
    return notFound("Profile not found");
  }
  return serverError(result.error ?? fallbackError);
}

/**
 * TypeScript assertion that narrows `ProfileOrRootPatchResult` to the
 * `{ ok: true; profile: string }` branch. Use immediately after a
 * successful `toPatchResponse` check so the caller can read
 * `result.profile` without a manual `!result.ok` guard.
 *
 * The companion function to `toPatchResponse` is intentionally a
 * separate helper rather than a second return on `toPatchResponse`:
 * keeping the response-or-null contract pure makes the helper trivially
 * testable (existing tests in `tests/unit/apply-profile-or-root-patch.test.ts`
 * only check the response shape, not the narrowing side-effect). The
 * asserts signature also has no runtime effect — TypeScript discards
 * the call at compile time, so adding this helper does not change
 * the wire output of any route.
 */
export function assertPatchSucceeded(
  result: ProfileOrRootPatchResult,
): asserts result is { ok: true; profile: string } {
  if (!result.ok) {
    // toPatchResponse is supposed to be called first; reaching this
    // branch is a programmer error (caller wired the helper pair
    // wrong). Throw a recognisable string so debugging points at the
    // contract.
    throw new Error("assertPatchSucceeded called on a failed result");
  }
}
