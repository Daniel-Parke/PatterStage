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
// NextResponse status with a single `switch`:

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
