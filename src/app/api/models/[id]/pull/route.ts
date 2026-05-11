// ═══════════════════════════════════════════════════════════════
// /api/models/[id]/pull — pull single model from Hermes → DB
// Reads model.* from config.yaml and updates the DB record.
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import * as yaml from "js-yaml";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { getModel, updateModel } from "@/lib/models-repository";
import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";

interface PullResult {
  success: boolean;
  details: Array<{ action: string; detail: string }>;
  diffs: Array<{ field: string; before: unknown; after: unknown }>;
}

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

    const diffs: PullResult["diffs"] = [];
    const updates: Parameters<typeof updateModel>[1] = {};

    if (hermesModel.modelId && hermesModel.modelId !== model.modelId) {
      diffs.push({ field: "modelId", before: model.modelId, after: hermesModel.modelId });
      updates.modelId = hermesModel.modelId;
    }
    if (hermesModel.provider && hermesModel.provider !== model.provider) {
      diffs.push({ field: "provider", before: model.provider, after: hermesModel.provider });
      updates.provider = hermesModel.provider;
    }
    if (hermesModel.baseUrl !== model.baseUrl) {
      diffs.push({ field: "baseUrl", before: model.baseUrl, after: hermesModel.baseUrl });
      updates.baseUrl = hermesModel.baseUrl;
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