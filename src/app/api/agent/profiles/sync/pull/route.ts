import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { badRequest, ok } from "@/lib/api-response";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ensureDb } from "@/lib/db";
import { parseOptionalJsonBody } from "@/lib/parse-optional-json-body";
import { booleanFlag, stringFlag } from "@/lib/parse-bag-flags";
import { listProfiles } from "@/lib/profiles-repository";
import {
  pullProfileFromHermes,
  pullRootFromHermes,
  pullSkillFromHermes,
  importAllSkillsFromDisk,
  discoverLocalProfiles,
  importDiscoveredProfile,
} from "@/lib/hermes-profile-sync";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  // Body is a bag of optional flags (slug, all, root, skills,
  // reconcileDisk, ...); missing or malformed body is treated as {}.
  const body = await parseOptionalJsonBody(request);
  const slug = stringFlag(body, "slug");
  const all = booleanFlag(body, "all");
  const root = booleanFlag(body, "root");
  const skills = booleanFlag(body, "skills");
  const skillKey = stringFlag(body, "skillKey");
  const importDiscovered = booleanFlag(body, "importDiscovered");
  const reconcileDisk =
    booleanFlag(body, "reconcileDisk") ||
    (process.env.PS_PULL_RECONCILE_DISK || process.env.CH_PULL_RECONCILE_DISK) === "1";

  try {
    ensureDb();

    if (skills) {
      const results = importAllSkillsFromDisk();
      return ok({ success: results.every((r) => r.success), results },);
    }

    if (skillKey) {
      const result = pullSkillFromHermes(skillKey);
      return ok({ success: result.success, result });
    }

    if (all || importDiscovered) {
      const profileResults = [];
      for (const p of listProfiles()) {
        profileResults.push(pullProfileFromHermes(p.slug, { reconcileDisk }));
      }
      const rootResult = pullRootFromHermes({ reconcileDisk });
      if (importDiscovered) {
        for (const d of discoverLocalProfiles().filter((p) => !p.inDatabase)) {
          profileResults.push(importDiscoveredProfile(d.slug));
        }
      }
      const skillResults = importAllSkillsFromDisk();
      return ok({
        success:
          profileResults.every((r) => r.success) &&
          rootResult.success &&
          skillResults.every((r) => r.success),
        root: rootResult,
        profiles: profileResults,
        skills: skillResults,
      });
    }

    if (root || slug === "default") {
      const result = pullRootFromHermes({ reconcileDisk });
      return ok({ success: result.success, result });
    }

    if (!slug) {
      return badRequest("slug, all, root, or skills required");
    }

    const result = pullProfileFromHermes(slug, { reconcileDisk });
    return ok({
      success: result.success,
      result,
    });
  }
  catch (error) {
    return serverErrorFromCatch(
      "POST /api/agent/profiles/sync/pull",
      "pull",
      error,
      "Failed to pull profile",
    );
  }
}
