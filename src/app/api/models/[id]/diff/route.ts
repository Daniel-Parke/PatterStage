// ═══════════════════════════════════════════════════════════════
// /api/models/[id]/diff — show what would change on push or pull
// POST: returns diff between DB model and Hermes config.yaml
// Body: { direction?: "push" | "pull" } (default: "push")
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { logApiError } from "@/lib/api-logger";
import { getModelWithKey } from "@/lib/models-repository";
import { readHermesYamlConfig } from "@/lib/hermes-config-sync";
import { envVarForProvider, isHermesProvider } from "@/lib/hermes-providers";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { maskKeyHint } from "@/lib/secret-mask";
import { notFound, serverError } from "@/lib/api-response";

interface DiffEntry {
  id: string;
  label: string;
  detail: string;
}

interface ConfigModelSection {
  default?: string;
  provider?: string;
  base_url?: string;
  context_length?: number;
}

function readHermesModelSection(): ConfigModelSection | null {
  const config = readHermesYamlConfig<Record<string, unknown>>();
  return (config?.model as ConfigModelSection) ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const body = bodyResult;
  const direction = (body?.direction as "push" | "pull") ?? "push";
  const { id } = await params;

  try {
    const model = getModelWithKey(id);
    if (!model) {
      return notFound("Model not found");
    }

    const diffs: DiffEntry[] = [];
    const hermesModel = readHermesModelSection();

    if (direction === "push") {
      // Export: show the DB model's values as "will be written"
      if (model.modelId) {
        diffs.push({
          id: "modelId",
          label: "Model ID",
          detail: model.modelId,
        });
      }
      if (model.provider) {
        diffs.push({
          id: "provider",
          label: "Provider",
          detail: model.provider,
        });
      }
      diffs.push({
        id: "baseUrl",
        label: "Base URL",
        detail: model.baseUrl ?? "(none)",
      });

      // Credential
      if (model.credentialsId && model.apiKey) {
        const envVar = isHermesProvider(model.provider) ? envVarForProvider(model.provider) : null;
        if (envVar) {
          diffs.push({
            id: "model-env",
            label: "Credential",
            detail: `Write ${envVar}=${maskKeyHint(model.apiKey)} to ~/.hermes/.env`,
          });
        }
      }

      if (diffs.length === 0) {
        diffs.push({
          id: "no-change",
          label: "No data",
          detail: `${model.name} has no settings to export`,
        });
      }
    } else {
      // Import: show config.yaml values as "current config has"
      if (!hermesModel || !hermesModel.default) {
        diffs.push({
          id: "no-hermes-data",
          label: "No data in config.yaml",
          detail: `No model section found in config.yaml`,
        });
      } else {
        diffs.push({
          id: "modelId",
          label: "Model ID",
          detail: hermesModel.default,
        });
        if (hermesModel.provider) {
          diffs.push({
            id: "provider",
            label: "Provider",
            detail: hermesModel.provider,
          });
        }
        diffs.push({
          id: "baseUrl",
          label: "Base URL",
          detail: hermesModel.base_url ?? "(none)",
        });
      }

      if (diffs.length === 0) {
        diffs.push({
          id: "no-change",
          label: "No changes",
          detail: `${model.name} is already in sync with config.yaml`,
        });
      }
    }

    return NextResponse.json({ data: { diffs, modelName: model.name } });
  } catch (error) {
    logApiError("POST /api/models/[id]/diff", "computing diff", error);
    return serverError("Failed to compute diff");
  }
}
