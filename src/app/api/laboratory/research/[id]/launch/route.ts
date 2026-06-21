// ═══════════════════════════════════════════════════════════════
// POST /api/laboratory/research/[id]/launch — research → Composer workflow
//
// Seeds a Composer "Software Delivery" run from a completed research report
// (the report becomes the run's starting context/input). Gated by `composer`.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest, notFound, serviceUnavailable } from "@/lib/api-response";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getResearchRun } from "@/lib/laboratory/deep-research/research-repository";
import { createComposerRun, getWorkflowByKey } from "@/lib/composer/composer-repository";
import { advanceComposerRun } from "@/lib/composer/engine";
import { SOFTWARE_DELIVERY_WORKFLOW_KEY } from "@/lib/composer/schema";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = requireAuth(request);
  if (auth) return auth;
  if (!isFeatureEnabled("composer")) {
    return serviceUnavailable("Composer is not enabled. Set PS_COMPOSER=1 to launch workflows.");
  }

  const { id } = await ctx.params;
  try {
    const run = getResearchRun(id);
    if (!run) return notFound("Research run not found");
    if (run.status !== "completed" || !run.report) {
      return badRequest("Research run is not complete yet");
    }
    const workflow = getWorkflowByKey(SOFTWARE_DELIVERY_WORKFLOW_KEY);
    if (!workflow) return serviceUnavailable("Default workflow not seeded");

    const input =
      `# Research brief\n\n${run.report}\n\n---\n` +
      `Use this research as the starting context for the workflow.`;
    const composerRun = createComposerRun({ workflowId: workflow.id, input });
    void advanceComposerRun(composerRun.id);
    return ok({ composerRunId: composerRun.id });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/laboratory/research/[id]/launch",
      `id=${id}`,
      error,
      "Failed to launch workflow",
    );
  }
}
