import { NextRequest } from "next/server";

import { badRequest } from "@/lib/api-response";
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
import { answerBatch as answerAnyBatch, answerSingle as answerAnySingle } from "@/modules/hermes/lib/sync-answer";
import type { SyncResult } from "@/modules/hermes/lib/profile-sync-shared";

// The two answer shapes were written here first (QA finding 7, T-0082) and now
// live in sync-answer.ts so the pull, import and models routes answer the same
// way (T-0095). A single push that did not happen is a 500 naming the target
// and the reason; a batch with failures is a 200 whose data says so.
const answerSingle = (result: SyncResult) => answerAnySingle("Push to Hermes", result);
const answerBatch = (results: SyncResult[], extra: Record<string, unknown>) =>
  answerAnyBatch("push", results, extra);

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
