// ═══════════════════════════════════════════════════════════════
// /api/models/sync/pull — pull single model from Hermes → DB
// Wrapper that reads the model.* section from config.yaml and
// updates the matching DB record by provider+modelId (not DB UUID).
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import * as yaml from "js-yaml";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { getModel, updateModel, listModels } from "@/lib/models-repository";
import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { getActiveFrameworkId } from "@/lib/framework-registry.server";

function readHermesPrimaryModel(): { modelId: string; provider: string; baseUrl: string | null } | null {
  const paths = getActiveHermesPaths();
  if (!existsSync(paths.config)) return null;

  try {
    const raw = readFileSync(paths.config, "utf-8");
    const config = yaml.load(raw) as { model?: { default?: string; provider?: string; base_url?: string } } | null;
    if (!config?.model?.default) return null;
    return {
      modelId: config.model.default,
      provider: config.model.provider ?? "",
      baseUrl: config.model.base_url?.trim() || null,
    };
  } catch {
    return null;
  }
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

  const { modelId } = (raw as Record<string, string>) ?? {};
  if (!modelId) {
    return NextResponse.json({ error: "modelId is required" }, { status: 400 });
  }

  try {
    // Find the model in DB by ID (could be DB UUID or the actual DB model record ID)
    const dbModels = listModels(getActiveFrameworkId());
    const model = dbModels.find((m) => m.id === modelId) ?? getModel(modelId);
    if (!model) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    // Read config.yaml primary model section
    const hermesModel = readHermesPrimaryModel();

    if (!hermesModel) {
      return NextResponse.json({
        data: {
          success: true,
          details: [{ action: "info", detail: "No model section in config.yaml" }],
          diffs: [],
        },
      });
    }

    interface Diff { field: string; before: unknown; after: unknown }
    const diffs: Diff[] = [];
    const updates: Record<string, unknown> = {};

    if (hermesModel.modelId && hermesModel.modelId !== model.modelId) {
      diffs.push({ field: "modelId", before: model.modelId, after: hermesModel.modelId });
      updates.modelId = hermesModel.modelId;
    }
    if (hermesModel.provider && hermesModel.provider !== model.provider) {
      diffs.push({ field: "provider", before: model.provider, after: hermesModel.provider });
      updates.provider = hermesModel.provider;
    }
    if (hermesModel.baseUrl !== model.baseUrl) {
      diffs.push({ field: "baseUrl", before: model.baseUrl, after: hermesModel.baseUrl + "" });
      updates.baseUrl = hermesModel.baseUrl;
    }

    if (Object.keys(updates).length > 0) {
      updateModel(model.id, updates);
    }

    return NextResponse.json({
      data: {
        success: true,
        details: [
          {
            action: diffs.length > 0 ? "updated" : "unchanged",
            detail: diffs.length > 0
              ? `Applied ${diffs.length} change(s)`
              : `No changes needed for ${model.name}`,
          },
        ],
        diffs,
      },
    });
  } catch (error) {
    logApiError("POST /api/models/sync/pull", `pulling model ${modelId}`, error);
    return NextResponse.json({ error: "Failed to pull model" }, { status: 500 });
  }
}
