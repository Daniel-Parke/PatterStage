import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync, statSync } from "fs";

import { getActiveHermesHome } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";
import { findSkillFile } from "@/lib/skills-enabled-config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const profile = request.nextUrl.searchParams.get("profile") || "default";

  try {
    const filePath = findSkillFile(name, getActiveHermesHome(), profile);

    if (!filePath || !existsSync(filePath)) {
      return NextResponse.json(
        { error: `Skill not found: ${name}` },
        { status: 404 }
      );
    }

    const content = readFileSync(filePath, "utf-8");
    const stats = statSync(filePath);

    return NextResponse.json({
      data: {
        name,
        path: filePath,
        content,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
      },
    });
  } catch (error) {
    logApiError("GET /api/skills/[name]", `reading skill ${name}`, error);
    return NextResponse.json({ error: "Failed to read skill" }, { status: 500 });
  }
}
