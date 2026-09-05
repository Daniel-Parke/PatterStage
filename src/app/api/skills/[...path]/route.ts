import { NextRequest } from "next/server";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";

// design-lint-disable-next-line hermes-outside-adapter -- this route is a browser onto the agent's own skills tree, so knowing that layout is its whole job. runtime/workspace.ts deliberately keeps `skills` off the port (an authoring tree is framework-shaped in a way a log or transcript directory is not), and widening the port with a field one route would use would move the knowledge without removing it.
import { getActiveHermesPaths } from "@/modules/hermes/lib/agent-runtime";
import { logApiError, serverErrorFromCatch } from "@/lib/api-logger";
import { resolveSkillDirUnderRoot } from "@/lib/fs/path-security";
import { getSkill, parseSkillFrontmatter, stripSkillFrontmatter } from "@/lib/skills-repository";
import { ensureDb } from "@/lib/db";

import { badRequest, notFound, ok } from "@/lib/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  // design-lint-disable-next-line hermes-outside-adapter -- the skills root is the containment boundary this request is checked against, so the route must name it; see the import for why it is not on the port.
  const resolved = resolveSkillDirUnderRoot(getActiveHermesPaths().skills, path);
  if (!resolved.ok) {
    return badRequest(resolved.error);
  }
  const skillDir = resolved.skillDir;
  const skillMdPath = skillDir + "/SKILL.md";

  // The catalogue is the destination this viewer is linked from, and a skill
  // can be in the catalogue before it has ever been written to disk. Answering
  // 404 there sent the operator to "Skill Not Found" for a row they were
  // reading a description of one click earlier (T-0103, D81).
  if (!existsSync(skillMdPath)) {
    ensureDb();
    const row = getSkill(path.join("/"));
    if (!row) {
      return notFound(`Skill not found: ${path.join("/")}`);
    }
    const body = stripSkillFrontmatter(row.content);
    const fm = parseSkillFrontmatter(row.content);
    return ok({
      name: path[path.length - 1],
      path: path.join("/"),
      source: "catalog",
      frontmatter: {
        name: fm.name || row.displayName,
        description: fm.description || row.description,
        category: fm.category || row.category,
      },
      content: body,
      rawContent: row.content,
      size: row.content.length,
      lastModified: row.updatedAt,
      // Linked files live beside SKILL.md, and there is no SKILL.md.
      linkedFiles: [],
    });
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

    return ok({
      name: path[path.length - 1],
      path: path.join("/"),
      source: "disk",
      frontmatter,
      content: body,
      rawContent: content,
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      linkedFiles,
    });
  } catch (err) {
    return serverErrorFromCatch(
      "GET /api/skills/[...path]",
      "reading skill",
      err,
      "Failed to read skill",
    );
  }
}
