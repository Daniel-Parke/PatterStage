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

import { notFound, serverErrorFromHelperResult } from "@/lib/api-response";
import { updateAgentRoot, type AgentRootPatch } from "@/lib/agent-root-repository";
import { getProfile, updateProfileContent } from "@/lib/profiles-repository";
import { pushProfileToHermes, pushRootToHermes } from "@/lib/hermes-profile-sync";

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
function applyProfileOrRootPatch(
  slug: string,
  rootPatch: AgentRootPatch,
  profilePatch: Parameters<typeof updateProfileContent>[1],
): ProfileOrRootPatchResult {
  // Step 1: write the patch to the right repo. The default profile
  // lives in the `agent_root` singleton; every other profile lives
  // in the `profiles` table. We do the DB write first so a 404
  // return from `pushProfileOrRoot` below is impossible on the
  // default branch (no existence check needed) and unambiguous on
  // the non-default branch (existence pre-checked here).
  if (slug === "default") {
    updateAgentRoot(rootPatch);
  } else {
    // Non-default profile: check existence first (matches the
    // `personalities` route's pre-check) so we can return 404
    // distinctly from "push failed" / "update returned null".
    if (!getProfile(slug)) {
      return { ok: false, reason: "not-found" };
    }
    updateProfileContent(slug, profilePatch);
  }

  // Step 2: push to Hermes via the shared dispatch helper. The
  // `pushProfileOrRoot` body owns the default-vs-non-default push
  // dispatch + 404 + push-failed handling, so we delegate instead
  // of re-implementing the tail. On the non-default success path
  // this calls `getProfile(slug)` once redundantly (a single
  // in-memory check) but the call site returns the same
  // `ProfileOrRootPatchResult` and produces identical wire output.
  return pushProfileOrRoot(slug);
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
function pushProfileOrRoot(slug: string): ProfileOrRootPatchResult {
  if (slug === "default") {
    const push = pushRootToHermes();
    if (!push.success) {
      return { ok: false, reason: "push-failed", error: push.error || "Push failed" };
    }
    return { ok: true, profile: slug };
  }
  if (!getProfile(slug)) {
    return { ok: false, reason: "not-found" };
  }
  const push = pushProfileToHermes(slug);
  if (!push.success) {
    return { ok: false, reason: "push-failed", error: push.error || "Push failed" };
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
  return serverErrorFromHelperResult(result, fallbackError);
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

/**
 * Return shape of `applyProfileOrRootPatchOrFail` — discriminated on
 * `NextResponse` so the caller can write:
 *
 *   const result = applyProfileOrRootPatchOrFail(slug, rootPatch, profilePatch, "Failed to ...");
 *   if (result instanceof NextResponse) return result;
 *   // result is { profile: string } here
 *
 * The success branch carries only `profile: string` because that's
 * the only field the existing 5 call sites need after the helper
 * runs (`result.profile` in the `ok({ ..., profile: result.profile })`
 * success body). The error branch is the `NextResponse` directly so
 * `instanceof NextResponse` narrows correctly without a discriminator.
 */
export type ProfileOrRootPatchOrFailResult =
  | { profile: string }
  | NextResponse;

/**
 * Apply a profile-or-root patch and produce either the ready-to-return
 * `NextResponse` (404 on not-found, 500 on push-failed) or the success
 * payload `{ profile: string }`. Combines `applyProfileOrRootPatch` +
 * `toPatchResponse` + `assertPatchSucceeded` into a single helper so
 * the 5 List 3 call sites (personalities, skills/[name]/toggle,
 * agent/personality, agent/files/[key] x2, agent/profiles/[id]/toolsets)
 * collapse from:
 *
 *   const result = applyProfileOrRootPatch(slug, rootPatch, profilePatch);
 *   const err = toPatchResponse(result, "Failed to ...");
 *   if (err) return err;
 *   assertPatchSucceeded(result);
 *   return ok({ success: true, profile: result.profile, ... });
 *
 * to:
 *
 *   const result = applyProfileOrRootPatchOrFail(
 *     slug, rootPatch, profilePatch, "Failed to ...",
 *   );
 *   if (result instanceof NextResponse) return result;
 *   return ok({ success: true, profile: result.profile, ... });
 *
 * Byte-equivalent to the 4-line form:
 *  - On success: `applyProfileOrRootPatch` returns `{ ok: true, profile }`,
 *    `toPatchResponse` returns `null`, `assertPatchSucceeded` is a
 *    no-op. The combined helper returns `{ profile }`. The caller
 *    still reads `result.profile` — same field, same value, same wire
 *    body.
 *  - On not-found: `applyProfileOrRootPatch` returns
 *    `{ ok: false, reason: "not-found" }`, `toPatchResponse` returns
 *    `notFound("Profile not found")` (404), `assertPatchSucceeded` is
 *    not reached. The combined helper returns the same 404 NextResponse
 *    (caller `return`s it).
 *  - On push-failed: `applyProfileOrRootPatch` returns
 *    `{ ok: false, reason: "push-failed", error }`, `toPatchResponse`
 *    returns `serverErrorFromHelperResult(result, fallback)` (500 with
 *    either the underlying error or the fallback string), `assertPatchSucceeded`
 *    is not reached. The combined helper returns the same 500 NextResponse.
 *
 * `fallbackError` is the body of the 500 response when the underlying
 * push didn't supply its own `error` message — same parameter as
 * `toPatchResponse`, propagated through unchanged.
 */
export function applyProfileOrRootPatchOrFail(
  slug: string,
  rootPatch: AgentRootPatch,
  profilePatch: Parameters<typeof updateProfileContent>[1],
  fallbackError: string,
): ProfileOrRootPatchOrFailResult {
  const result = applyProfileOrRootPatch(slug, rootPatch, profilePatch);
  const err = toPatchResponse(result, fallbackError);
  if (err) return err;
  assertPatchSucceeded(result);
  return { profile: result.profile };
}

/**
 * Push-only companion of `applyProfileOrRootPatchOrFail` — combines
 * `pushProfileOrRoot` + `toPatchResponse` + `assertPatchSucceeded`
 * into a single helper for routes that have already mutated disk or
 * the managed-files table and just need the current DB state mirrored
 * to disk via the same push pipeline. The 1 List 3 call site that
 * uses this shape is `api/agent/files/[key]/route.ts` for non-config
 * managed files (SOUL.md, AGENTS.md, etc.) — `writeManagedFileContent`
 * has already updated the managed-files table, and the route just
 * needs the post-write push to mirror to Hermes.
 *
 * Byte-equivalent to:
 *   const result = pushProfileOrRoot(slug);
 *   const err = toPatchResponse(result, fallbackError);
 *   if (err) return err;
 *   assertPatchSucceeded(result);
 *   return { profile: result.profile };
 *
 * Same return-type contract as `applyProfileOrRootPatchOrFail`:
 * `NextResponse | { profile: string }`.
 */
export function pushProfileOrRootOrFail(
  slug: string,
  fallbackError: string,
): ProfileOrRootPatchOrFailResult {
  const result = pushProfileOrRoot(slug);
  const err = toPatchResponse(result, fallbackError);
  if (err) return err;
  assertPatchSucceeded(result);
  return { profile: result.profile };
}
