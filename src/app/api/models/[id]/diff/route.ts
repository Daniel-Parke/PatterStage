// ═══════════════════════════════════════════════════════════════
// /api/models/[id]/diff — show what would change on push or pull
// POST: returns diff between DB model and Hermes config.yaml
// Body: { direction?: "push" | "pull" } (default: "push")
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { getModelWithKey } from "@/lib/models-repository";
import { readHermesYamlConfig } from "@/lib/hermes-config-sync";
import { envVarForProvider, isHermesProvider } from "@/lib/hermes-providers";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { maskKeyHint } from "@/lib/secret-mask";
import { notFound, ok } from "@/lib/api-response";

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
    // Local closure — collapses the 9 inline `diffs.push({id, label, detail})`
    // sites below into a single token per call. The wire shape is identical
    // (push appends the same `{id, label, detail}` object), so this is
    // pure refactor.
    const pushDiff = (id: string, label: string, detail: string) => {
      diffs.push({ id, label, detail });
    };
    const hermesModel = readHermesModelSection();

    if (direction === "push") {
      // Export: show the DB model's values as "will be written"
      if (model.modelId) {
        pushDiff("modelId", "Model ID", model.modelId);
      }
      if (model.provider) {
        pushDiff("provider", "Provider", model.provider);
      }
      pushDiff("baseUrl", "Base URL", model.baseUrl ?? "(none)");

      // Credential
      if (model.credentialsId && model.apiKey) {
        const envVar = isHermesProvider(model.provider) ? envVarForProvider(model.provider) : null;
        if (envVar) {
          pushDiff(
            "model-env",
            "Credential",
            `Write ${envVar}=${maskKeyHint(model.apiKey)} to ~/.hermes/.env`,
          );
        }
      }

      if (diffs.length === 0) {
        pushDiff("no-change", "No data", `${model.name} has no settings to export`);
      }
    } else {
      // Import: show config.yaml values as "current config has"
      if (!hermesModel || !hermesModel.default) {
        pushDiff(
          "no-hermes-data",
          "No data in config.yaml",
          `No model section found in config.yaml`,
        );
      } else {
        pushDiff("modelId", "Model ID", hermesModel.default);
        if (hermesModel.provider) {
          pushDiff("provider", "Provider", hermesModel.provider);
        }
        pushDiff("baseUrl", "Base URL", hermesModel.base_url ?? "(none)");
      }

      if (diffs.length === 0) {
        pushDiff(
          "no-change",
          "No changes",
          `${model.name} is already in sync with config.yaml`,
        );
      }
    }

    return ok({ diffs, modelName: model.name });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/models/[id]/diff",
      "computing diff",
      error,
      "Failed to compute diff",
    );
  }
}
