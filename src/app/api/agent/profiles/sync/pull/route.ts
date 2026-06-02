import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { ensureDb } from "@/lib/db";
import { parseOptionalJsonBody } from "@/lib/parse-optional-json-body";
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
  const slug = typeof body.slug === "string" ? body.slug : undefined;
  const all = body.all === true;
  const root = body.root === true;
  const skills = body.skills === true;
  const skillKey = typeof body.skillKey === "string" ? body.skillKey : undefined;
  const importDiscovered = body.importDiscovered === true;
  const reconcileDisk =
    body.reconcileDisk === true || process.env.CH_PULL_RECONCILE_DISK === "1";

  try {
    ensureDb();

    if (skills) {
      const results = importAllSkillsFromDisk();
      return NextResponse.json({
        data: { success: results.every((r) => r.success), results },
      });
    }

    if (skillKey) {
      const result = pullSkillFromHermes(skillKey);
      return NextResponse.json({ data: { success: result.success, result } });
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
      return NextResponse.json({
        data: {
          success:
            profileResults.every((r) => r.success) &&
            rootResult.success &&
            skillResults.every((r) => r.success),
          root: rootResult,
          profiles: profileResults,
          skills: skillResults,
        },
      });
    }

    if (root || slug === "default") {
      const result = pullRootFromHermes({ reconcileDisk });
      return NextResponse.json({ data: { success: result.success, result } });
    }

    if (!slug) {
      return NextResponse.json({ error: "slug, all, root, or skills required" }, { status: 400 });
    }

    const result = pullProfileFromHermes(slug, { reconcileDisk });
    return NextResponse.json({
      data: {
        success: result.success,
        result,
      },
    });
  }
  catch (error) {
    logApiError("POST /api/agent/profiles/sync/pull", "pull", error);
    return NextResponse.json({ error: "Failed to pull profile" }, { status: 500 });
  }
}
