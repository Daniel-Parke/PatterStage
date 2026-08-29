import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { requireNotReadOnly } from "@/lib/api-auth";
import { badRequest, notFound, ok, serverError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { safeStat } from "@/lib/fs/fs-stats";
import { appendAuditLine } from "@/lib/audit-log";
import { ensureDb } from "@/lib/db";
import { getSkill, upsertSkill, parseSkillFrontmatter } from "@/lib/skills-repository";
import { pushSkillToHermes } from "@/modules/hermes/lib/profile-push";
import { skillFilePath, skillsRootForProfile } from "@/modules/hermes/lib/skills-config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  try {
    ensureDb();
    const row = getSkill(name);
    if (row) {
      return ok({
        name,
        path: skillFilePath(skillsRootForProfile(), name),
        content: row.content,
        size: row.content.length,
        lastModified: row.updatedAt,
      });
    }

    const skillsRoot = skillsRootForProfile();
    const filePath = skillFilePath(skillsRoot, name);
    if (!existsSync(filePath)) {
      return notFound(`Skill not found: ${name}`);
    }

    const content = readFileSync(filePath, "utf-8");
    const st = safeStat(filePath)!; // file confirmed to exist above

    return ok({
      name,
      path: filePath,
      content,
      size: st.size,
      lastModified: st.mtime,
    });
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
