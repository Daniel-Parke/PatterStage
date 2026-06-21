// ═══════════════════════════════════════════════════════════════
// GET /api/laboratory/research/[id]/export — standalone interactive HTML report
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { ensureDb } from "@/lib/db";
import { getResearchRun, listResearchSteps } from "@/lib/laboratory/deep-research/research-repository";
import { buildExportHtml } from "@/lib/laboratory/deep-research/report";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  ensureDb();
  const run = getResearchRun(id);
  if (!run) return new NextResponse("Research run not found", { status: 404 });

  const html = buildExportHtml(run, listResearchSteps(id));
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="research-${id.slice(0, 8)}.html"`,
    },
  });
}
