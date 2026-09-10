import { NextRequest, NextResponse } from "next/server";
import { requireNotReadOnly } from "@/lib/api/api-auth";
import { badRequest, notFound, ok, serverError } from "@/lib/api/api-response";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { appendAuditLine } from "@/lib/api/audit-log";
import { ensureDb } from "@/lib/db";
import { upsertSkill, parseSkillFrontmatter } from "@/lib/skills/skills-repository";
import { readSkillView, skillsRoot } from "@/modules/hermes/lib/skill-view";
import { resolveSkillDirUnderRoot } from "@/lib/fs/path-security";
import { pushSkillToHermes } from "@/modules/hermes/lib/profile-push";
import { route } from "@/lib/api/api-route";

export const GET = route("GET /api/skills/[name]", (p) => `reading skill ${p.name}`, "Failed to read skill", async (request: NextRequest, { params }: { params: Promise<{ name: string }> }) => {
  const { name } = await params;
  ensureDb();
  // A single-segment key lands here and a nested one lands on
  // [...path]; the two used to answer different shapes, and the viewer
  // reached into the fields only the catch-all sent, so opening any
  // top-level skill threw (T-0103, D81). One reader, one payload.
  const resolved = resolveSkillDirUnderRoot(skillsRoot(), [name]);
  if (!resolved.ok) {
    return badRequest(resolved.error);
  }
  const view = readSkillView([name], resolved.skillDir);
  if (!view) {
    return notFound(`Skill not found: ${name}`);
  }
  return ok(view);
});

export const PUT = route("PUT /api/skills/[name]", (p) => `writing skill ${p.name}`, "Failed to write skill", async (request: NextRequest, { params }: { params: Promise<{ name: string }> }) => {
  const ro = requireNotReadOnly("skill writes are disabled");
  if (ro) return ro;

  const { name } = await params;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const content =
    "content" in bodyResult && typeof bodyResult.content === "string"
      ? bodyResult.content
      : undefined;

  if (typeof content !== "string") {
    return badRequest("Content is required");
  }
  ensureDb();
  const meta = parseSkillFrontmatter(content);
  upsertSkill({
    skillKey: name,
    content,
    displayName: meta.name || name,
    description: meta.description,
    category: meta.category,
    source: "custom",
  });

  const push = pushSkillToHermes(name);
  if (!push.success) {
    return serverError(push.error ?? "Push failed");
  }

  appendAuditLine({
    action: "skills.put",
    resource: name,
    ok: true,
  });

  return ok({
    success: true,
    name,
    size: content.length,
  });
});
