// ═══════════════════════════════════════════════════════════════
// /api/models/[id] — get + update + delete a single model
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";

import { getModel, updateModel, deleteModel } from "@/lib/models-repository";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { appendAuditLine } from "@/lib/audit-log";
import { zodErrorResponse, modelPutSchema } from "@/lib/api-schemas";
import { notFound } from "@/lib/api-response";
import { syncDefaultsToHermesConfig } from "@/lib/hermes-config-sync";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const model = getModel(id);
    if (!model) return notFound("Model not found");
    return NextResponse.json({ data: { model } });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/models/[id]",
      `id=${id}`,
      error,
      "Failed to load model",
    );
  }
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await ctx.params;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const parsed = modelPutSchema.safeParse(bodyResult);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const updated = updateModel(id, parsed.data);
    if (!updated) return notFound("Model not found");
    // Re-sync config.yaml whenever fields that propagate to Hermes change
    // or when default slots move.
    syncDefaultsToHermesConfig();
    appendAuditLine({ action: "model.update", resource: id, ok: true });
    return NextResponse.json({ data: { model: updated } });
  } catch (error) {
    return serverErrorFromCatch(
      "PUT /api/models/[id]",
      `id=${id}`,
      error,
      "Failed to update model",
    );
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const { id } = await ctx.params;
  try {
    const ok = deleteModel(id);
    if (!ok) return notFound("Model not found");
    syncDefaultsToHermesConfig();
    appendAuditLine({ action: "model.delete", resource: id, ok: true });
    return NextResponse.json({ data: { deleted: id } });
  } catch (error) {
    return serverErrorFromCatch(
      "DELETE /api/models/[id]",
      `id=${id}`,
      error,
      "Failed to delete model",
    );
  }
}
