import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";

import { getActiveHermesHome } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { resolveSafeProfileName } from "@/lib/path-security";
import {
  buildEnabledYamlLines,
  findSkillsEnabledBlockLineRange,
  findSkillsHeaderLineIndex,
  getResolvedEnabledSkillNames,
  configPathForProfile,
  skillsRootForProfile,
} from "@/lib/skills-enabled-config";

// PUT — Toggle a skill on/off for a profile
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  const { name } = await params;

  try {
    const body = await request.json();
    const { profile: profileParam, enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "enabled (boolean) is required" }, { status: 400 });
    }

    const profileResult = resolveSafeProfileName(profileParam);
    if (!profileResult.ok) {
      return NextResponse.json({ error: profileResult.error }, { status: 400 });
    }
    const profile = profileResult.profile;

    const home = getActiveHermesHome();
    const configPath = configPathForProfile(home, profile);

    if (!existsSync(configPath)) {
      return NextResponse.json({ error: "Profile config not found" }, { status: 404 });
    }

    const content = readFileSync(configPath, "utf-8");
    const skillsRoot = skillsRootForProfile(home, profile);
    const currentEnabled = getResolvedEnabledSkillNames(content, skillsRoot);

    const newEnabled = enabled
      ? currentEnabled.includes(name)
        ? currentEnabled
        : [...currentEnabled, name].sort()
      : currentEnabled.filter((s) => s !== name);

    const lines = content.split(/\r?\n/);
    const trailingNl = /\r?\n$/.test(content);
    const yamlLines = buildEnabledYamlLines(newEnabled);

    const range = findSkillsEnabledBlockLineRange(lines);
    if (range) {
      lines.splice(range.start, range.endExclusive - range.start, ...yamlLines);
    } else {
      const hi = findSkillsHeaderLineIndex(lines);
      if (hi >= 0) {
        lines.splice(hi + 1, 0, ...yamlLines);
      } else {
        if (lines.length > 0 && lines[lines.length - 1].trim() !== "") {
          lines.push("");
        }
        lines.push("skills:");
        lines.push(...yamlLines);
      }
    }

    const out = lines.join("\n") + (trailingNl ? "\n" : "");
    writeFileSync(configPath, out, "utf-8");

    return NextResponse.json({
      data: { success: true, skill: name, profile, enabled },
    });
  } catch (error) {
    logApiError("PUT /api/skills/[name]/toggle", "toggling skill", error);
    return NextResponse.json({ error: "Failed to toggle skill" }, { status: 500 });
  }
}
