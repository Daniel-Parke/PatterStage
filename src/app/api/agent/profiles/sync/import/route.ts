import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { badRequest, ok } from "@/lib/api-response";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ensureDb } from "@/lib/db";
import { parseOptionalJsonBody } from "@/lib/parse-optional-json-body";
import { booleanFlag, stringFlag } from "@/lib/parse-bag-flags";
import {
  discoverLocalProfiles,
  importDiscoveredProfile,
  importAllSkillsFromDisk,
} from "@/lib/hermes-profile-sync";
import { isValidProfileSlug } from "@/lib/profile-slug";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

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
  const auth = requireAuth(request);
  if (auth) return auth;

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
      return NextResponse.json({
        data: {
          success: skillResults.every((r) => r.success),
          skills: skillResults,
        },
      });
    }

    if (importAllDiscovered) {
      for (const d of discoverLocalProfiles().filter((p) => !p.inDatabase)) {
        const r = importDiscoveredProfile(d.slug);
        results.push({ slug: d.slug, success: r.success, error: r.error });
      }
      return NextResponse.json({
        data: {
          success: results.every((r) => r.success),
          results,
        },
      });
    }

    if (!slug || !isValidProfileSlug(slug)) {
      return badRequest("Valid slug is required");
    }

    const result = importDiscoveredProfile(slug);
    return NextResponse.json({
      data: {
        success: result.success,
        result,
      },
    });
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
