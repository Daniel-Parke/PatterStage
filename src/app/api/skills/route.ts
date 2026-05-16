import { NextRequest, NextResponse } from "next/server";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";

import { getActiveHermesHome } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";
import {
  parseSkillsEnabledFromYaml,
  configPathForProfile,
  skillsRootForProfile,
  type ParsedSkillsEnabled,
} from "@/lib/skills-enabled-config";

interface Skill {
  name: string;
  category: string;
  path: string;
  description: string;
  enabled: boolean;
  size: number;
  lastModified: string;
}

function scanSkills(dir: string, category: string, parsed: ParsedSkillsEnabled): Skill[] {
  const skills: Skill[] = [];
  if (!existsSync(dir)) return skills;

  try {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith(".")) continue;
      const fullPath = dir + "/" + item.name;

      if (item.isDirectory()) {
        const skillPath = fullPath + "/SKILL.md";
        if (existsSync(skillPath)) {
          try {
            const content = readFileSync(skillPath, "utf-8");
            const stats = statSync(skillPath);
            let description = "";
            const descMatch = content.match(/description:\s*["'](.+?)["']/);
            if (descMatch) description = descMatch[1];
            else {
              const lines = content.split("\n");
              for (const line of lines) {
                const t = line.trim();
                if (t && !t.startsWith("#") && !t.startsWith("---") && !t.startsWith("```")) {
                  description = t.substring(0, 120);
                  break;
                }
              }
            }

            const enabled =
              parsed.mode === "inherit_all" || parsed.enabledNames.has(item.name);

            skills.push({
              name: item.name,
              category: category || "uncategorized",
              path: skillPath,
              description,
              enabled,
              size: stats.size,
              lastModified: stats.mtime.toISOString(),
            });
          } catch (error) {
            logApiError("GET /api/skills", `reading skill ${skillPath}`, error);
          }
        }

        skills.push(...scanSkills(fullPath, item.name, parsed));
      }
    }
  } catch (error) {
    logApiError("GET /api/skills", `reading skills directory ${dir}`, error);
  }
  return skills;
}

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile") || "default";

  try {
    const home = getActiveHermesHome();
    const configPath = configPathForProfile(home, profile);
    const skillsDir = skillsRootForProfile(home, profile);

    const rawConfig = existsSync(configPath) ? readFileSync(configPath, "utf-8") : "";
    const parsed = rawConfig
      ? parseSkillsEnabledFromYaml(rawConfig)
      : { mode: "inherit_all" as const };

    const skills = scanSkills(skillsDir, "", parsed);

    const categories: Record<string, Skill[]> = {};
    for (const skill of skills) {
      const cat = skill.category || "uncategorized";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(skill);
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
  } catch (error) {
    logApiError("GET /api/skills", "listing skills", error);
    return NextResponse.json({ error: "Failed to list skills" }, { status: 500 });
  }
}
