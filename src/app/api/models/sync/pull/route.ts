// ═══════════════════════════════════════════════════════════════
// /api/models/sync/pull — pull all matching models from Hermes → DB
// Reads all model sections from config.yaml and updates matching
// DB records by provider+modelId.
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { updateModel, listModels } from "@/lib/models-repository";
import { readHermesConfigModels, type HermesConfigModelEntry } from "@/lib/hermes-config-sync";


interface Diff { field: string; before: unknown; after: unknown }

function computeDiffs(
  model: {
    modelId: string;
    provider: string;
    baseUrl: string | null;
    contextLength: number | null;
  },
  hermes: HermesConfigModelEntry,
): { diffs: Diff[]; updates: Record<string, unknown> } {
  const diffs: Diff[] = [];
  const updates: Record<string, unknown> = {};

  if (hermes.modelId && hermes.modelId !== model.modelId) {
    diffs.push({ field: "modelId", before: model.modelId, after: hermes.modelId });
    updates.modelId = hermes.modelId;
  }
  if (hermes.provider && hermes.provider !== model.provider) {
    diffs.push({ field: "provider", before: model.provider, after: hermes.provider });
    updates.provider = hermes.provider;
  }
  if (hermes.baseUrl !== model.baseUrl) {
    diffs.push({ field: "baseUrl", before: model.baseUrl, after: hermes.baseUrl ?? "" });
    updates.baseUrl = hermes.baseUrl;
  }
  if (
    hermes.contextLength != null &&
    hermes.contextLength !== model.contextLength
  ) {
    diffs.push({
      field: "contextLength",
      before: model.contextLength,
      after: hermes.contextLength,
    });
    updates.contextLength = hermes.contextLength;
  }

  return { diffs, updates };
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const body = bodyResult;
  const targetModelId = body?.modelId as string | undefined;
  const excluded = new Set<string>((body?.excluded as string[] | undefined) ?? []);
  const hermesModels = readHermesConfigModels();

  // Single-model pull: only the model whose button was clicked
  if (targetModelId) {
    const dbModel = listModels().find((m) => m.id === targetModelId);
    if (!dbModel) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    const key = `${dbModel.provider}::${dbModel.modelId}`;
    const hermes = hermesModels.get(key);
    if (!hermes) {
      return NextResponse.json({
        data: {
          success: true,
          details: [{ action: "info", detail: `No matching section in config.yaml for ${dbModel.provider}/${dbModel.modelId}` }],
          diffs: [],
        },
      });
    }

    const { diffs, updates } = computeDiffs(dbModel, hermes);

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

    return NextResponse.json({
      data: {
        success: true,
        diffs: filteredDiffs,
      },
    });
  }

  // Bulk pull (backward-compatible — all DB models matched against config.yaml)
  const dbModels = listModels();
  let updatedCount = 0;
  const allDiffs: Array<{ modelId: string; name: string; diffs: Diff[] }> = [];

  for (const dbModel of dbModels) {
    const key = `${dbModel.provider}::${dbModel.modelId}`;
    const hermes = hermesModels.get(key);
    if (!hermes) continue;

    const { diffs, updates } = computeDiffs(dbModel, hermes);
    if (Object.keys(updates).length > 0) {
      updateModel(dbModel.id, updates);
      updatedCount++;
    }
    if (diffs.length > 0) {
      allDiffs.push({ modelId: dbModel.id, name: dbModel.name, diffs });
    }
  }

  return NextResponse.json({
    data: {
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
    },
  });
}
// ═══════════════════════════════════════════════════════════════
