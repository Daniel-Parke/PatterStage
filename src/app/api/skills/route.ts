import { NextRequest, NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { badRequest, notFound, serverError } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { safeStat } from "@/lib/fs-stats";
import { resolveEffectiveDisabledSkills } from "@/lib/effective-disabled-skills";
import { getProfile } from "@/lib/profiles-repository";
import { listSkills, deriveCategory } from "@/lib/skills-repository";
import { skillsRootForProfile } from "@/lib/skills-config";
import { resolveSafeProfileName } from "@/lib/path-security";
import { scanDiskSkillsCatalog } from "@/lib/hermes-profile-sync";
import { groupByCategory } from "@/lib/skills-grouping";
import type { Skill } from "@/types/hermes";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const profileParam = request.nextUrl.searchParams.get("profile") || "default";
  const refreshFromDisk = request.nextUrl.searchParams.get("refresh") === "1";
  const prof = resolveSafeProfileName(profileParam);
  if (!prof.ok) {
    return badRequest(prof.error);
  }
  const profile = prof.profile;

  try {
    ensureDb();

    if (profile !== "default") {
      const p = getProfile(profile);
      if (!p) {
        return notFound("Profile not found");
      }
    }

    const disabled = resolveEffectiveDisabledSkills(profile, { refreshFromDisk });
    const skillsDir = skillsRootForProfile();

    const dbSkills = listSkills();
    const dbKeys = new Set(dbSkills.map((s) => s.skillKey));
    const skills: Skill[] = dbSkills.map((row) => {
      const path = skillsDir + "/" + row.skillKey + "/SKILL.md";
      // safeStat returns null if the disk file is missing; fall back
      // to DB row metadata in that case.
      const st = safeStat(path);
      return {
        name: row.skillKey,
        category: deriveCategory(row),
        path,
        description: row.description,
        enabled: !disabled.has(row.skillKey),
        size: st?.size ?? row.content.length,
        lastModified: st?.mtime ?? row.updatedAt,
      };
    });

    // Merge disk-only skills (not yet in DB) using the shared catalog scanner
    for (const { skillKey, path } of scanDiskSkillsCatalog()) {
      if (dbKeys.has(skillKey)) continue;
      const st = safeStat(path);
      if (!st) {
        // disk-only skill file may have been removed since scan; skip silently
        continue;
      }
      skills.push({
        name: skillKey,
        category: deriveCategory({ category: "", skillKey }),
        path,
        description: "",
        enabled: !disabled.has(skillKey),
        size: st.size,
        lastModified: st.mtime,
      });
    }

    // Group skills by category (case-insensitive). The helper handles
    // mismatched frontmatter case ("Creative" vs "creative") so the
    // audit-found case-collision duplicates collapse into a single
    // bucket. The page does the same with groupByCategory().
    const categoryGroups = groupByCategory(skills, "uncategorized");
    const categories: Record<string, Skill[]> = {};
    for (const [key, items] of categoryGroups) {
      categories[key] = items;
    }

    return NextResponse.json({
      data: {
        skills,
        categories,
        total: skills.length,
        categoryCount: Object.keys(categories).length,
        profile,
      },
    });
  }
  catch (error) {
    logApiError("GET /api/skills", "listing skills", error);
    return serverError("Failed to list skills");
  }
}
