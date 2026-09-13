import { NextRequest } from "next/server";

import { resolveSkillDirUnderRoot } from "@/lib/fs/path-security";
import { readSkillView, skillsRoot } from "@/modules/hermes/lib/skill-view";
import { ensureDb } from "@/lib/db";

import { badRequest, notFound, ok } from "@/lib/api/api-response";
import { route } from "@/lib/api/api-route";

export const GET = route("GET /api/skills/[...path]", "reading skill", "Failed to read skill", async (request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) => {
  const { path } = await params;
  const resolved = resolveSkillDirUnderRoot(skillsRoot(), path);
  if (!resolved.ok) {
    return badRequest(resolved.error);
  }
  ensureDb();
  // Disk first, catalogue second. A skill can be in the catalogue before it
  // has ever been written to disk, and that row is what the operator clicked
  // (T-0103, D81).
  const view = readSkillView(path, resolved.skillDir);
  if (!view) {
    return notFound(`Skill not found: ${path.join("/")}`);
  }
  return ok(view);
});
