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
  // `inline` so clicking the link opens the report in the browser; an <a download>
  // on the UI side still lets the user save it. (filename used when saved.)
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="research-${id.slice(0, 8)}.html"`,
    },
  });
}
