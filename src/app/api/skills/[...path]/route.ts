import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";

import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";
import { resolveSkillDirUnderRoot } from "@/lib/path-security";
import { parseSkillFrontmatter, stripSkillFrontmatter } from "@/lib/skills-repository";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const auth = requireAuth(request);
  if (auth) return auth;
  const { path } = await params;
  const resolved = resolveSkillDirUnderRoot(getActiveHermesPaths().skills, path);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: 400 }
    );
  }
  const skillDir = resolved.skillDir;
  const skillMdPath = skillDir + "/SKILL.md";

  if (!existsSync(skillMdPath)) {
    return NextResponse.json(
      { error: `Skill not found: ${path.join("/")}` },
      { status: 404 }
    );
  }

  try {
    const content = readFileSync(skillMdPath, "utf-8");
    const stats = statSync(skillMdPath);

    // Parse frontmatter using canonical skills-repository parser
    const fm = parseSkillFrontmatter(content);
    const frontmatter: Record<string, unknown> = {
      name: fm.name,
      description: fm.description,
      category: fm.category,
    };

    // Strip frontmatter from body using the canonical helper.
    const body = stripSkillFrontmatter(content);

    // Find linked files (references/, templates/, scripts/, assets/)
    const linkedFiles: { name: string; path: string; size: number }[] = [];
    for (const subdir of ["references", "templates", "scripts", "assets"]) {
      const subdirPath = skillDir + "/" + subdir;
      if (existsSync(subdirPath)) {
        try {
          const items = readdirSync(subdirPath, { withFileTypes: true });
          for (const item of items) {
            if (item.isFile()) {
              const fPath = subdirPath + "/" + item.name;
              const fStats = statSync(fPath);
              linkedFiles.push({
                name: item.name,
                path: subdir + "/" + item.name,
                size: fStats.size,
              });
            }
          }
        } catch (err) {
          logApiError("GET /api/skills/[...path]", "reading linked files in " + subdirPath, err);
        }
      }
    }

    return NextResponse.json({
      data: {
        name: path[path.length - 1],
        path: path.join("/"),
        frontmatter,
        content: body,
        rawContent: content,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        linkedFiles,
      },
    });
  } catch (err) {
    logApiError("GET /api/skills/[...path]", "reading skill", err);
    return NextResponse.json(
      { error: "Failed to read skill" },
      { status: 500 }
    );
  }
}
