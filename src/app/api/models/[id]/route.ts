// ═══════════════════════════════════════════════════════════════
// /api/models/[id] — get + update + delete a single model
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";

import { getModel, updateModel, deleteModel } from "@/lib/models-repository";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { appendAuditLine } from "@/lib/audit-log";
import { modelPutSchema } from "@/lib/api-schemas";
import { notFound, ok } from "@/lib/api-response";
import { syncDefaultsToHermesConfig } from "@/modules/hermes/lib/config-sync";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const model = getModel(id);
    if (!model) return notFound("Model not found");
    return ok({ model });
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

  const parsed = await parseAndValidateJsonBody(request, modelPutSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const updated = updateModel(id, parsed);
    if (!updated) return notFound("Model not found");
    // Re-sync config.yaml whenever fields that propagate to Hermes change
    // or when default slots move.
    syncDefaultsToHermesConfig();
    appendAuditLine({ action: "model.update", resource: id, ok: true });
    return ok({ model: updated });
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
    const okDeleted = deleteModel(id);
    if (!okDeleted) return notFound("Model not found");
    syncDefaultsToHermesConfig();
    appendAuditLine({ action: "model.delete", resource: id, ok: true });
    return ok({ deleted: id });
  } catch (error) {
    return serverErrorFromCatch(
      "DELETE /api/models/[id]",
      `id=${id}`,
      error,
      "Failed to delete model",
    );
  }
}
