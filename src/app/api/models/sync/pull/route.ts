// ═══════════════════════════════════════════════════════════════
// /api/models/sync/pull — pull all matching models from Hermes → DB
// Reads all model sections from config.yaml and updates matching
// DB records by provider+modelId.
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";

import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { updateModel, listModels } from "@/lib/models-repository";
import { readHermesConfigModels } from "@/modules/hermes/lib/hermes-config-read";
// One comparison, shared with the diff preview (T-0100, D13).
import { diffModelAgainstHermes, type ModelDiff } from "@/modules/hermes/lib/model-diff";
import { notFound, ok } from "@/lib/api-response";
import { modelKey } from "@/lib/model-key";
import { z } from "zod";

export async function POST(request: NextRequest) {
  // Body is entirely optional — `{}` triggers a bulk pull, `{ modelId }`
  // triggers a single-model pull, `{ modelId, excluded: [...] }` pulls
  // one model minus the excluded fields. All fields are optional.
  const pullPostSchema = z
    .object({
      modelId: z.string().optional(),
      excluded: z.array(z.string()).optional(),
    })
    .strict();

  const parsed = await parseAndValidateJsonBody(request, pullPostSchema);
  if (parsed instanceof NextResponse) return parsed;
  const targetModelId = parsed.modelId;
  const excluded = new Set<string>(parsed.excluded ?? []);
  const hermesModels = readHermesConfigModels();

  // Single-model pull: only the model whose button was clicked
  if (targetModelId) {
    const dbModel = listModels().find((m) => m.id === targetModelId);
    if (!dbModel) {
      return notFound("Model not found");
    }

    const key = modelKey(dbModel.provider, dbModel.modelId);
    const hermes = hermesModels.get(key);
    if (!hermes) {
      return ok({
        success: true,
        details: [{ action: "info", detail: `No matching section in config.yaml for ${dbModel.provider}/${dbModel.modelId}` }],
        diffs: [],
      });
    }

    const { diffs, updates } = diffModelAgainstHermes(dbModel, hermes);

    // Filter out excluded fields
    const filteredKeys = Object.keys(updates).filter((f) => !excluded.has(f));
    const filteredDiffs = diffs.filter((d) => !excluded.has(d.field));
    const filteredUpdates: Record<string, unknown> = {};
    for (const k of filteredKeys) {
      filteredUpdates[k] = updates[k];
    }

    if (Object.keys(filteredUpdates).length > 0) {
      updateModel(dbModel.id, filteredUpdates);
    }

    return ok({
      success: true,
      diffs: filteredDiffs,
    });
  }

  // Bulk pull (backward-compatible — all DB models matched against config.yaml)
  const dbModels = listModels();
  let updatedCount = 0;
  const allDiffs: Array<{ modelId: string; name: string; diffs: ModelDiff[] }> = [];

  for (const dbModel of dbModels) {
    const key = modelKey(dbModel.provider, dbModel.modelId);
    const hermes = hermesModels.get(key);
    if (!hermes) continue;

    const { diffs, updates } = diffModelAgainstHermes(dbModel, hermes);
    if (Object.keys(updates).length > 0) {
      updateModel(dbModel.id, updates);
      updatedCount++;
    }
    if (diffs.length > 0) {
      allDiffs.push({ modelId: dbModel.id, name: dbModel.name, diffs });
    }
  }

  return ok({
    success: true,
    updatedCount,
    details: [
      {
        action: updatedCount > 0 ? "updated" : "unchanged",
        detail: updatedCount > 0
          ? `Applied updates to ${updatedCount} model(s)`
          : "All models already in sync with config.yaml",
      },
    ],
    diffs: allDiffs,
  });
}
