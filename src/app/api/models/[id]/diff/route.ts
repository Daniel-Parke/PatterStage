// ═══════════════════════════════════════════════════════════════
// /api/models/[id]/diff — show what would change on push or pull
// POST: returns diff between DB model and Hermes config.yaml
// Body: { direction?: "push" | "pull" } (default: "push")
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireMcApiKey } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { getModelWithKey } from "@/lib/models-repository";
import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { existsSync, readFileSync } from "fs";
import * as yaml from "js-yaml";

interface DiffEntry {
  id: string;
  label: string;
  detail: string;
}

interface HermesModelSection {
  default?: string;
  provider?: string;
  base_url?: string;
  context_length?: number;
}

function getEnvVarForProvider(provider: string): string | null {
  const map: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    gemini: "GOOGLE_GENERATIVE_AI_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    mistral: "MISTRAL_API_KEY",
    groq: "GROQ_API_KEY",
    huggingface: "HF_TOKEN",
    minimax: "MINIMAX_API_KEY",
    qwen: "DASHSCOPE_API_KEY",
  };
  return map[provider] ?? null;
}

function readHermesModelSection(): HermesModelSection | null {
  const paths = getActiveHermesPaths();
  if (!existsSync(paths.config)) return null;
  try {
    const raw = readFileSync(paths.config, "utf-8");
    const config = yaml.load(raw) as Record<string, unknown> | null;
    return (config?.model as HermesModelSection) ?? null;
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = raw as Record<string, unknown>;
  const direction = (body?.direction as "push" | "pull") ?? "push";
  const { id } = await params;

  try {
    const model = getModelWithKey(id);
    if (!model) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    const diffs: DiffEntry[] = [];
    const hermesModel = readHermesModelSection();

    if (direction === "push") {
      // Push: DB -> config.yaml (show what will be written)
      const hProvider = hermesModel?.provider ?? "";
      const hModelId = hermesModel?.default ?? "";
      const hBaseUrl = hermesModel?.base_url ?? "";

      if (model.modelId) {
        const detail = hModelId && hModelId !== model.modelId
          ? `${hModelId} -> ${model.modelId}`
          : model.modelId;
        diffs.push({
          id: "modelId",
          label: "Model ID",
          detail,
        });
      }
      if (model.provider) {
        const detail = hProvider && hProvider !== model.provider
          ? `${hProvider} -> ${model.provider}`
          : model.provider;
        diffs.push({
          id: "provider",
          label: "Provider",
          detail,
        });
      }
      {
        const detail = (model.baseUrl ?? "") !== hBaseUrl
          ? `${hBaseUrl || "(none)"} -> ${model.baseUrl ?? "(none)"}`
          : model.baseUrl ?? "(none)";
        diffs.push({
          id: "baseUrl",
          label: "Base URL",
          detail,
        });
      }

      // Credential
      if (model.credentialsId && model.apiKey) {
        const envVar = getEnvVarForProvider(model.provider);
        if (envVar) {
          const hint = model.apiKey.slice(0, 4) + "..." + model.apiKey.slice(-4);
          diffs.push({
            id: "model-env",
            label: "Credential",
            detail: `Write ${envVar}=${hint} to ~/.hermes/.env`,
          });
        }
      }

      if (diffs.length === 0) {
        diffs.push({
          id: "no-change",
          label: "No changes",
          detail: `${model.name} is already in sync with config.yaml`,
        });
      }
    } else {
      // Pull: config.yaml → DB (show what will be read)
      if (!hermesModel || !hermesModel.default) {
        diffs.push({
          id: "no-hermes-data",
          label: "No data in config.yaml",
          detail: `No model section found in config.yaml`,
        });
      } else {
        if (hermesModel.default !== model.modelId) {
          diffs.push({
            id: "modelId",
            label: "Model ID",
            detail: `${model.modelId} → ${hermesModel.default}`,
          });
        }
        if (hermesModel.provider && hermesModel.provider !== model.provider) {
          diffs.push({
            id: "provider",
            label: "Provider",
            detail: `${model.provider} → ${hermesModel.provider}`,
          });
        }
        if ((hermesModel.base_url ?? "") !== (model.baseUrl ?? "")) {
          diffs.push({
            id: "baseUrl",
            label: "Base URL",
            detail: `${model.baseUrl ?? "(none)"} → ${hermesModel.base_url ?? "(none)"}`,
          });
        }
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
    return NextResponse.json({ error: "Failed to compute diff" }, { status: 500 });
  }
}
