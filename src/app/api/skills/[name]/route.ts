import { NextRequest, NextResponse } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { requireNotReadOnly } from "@/lib/api-auth";
import { badRequest, notFound, ok, serverError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { appendAuditLine } from "@/lib/audit-log";
import { ensureDb } from "@/lib/db";
import { upsertSkill, parseSkillFrontmatter } from "@/lib/skills-repository";
import { readSkillView, skillsRoot } from "@/modules/hermes/lib/skill-view";
import { resolveSkillDirUnderRoot } from "@/lib/fs/path-security";
import { pushSkillToHermes } from "@/modules/hermes/lib/profile-push";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  try {
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
  }
  catch (error) {
    return serverErrorFromCatch(
      "GET /api/skills/[name]",
      `reading skill ${name}`,
      error,
      "Failed to read skill",
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
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

  try {
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
  }
  catch (error) {
    return serverErrorFromCatch(
      "PUT /api/skills/[name]",
      `writing skill ${name}`,
      error,
      "Failed to write skill",
    );
  }
}
