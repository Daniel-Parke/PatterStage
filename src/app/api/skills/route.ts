import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { notFound, ok } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { safeStat } from "@/lib/fs-stats";
import { resolveEffectiveDisabledSkills } from "@/modules/hermes/lib/effective-disabled-skills";
import { getProfile } from "@/lib/profiles-repository";
import { listSkills, deriveCategory } from "@/lib/skills-repository";
import { skillFilePath, skillsRootForProfile } from "@/lib/skills-config";
import { requireSafeProfileName } from "@/lib/path-security";
import { scanDiskSkillsCatalog } from "@/lib/hermes-profile-sync";
import { groupByCategory } from "@/lib/skills-grouping";
import type { Skill } from "@/types/console";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const profileParam = request.nextUrl.searchParams.get("profile") || "default";
  const refreshFromDisk = request.nextUrl.searchParams.get("refresh") === "1";
  const prof = requireSafeProfileName(profileParam);
  if (prof instanceof NextResponse) return prof;
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
      const path = skillFilePath(skillsDir, row.skillKey);
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
    //
    // `Object.fromEntries(map)` is the canonical Map→Record conversion
    // (the 4-line `for (const [k, v] of map) record[k] = v;` pattern is
    // the pre-`Object.fromEntries` idiom). The helper returns a fresh
    // `Record<string, Skill[]>` with the same shape as the old loop
    // (Map<string, Skill[]> → Record<string, Skill[]>) so the rest of
    // the handler is byte-equivalent.
    const categoryGroups = groupByCategory(skills, "uncategorized");
    const categories = Object.fromEntries(categoryGroups) as Record<string, Skill[]>;

    return ok({
      skills,
      categories,
      total: skills.length,
      categoryCount: Object.keys(categories).length,
      profile,
    });
  }
  catch (error) {
    return serverErrorFromCatch(
      "GET /api/skills",
      "listing skills",
      error,
      "Failed to list skills",
    );
  }
}
