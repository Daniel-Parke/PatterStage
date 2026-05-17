// ═══════════════════════════════════════════════════════════════
// /api/models/sync/pull — pull all matching models from Hermes → DB
// Reads all model sections from config.yaml and updates matching
// DB records by provider+modelId.
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import * as yaml from "js-yaml";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { updateModel, listModels } from "@/lib/models-repository";
import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";

interface HermesModelSection {
  modelId: string;
  provider: string;
  baseUrl: string | null;
}

/**
 * Read config.yaml and return a map of all model sections keyed by
 * their `provider::modelId` combination. Covers both `model.*` (primary)
 * and `auxiliary.*` sections.
 */
function readHermesConfigModels(): Map<string, HermesModelSection> {
  const paths = getActiveHermesPaths();
  if (!existsSync(paths.config)) return new Map();

  try {
    const raw = readFileSync(paths.config, "utf-8");
    const config = yaml.load(raw) as Record<string, unknown> | null;
    if (!config) return new Map();

    const map = new Map<string, HermesModelSection>();

    // Primary model section
    const model = config.model as { default?: string; provider?: string; base_url?: string } | undefined;
    if (model?.default && model.provider) {
      const key = `${model.provider}::${model.default}`;
      map.set(key, {
        modelId: model.default,
        provider: model.provider,
        baseUrl: model.base_url?.trim() || null,
      });
    }

    // Auxiliary sections
    const aux = config.auxiliary as Record<string, { model?: string; provider?: string; base_url?: string }> | undefined;
    for (const entry of Object.values(aux ?? {})) {
      if (entry?.model && entry.provider) {
        const key = `${entry.provider}::${entry.model}`;
        map.set(key, {
          modelId: entry.model,
          provider: entry.provider,
          baseUrl: entry.base_url?.trim() || null,
        });
      }
    }

    // Fallback providers chain — models used as fallbacks
    const fallback = config.fallback_providers as Array<{ provider?: string; model?: string; base_url?: string }> | undefined;
    for (const entry of fallback ?? []) {
      if (entry?.model && entry.provider) {
        const key = `${entry.provider}::${entry.model}`;
        if (!map.has(key)) {
          map.set(key, {
            modelId: entry.model,
            provider: entry.provider,
            baseUrl: entry.base_url?.trim() || null,
          });
        }
      }
    }

    return map;
  } catch {
    return new Map();
  }
}

interface Diff { field: string; before: unknown; after: unknown }

function computeDiffs(
  model: { modelId: string; provider: string; baseUrl: string | null },
  hermes: HermesModelSection,
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

  return { diffs, updates };
}

export async function POST(request: NextRequest) {
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = raw as Record<string, unknown>;
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
