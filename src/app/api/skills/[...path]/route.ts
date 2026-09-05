import { NextRequest } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { resolveSkillDirUnderRoot } from "@/lib/fs/path-security";
import { readSkillView, skillsRoot } from "@/modules/hermes/lib/skill-view";
import { ensureDb } from "@/lib/db";

import { badRequest, notFound, ok } from "@/lib/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const resolved = resolveSkillDirUnderRoot(skillsRoot(), path);
  if (!resolved.ok) {
    return badRequest(resolved.error);
  }

  try {
    ensureDb();
    // Disk first, catalogue second. A skill can be in the catalogue before it
    // has ever been written to disk, and that row is what the operator clicked
    // (T-0103, D81).
    const view = readSkillView(path, resolved.skillDir);
    if (!view) {
      return notFound(`Skill not found: ${path.join("/")}`);
    }
    return ok(view);
  } catch (err) {
    return serverErrorFromCatch(
      "GET /api/skills/[...path]",
      "reading skill",
      err,
      "Failed to read skill",
    );
  }
}
