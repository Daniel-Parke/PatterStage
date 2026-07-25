import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { badRequest, ok } from "@/lib/api-response";
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
} from "@/modules/hermes/lib/profile-sync";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

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
      const result = pushRootToHermes();
      return ok({ success: result.success, result });
    }

    if (skills) {
      const results = pushAllSkillsToHermes();
      return ok({ success: results.every((r) => r.success), results },);
    }

    if (skillKey) {
      const result = pushSkillToHermes(skillKey);
      return ok({ success: result.success, result });
    }

    if (all || missingOnly || onlyOutOfSync) {
      const profileResults = pushAllProfiles({
        onlyMissing: missingOnly,
        onlyOutOfSync,
      });
      const rootResult = pushRootToHermes();
      return ok({
        success:
          profileResults.every((r) => r.success) && rootResult.success,
        root: rootResult,
        results: profileResults,
      });
    }

    if (!slug) {
      return badRequest("slug, all, root, skills, or skillKey required");
    }

    if (slug === "default") {
      const result = pushRootToHermes();
      return ok({ success: result.success, result });
    }

    const result = pushProfileToHermes(slug);
    return ok({
      success: result.success,
      result,
    });
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
