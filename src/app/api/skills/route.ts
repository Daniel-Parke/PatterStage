import { NextRequest, NextResponse } from "next/server";
import { statSync } from "fs";

import { logApiError } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { ensureDb } from "@/lib/db";
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
    return NextResponse.json({ error: prof.error }, { status: 400 });
  }
  const profile = prof.profile;

  try {
    ensureDb();

    if (profile !== "default") {
      const p = getProfile(profile);
      if (!p) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }
    }

    const disabled = resolveEffectiveDisabledSkills(profile, { refreshFromDisk });
    const skillsDir = skillsRootForProfile();

    const dbSkills = listSkills();
    const dbKeys = new Set(dbSkills.map((s) => s.skillKey));
    const skills: Skill[] = dbSkills.map((row) => {
      const path = skillsDir + "/" + row.skillKey + "/SKILL.md";
      let size = row.content.length;
      let lastModified = row.updatedAt;
      try {
        const st = statSync(path);
        size = st.size;
        lastModified = st.mtime.toISOString();
      }
      catch {
        // statSync not essential — fall back to DB metadata if file unavailable
      }
      return {
        name: row.skillKey,
        category: deriveCategory(row),
        path,
        description: row.description,
        enabled: !disabled.has(row.skillKey),
        size,
        lastModified,
      };
    });

    // Merge disk-only skills (not yet in DB) using the shared catalog scanner
    for (const { skillKey, path } of scanDiskSkillsCatalog()) {
      if (dbKeys.has(skillKey)) continue;
      try {
        const st = statSync(path);
        skills.push({
          name: skillKey,
          category: deriveCategory({ category: "", skillKey }),
          path,
          description: "",
          enabled: !disabled.has(skillKey),
          size: st.size,
          lastModified: st.mtime.toISOString(),
        });
      }
      catch {
        // disk-only skill file may have been removed since scan; skip silently
      }
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
    return NextResponse.json({ error: "Failed to list skills" }, { status: 500 });
  }
}
