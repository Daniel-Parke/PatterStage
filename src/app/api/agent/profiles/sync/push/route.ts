import { NextRequest } from "next/server";

import { badRequest, ok, serverError } from "@/lib/api-response";
import type { SyncResult } from "@/modules/hermes/lib/profile-sync-shared";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ensureDb } from "@/lib/db";
import { parseOptionalJsonBody } from "@/lib/parse-optional-json-body";
import { booleanFlag, stringFlag } from "@/lib/parse-bag-flags";
import {
  pushProfileToHermes,
  pushAllProfiles,
  pushRootToHermes,
  pushAllSkillsToHermes,
  pushSkillToHermes,
} from "@/modules/hermes/lib/profile-push";

/**
 * One push, answered with the outcome it had.
 *
 * This used to be `ok({ success: result.success, result })` — a 200 for a push
 * that did not happen, for the same failure the toolsets route answers 500 for,
 * with the reason buried at `data.result.error` where runSyncAction does not
 * look. Every push failure therefore surfaced as a bare "Push failed" and the
 * ENOENT underneath it was never visible (QA finding 7, T-0082).
 */
function answerSingle(result: SyncResult) {
  if (result.success) return ok({ success: true, result });
  // The slug goes in the message because the 500 body is only `{ error }` —
  // there is nowhere else for a client to read which target failed.
  return serverError(`Push to Hermes failed for ${result.slug}: ${result.error || "unknown error"}`);
}

/**
 * A batch, answered as a batch.
 *
 * Deliberately NOT converged onto 500. One failure out of twelve profiles is a
 * real outcome and not a server error, and collapsing it would throw away the
 * eleven that worked. What it must not do is stay quiet: the failures are named
 * at `data.error`, which is where the client reads.
 */
function answerBatch(results: SyncResult[], extra: Record<string, unknown>) {
  const failures = results.filter((r) => !r.success);
  if (failures.length === 0) return ok({ success: true, ...extra });
  return ok({
    success: false,
    error: `${failures.length} push${failures.length === 1 ? "" : "es"} did not complete: ${failures
      .map((f) => `${f.slug} (${f.error || "unknown"})`)
      .join("; ")}`,
    ...extra,
  });
}

export async function POST(request: NextRequest) {
  // Body is a bag of optional flags (slug, all, root, skills, ...);
  // missing or malformed body is treated as {} so callers can POST
  // with no payload to trigger default behaviour.
  const body = await parseOptionalJsonBody(request);
  const slug = stringFlag(body, "slug");
  const all = booleanFlag(body, "all");
  const root = booleanFlag(body, "root");
  const skills = booleanFlag(body, "skills");
  const skillKey = stringFlag(body, "skillKey");
  const missingOnly = booleanFlag(body, "missingOnly");
  const onlyOutOfSync = booleanFlag(body, "onlyOutOfSync");

  try {
    ensureDb();

    if (root) {
      return answerSingle(pushRootToHermes());
    }

    if (skills) {
      const results = pushAllSkillsToHermes();
      return answerBatch(results, { results });
    }

    if (skillKey) {
      return answerSingle(pushSkillToHermes(skillKey));
    }

    if (all || missingOnly || onlyOutOfSync) {
      const profileResults = pushAllProfiles({
        onlyMissing: missingOnly,
        onlyOutOfSync,
      });
      const rootResult = pushRootToHermes();
      return answerBatch([...profileResults, rootResult], {
        root: rootResult,
        results: profileResults,
      });
    }

    if (!slug) {
      return badRequest("slug, all, root, skills, or skillKey required");
    }

    if (slug === "default") {
      return answerSingle(pushRootToHermes());
    }

    return answerSingle(pushProfileToHermes(slug));
  }
  catch (error) {
    return serverErrorFromCatch(
      "POST /api/agent/profiles/sync/push",
      "push",
      error,
      "Failed to push profile",
    );
  }
}
