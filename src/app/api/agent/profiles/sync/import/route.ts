import { NextRequest } from "next/server";

import { badRequest, ok } from "@/lib/api-response";
// `ok` is still the GET's answer; every POST branch answers through sync-answer.
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ensureDb } from "@/lib/db";
import { parseOptionalJsonBody } from "@/lib/parse-optional-json-body";
import { booleanFlag, stringFlag } from "@/lib/parse-bag-flags";
import {
  discoverLocalProfiles,
  importDiscoveredProfile,
  importAllSkillsFromDisk,
} from "@/modules/hermes/lib/profile-discovery";
import { isValidProfileSlug } from "@/lib/profile-slug";
import { answerBatch, answerSingle } from "@/modules/hermes/lib/sync-answer";

// Answers through sync-answer.ts, like push and pull: a 500 for the one
// profile that did not import, a 200 that says so for a batch (T-0095, D19).
const VERB = "Import from Hermes";

export async function GET(_request: NextRequest) {
  try {
    ensureDb();
    const discovered = discoverLocalProfiles();
    return ok({ profiles: discovered });
  }
  catch (error) {
    return serverErrorFromCatch(
      "GET /api/agent/profiles/sync/import",
      "discover",
      error,
      "Failed to discover profiles",
    );
  }
}

export async function POST(request: NextRequest) {
  // Body is a bag of optional flags (slug, importSkills,
  // importAllDiscovered); missing or malformed body is treated as {}.
  const body = await parseOptionalJsonBody(request);
  // .trim() here is intentional: pre-refactor form was
  //   const slug = typeof body.slug === "string" ? body.slug.trim() : undefined;
  // — the trim is part of the route's slug-validity contract, not a
  // nice-to-have, so the helper's opt-in `trim` is required to keep
  // byte equivalence.
  const slug = stringFlag(body, "slug", { trim: true });
  const importSkills = booleanFlag(body, "importSkills");
  const importAllDiscovered = booleanFlag(body, "importAllDiscovered");

  try {
    ensureDb();
    const results: { slug: string; success: boolean; error: string | null }[] = [];

    if (importSkills) {
      const skillResults = importAllSkillsFromDisk();
      return answerBatch("import", skillResults, { skills: skillResults });
    }

    if (importAllDiscovered) {
      for (const d of discoverLocalProfiles().filter((p) => !p.inDatabase)) {
        const r = importDiscoveredProfile(d.slug);
        results.push({ slug: d.slug, success: r.success, error: r.error });
      }
      return answerBatch("import", results, { results });
    }

    if (!slug || !isValidProfileSlug(slug)) {
      return badRequest("Valid slug is required");
    }

    return answerSingle(VERB, importDiscoveredProfile(slug));
  }
  catch (error) {
    return serverErrorFromCatch(
      "POST /api/agent/profiles/sync/import",
      "import",
      error,
      "Failed to import profile",
    );
  }
}
