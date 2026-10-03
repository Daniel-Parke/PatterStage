// ═══════════════════════════════════════════════════════════════
// /api/models/[id] — get + update + delete a single model
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";

import { getModel, getModelDefaults, updateModel, deleteModel } from "@/lib/models/models-repository";
import { TASK_TYPES } from "@/lib/models/task-types";

import { parseAndValidateJsonBody } from "@/lib/api/parse-json-body";
import { appendAuditLine } from "@/lib/api/audit-log";
import { modelPutSchema } from "@/lib/api/api-schemas";
import { notFound, ok } from "@/lib/api/api-response";
import { finalizeRootConfigOnDisk } from "@/modules/hermes/lib/config-sync";
import { route } from "@/lib/api/api-route";

interface Ctx {
  params: Promise<{ id: string }>;
}

export const GET = route("GET /api/models/[id]", (p) => `id=${p.id}`, "Failed to load model", async (_request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const model = getModel(id);
  if (!model) return notFound("Model not found");
  return ok({ model });
});

export const PUT = route("PUT /api/models/[id]", (p) => `id=${p.id}`, "Failed to update model", async (request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;

  const parsed = await parseAndValidateJsonBody(request, modelPutSchema);
  if (parsed instanceof NextResponse) return parsed;
  // A slot the body switches OFF is a slot this request cleared, so the
  // yaml writer is told to remove it as well.
  const clearedByPut = TASK_TYPES.filter((slot) => parsed.defaults?.[slot] === false);
  const updated = updateModel(id, parsed);
  if (!updated) return notFound("Model not found");
  // Re-sync config.yaml whenever fields that propagate to Hermes change
  // or when default slots move, and refresh the row the next push reads.
  finalizeRootConfigOnDisk({ cleared: clearedByPut });
  appendAuditLine({ action: "model.update", resource: id, ok: true });
  return ok({ model: updated });
});

export const DELETE = route("DELETE /api/models/[id]", (p) => `id=${p.id}`, "Failed to delete model", async (request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  // Which slots this model held, read BEFORE the delete cascades its
  // model_defaults rows away: afterwards there is nothing left to tell the
  // yaml writer which sections to remove.
  const before = getModelDefaults();
  const cleared = TASK_TYPES.filter((slot) => before[slot] === id);
  const okDeleted = deleteModel(id);
  if (!okDeleted) return notFound("Model not found");
  finalizeRootConfigOnDisk({ cleared });
  appendAuditLine({ action: "model.delete", resource: id, ok: true });
  return ok({ deleted: id });
});
