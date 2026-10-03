// applyProfileOrRootPatch — dispatch a patch to the right repo and push to
// Hermes. The "default" profile is the agent root (singleton `agent_root` row);
// every other profile lives in `profiles`.

import { NextResponse } from "next/server";

import { notFound, serverErrorFromHelperResult } from "@/lib/api/api-response";
import { updateAgentRoot, type AgentRootPatch } from "@/lib/agents/agent-root-repository";
import { getProfile, updateProfileContent } from "../lib/profiles-repository";
import { pushProfileToHermes, pushRootToHermes } from "../lib/profile-push";

/** Discriminated by `ok` so the caller picks the HTTP status with one `switch`. */
export type ProfileOrRootPatchResult =
  | { ok: true; profile: string }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "push-failed"; error: string };

/**
 * Apply `rootPatch` to the agent root or `profilePatch` to the named profile,
 * then push to Hermes. Two patches because the repository types differ
 * (`AgentRootPatch` has `frameworkMd`); the same object can be passed to both.
 */
function applyProfileOrRootPatch(
  slug: string,
  rootPatch: AgentRootPatch,
  profilePatch: Parameters<typeof updateProfileContent>[1],
): ProfileOrRootPatchResult {
  // DB write first, existence pre-checked, so a 404 from the push below is
  // unambiguous and distinct from "push failed".
  if (slug === "default") {
    updateAgentRoot(rootPatch);
  } else {
    if (!getProfile(slug)) {
      return { ok: false, reason: "not-found" };
    }
    updateProfileContent(slug, profilePatch);
  }

  return pushProfileOrRoot(slug);
}

/** Push-only variant, for a route that already mutated disk or the managed-files table. Same union. */
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
 * The ready-to-return `NextResponse` (404 on not-found, 500 on push-failed) or
 * null on success. `fallbackError` is the 500 body when the push gave none.
 */
export function toPatchResponse(
  result: ProfileOrRootPatchResult,
  fallbackError: string,
): NextResponse | null {
  if (result.ok) return null;
  if (result.reason === "not-found") {
    // Nothing was written; saying the change is safe would replace one lie with another.
    return notFound("Profile not found");
  }
  // THE ORDERING IS DELIBERATE AND THE MESSAGE HAS TO CARRY IT: the DB write
  // precedes the push, so a push failure leaves the change committed here and
  // absent from Hermes, and a bare "failed" over an edit the operator can still
  // see is a contradiction (QA finding 7, T-0082). Inverting is not smaller:
  // both push functions READ the committed row.
  const reason = result.error || fallbackError;
  return serverErrorFromHelperResult(
    {
      ...result,
      error:
        `Saved to PatterStage, but the push to Hermes did not complete: ${reason}. ` +
        // Agent → Agents, from the registry. This said "Operations → Agents",
        // a section this product has never had, in the sentence read mid-failure.
        `Your change is not lost. Retry the push from Agent → Agents.`,
    },
    fallbackError,
  );
}

/**
 * Narrows to the success branch after a `toPatchResponse` null. Separate from
 * `toPatchResponse` so its response-or-null contract stays pure.
 */
export function assertPatchSucceeded(
  result: ProfileOrRootPatchResult,
): asserts result is { ok: true; profile: string } {
  if (!result.ok) {
    // toPatchResponse is meant to be called first; reaching here is a
    // programmer error, so the message names the contract.
    throw new Error("assertPatchSucceeded called on a failed result");
  }
}

/** The error branch is the `NextResponse` itself, so `instanceof` narrows without a discriminator. */
export type ProfileOrRootPatchOrFailResult =
  | { profile: string }
  | NextResponse;

/** Apply and answer: the `NextResponse` on failure (404/500), or `{ profile }`.
 *  `fallbackError` is the 500 body when the push gave none. */
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

/** Push-only companion of `applyProfileOrRootPatchOrFail`; same return contract. */
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
