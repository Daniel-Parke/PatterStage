import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { ensureDb } from "@/lib/db";
import { parseOptionalJsonBody } from "@/lib/parse-optional-json-body";
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
    return NextResponse.json({ data: { profiles: discovered } });
  }
  catch (error) {
    logApiError("GET /api/agent/profiles/sync/import", "discover", error);
    return NextResponse.json({ error: "Failed to discover profiles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  // Body is a bag of optional flags (slug, importSkills,
  // importAllDiscovered); missing or malformed body is treated as {}.
  const body = await parseOptionalJsonBody(request);
  const slug = typeof body.slug === "string" ? body.slug.trim() : undefined;
  const importSkills = body.importSkills === true;
  const importAllDiscovered = body.importAllDiscovered === true;

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
      return NextResponse.json({ error: "Valid slug is required" }, { status: 400 });
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
    logApiError("POST /api/agent/profiles/sync/import", "import", error);
    return NextResponse.json({ error: "Failed to import profile" }, { status: 500 });
  }
}
