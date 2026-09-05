import { NextRequest } from "next/server";

import { badRequest } from "@/lib/api-response";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ensureDb } from "@/lib/db";
import { parseOptionalJsonBody } from "@/lib/parse-optional-json-body";
import { booleanFlag, stringFlag } from "@/lib/parse-bag-flags";
import { listProfiles } from "@/modules/hermes/lib/profiles-repository";
import {
  pullProfileFromHermes,
  pullRootFromHermes,
  pullSkillFromHermes,
} from "@/modules/hermes/lib/profile-pull";
import {
  importAllSkillsFromDisk,
  discoverLocalProfiles,
  importDiscoveredProfile,
} from "@/modules/hermes/lib/profile-discovery";
import { answerBatch, answerSingle } from "@/modules/hermes/lib/sync-answer";

// Every branch answers through sync-answer.ts. This route used to return
// `ok({ success: result.success, result })`, a 200 for a pull that did not
// happen, with the reason where no client reads it (T-0095, D19).
const VERB = "Pull from Hermes";

export async function POST(request: NextRequest) {
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
      return answerBatch("pull", results, { results });
    }

    if (skillKey) {
      return answerSingle(VERB, pullSkillFromHermes(skillKey));
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
      return answerBatch("pull", [...profileResults, rootResult, ...skillResults], {
        root: rootResult,
        profiles: profileResults,
        skills: skillResults,
      });
    }

    if (root || slug === "default") {
      return answerSingle(VERB, pullRootFromHermes({ reconcileDisk }));
    }

    if (!slug) {
      return badRequest("slug, all, root, or skills required");
    }

    return answerSingle(VERB, pullProfileFromHermes(slug, { reconcileDisk }));
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
