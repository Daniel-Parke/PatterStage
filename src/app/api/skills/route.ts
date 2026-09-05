import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";

import { notFound, ok } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { safeStat } from "@/lib/fs/fs-stats";
import { resolveEffectiveDisabledSkills } from "@/modules/hermes/lib/effective-disabled-skills";
import { getProfile } from "@/modules/hermes/lib/profiles-repository";
import { listSkillCatalog, deriveCategory } from "@/lib/skills-repository";
import { skillFilePath, skillsRootForProfile } from "@/modules/hermes/lib/skills-config";
import { requireSafeProfileName } from "@/lib/fs/path-security";
import { scanDiskSkillsCatalog } from "@/modules/hermes/lib/profile-discovery";
import { groupByCategory } from "@/lib/skills-grouping";
import type { Skill } from "@/types/console";

export async function GET(request: NextRequest) {
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

    // Catalog metadata only: this handler needs each body's LENGTH, never the
    // body, and `listSkills()` would ship every SKILL.md through SQLite and
    // into JS strings to be discarded a line later.
    const dbSkills = listSkillCatalog();
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
        size: st?.size ?? row.contentLength,
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
    //
    // `categories` carries SIZES, not the skill objects. Serving the buckets
    // re-serialised every Skill that `skills` already carries: 69,574 of this
    // response's 137,534 bytes, in the largest body the app serves. The only
    // consumer reads Object.keys() and groups `skills` itself, so this is a
    // 49.3% cut with no call-site change.
    const categoryGroups = groupByCategory(skills, "uncategorized");
    const categories = Object.fromEntries(
      [...categoryGroups].map(([name, items]) => [name, items.length]),
    ) as Record<string, number>;

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
