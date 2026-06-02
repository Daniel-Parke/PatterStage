import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";

import { logApiError } from "@/lib/api-logger";
import { requireAuth, requireNotReadOnly } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { safeStat } from "@/lib/fs-stats";
import { appendAuditLine } from "@/lib/audit-log";
import { ensureDb } from "@/lib/db";
import { getSkill, upsertSkill, parseSkillFrontmatter } from "@/lib/skills-repository";
import { pushSkillToHermes } from "@/lib/hermes-profile-sync";
import { skillsRootForProfile } from "@/lib/skills-config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    ensureDb();
    const row = getSkill(name);
    if (row) {
      return NextResponse.json({
        data: {
          name,
          path: skillsRootForProfile() + "/" + name + "/SKILL.md",
          content: row.content,
          size: row.content.length,
          lastModified: row.updatedAt,
        },
      });
    }

    const skillsRoot = skillsRootForProfile();
    const filePath = skillsRoot + "/" + name + "/SKILL.md";
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: `Skill not found: ${name}` }, { status: 404 });
    }

    const content = readFileSync(filePath, "utf-8");
    const st = safeStat(filePath)!; // file confirmed to exist above

    return NextResponse.json({
      data: {
        name,
        path: filePath,
        content,
        size: st.size,
        lastModified: st.mtime,
      },
    });
  }
  catch (error) {
    logApiError("GET /api/skills/[name]", `reading skill ${name}`, error);
    return NextResponse.json({ error: "Failed to read skill" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;
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
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
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
      return NextResponse.json({ error: push.error ?? "Push failed" }, { status: 500 });
    }

    appendAuditLine({
      action: "skills.put",
      resource: name,
      ok: true,
    });

    return NextResponse.json({
      data: {
        success: true,
        name,
        size: content.length,
      },
    });
  }
  catch (error) {
    logApiError("PUT /api/skills/[name]", `writing skill ${name}`, error);
    return NextResponse.json({ error: "Failed to write skill" }, { status: 500 });
  }
}
