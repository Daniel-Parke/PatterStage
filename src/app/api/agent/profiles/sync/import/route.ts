import { NextRequest } from "next/server";

import { badRequest, ok } from "@/lib/api/api-response";
import { ensureDb } from "@/lib/db";
import { parseOptionalJsonBody } from "@/lib/api/parse-optional-json-body";
import { booleanFlag, stringFlag } from "@/lib/parse-bag-flags";
import {
  discoverLocalProfiles,
  importDiscoveredProfile,
  importAllSkillsFromDisk,
} from "@/modules/hermes/lib/profile-discovery";
import { isValidProfileSlug } from "@/lib/agents/profile-slug";
import { answerBatch, answerSingle } from "@/modules/hermes/lib/sync-answer";
import { route } from "@/lib/api/api-route";

// Answers through sync-answer.ts, like push and pull: a 500 for the one
// profile that did not import, a 200 that says so for a batch (T-0095, D19).
const VERB = "Import from Hermes";

export const GET = route("GET /api/agent/profiles/sync/import", "discover", "Failed to discover profiles", async (_request: NextRequest) => {
  ensureDb();
  const discovered = discoverLocalProfiles();
  return ok({ profiles: discovered });
});

export const POST = route("POST /api/agent/profiles/sync/import", "import", "Failed to import profile", async (request: NextRequest) => {
  // Body is a bag of optional flags (slug, importSkills,
  // importAllDiscovered); missing or malformed body is treated as {}.
  const body = await parseOptionalJsonBody(request);
  // The trim is part of the route's slug-validity contract, not a nice-to-have.
  const slug = stringFlag(body, "slug", { trim: true });
  const importSkills = booleanFlag(body, "importSkills");
  const importAllDiscovered = booleanFlag(body, "importAllDiscovered");
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
});
