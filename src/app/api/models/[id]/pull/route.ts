// ═══════════════════════════════════════════════════════════════
// /api/models/[id]/pull — pull single model from Hermes → DB
// Matches the DB model to a config.yaml section by provider+modelId.
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import * as yaml from "js-yaml";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { getModel, updateModel } from "@/lib/models-repository";
import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";

interface PullDiff {
  field: string;
  before: unknown;
  after: unknown;
}

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

    return map;
  } catch {
    return new Map();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  const { id } = await params;

  try {
    const model = getModel(id);
    if (!model) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    // Find the matching config.yaml section by provider+modelId
    const hermesModels = readHermesConfigModels();
    const key = `${model.provider}::${model.modelId}`;
    const hermes = hermesModels.get(key);

    if (!hermes) {
      return NextResponse.json({
        data: {
          success: true,
          details: [
            { action: "info", detail: `No matching section in config.yaml for ${model.provider}/${model.modelId}` },
          ],
          diffs: [],
        },
      });
    }

    const diffs: PullDiff[] = [];
    const updates: Parameters<typeof updateModel>[1] = {};

    if (hermes.modelId && hermes.modelId !== model.modelId) {
      diffs.push({ field: "modelId", before: model.modelId, after: hermes.modelId });
      updates.modelId = hermes.modelId;
    }
    if (hermes.provider && hermes.provider !== model.provider) {
      diffs.push({ field: "provider", before: model.provider, after: hermes.provider });
      updates.provider = hermes.provider;
    }
    if (hermes.baseUrl !== model.baseUrl) {
      diffs.push({ field: "baseUrl", before: model.baseUrl, after: hermes.baseUrl });
      updates.baseUrl = hermes.baseUrl;
    }

    if (Object.keys(updates).length > 0) {
      updateModel(id, updates);
    }

    return NextResponse.json({
      data: {
        success: true,
        details: [
          {
            action: diffs.length > 0 ? "updated" : "unchanged",
            detail: diffs.length > 0
              ? `Applied ${diffs.length} change(s) to ${model.name}`
              : `No changes needed for ${model.name}`,
          },
        ],
        diffs,
      },
    });
  } catch (error) {
    logApiError("POST /api/models/[id]/pull", `pulling model ${id}`, error);
    return NextResponse.json({ error: "Failed to pull model" }, { status: 500 });
  }
}
// ═══════════════════════════════════════════════════════════════