// ═══════════════════════════════════════════════════════════════
// /api/models/[id]/diff — what a push or a pull would actually change
// POST: compares the registry row against the section the sync touches
// Body: { direction?: "push" | "pull" } (default: "push")
// ═══════════════════════════════════════════════════════════════
//
// Before T-0100 (D13) this route was not a diff. The push branch listed the
// row's own values and never read config.yaml, so the modal offered "Confirm
// (3 changes)" for a model already in sync; the pull branch read config.model
// while the pull itself matched on `provider::modelId`, so a model living
// under `auxiliary.vision` previewed another model's values. Both halves now
// compare, and the pull half shares `diffModelAgainstHermes` with the pull
// route so the ids the operator excludes are the ids the pull honours.
import { existsSync } from "fs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { notFound, ok, methodNotAllowed } from "@/lib/api-response";
import { modelKey } from "@/lib/model-key";
import { getModelWithKey } from "@/lib/models-repository";
import { getAgentWorkspace } from "@/lib/runtime/workspace";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { maskKeyHint } from "@/lib/secret-mask";
import {
  readHermesConfigModels,
  readHermesYamlConfig,
} from "@/modules/hermes/lib/hermes-config-read";
import { diffModelAgainstHermes } from "@/modules/hermes/lib/model-diff";
import { envVarForProvider, isHermesProvider } from "@/modules/hermes/lib/providers";

interface DiffEntry {
  id: string;
  label: string;
  detail: string;
}

/** The one place a field id becomes words. Ids match the pull route's `excluded`. */
const FIELD_LABELS: Record<string, string> = {
  modelId: "Model ID",
  provider: "Provider",
  baseUrl: "Base URL",
  contextLength: "Context length",
};

/**
 * A value as the operator reads it. `undefined` matters as much as `null`
 * here: an absent `base_url` in config.yaml is "(none)", not "undefined".
 */
function fmt(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(none)";
  return String(value);
}

/** A row only when the two sides read differently. */
function rowIfDifferent(field: string, before: unknown, after: unknown): DiffEntry | null {
  const from = fmt(before);
  const to = fmt(after);
  if (from === to) return null;
  return { id: field, label: FIELD_LABELS[field] ?? field, detail: `${from} → ${to}` };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Body is `{ direction?: "push" | "pull" }` (default "push").
  const diffPostSchema = z
    .object({
      direction: z.enum(["push", "pull"]).optional(),
    })
    .strict();

  const parsed = await parseAndValidateJsonBody(request, diffPostSchema);
  if (parsed instanceof NextResponse) return parsed;
  const direction = parsed.direction ?? "push";
  const { id } = await params;

  try {
    const model = getModelWithKey(id);
    if (!model) {
      return notFound("Model not found");
    }

    const config = readHermesYamlConfig<Record<string, unknown>>();

    // A file that exists and does not parse is neither "empty" nor "in sync".
    // Checked before either branch, because both would otherwise read the
    // absence of a parsed section as the absence of a section.
    if (config === null && existsSync(getAgentWorkspace().config)) {
      return ok({
        diffs: [],
        modelName: model.name,
        inSync: false,
        note: "config.yaml did not parse. Repair it before pushing",
      });
    }

    const diffs: DiffEntry[] = [];
    let note: string | null = null;
    let inSync: boolean;

    if (direction === "push") {
      // A push overwrites `config.model`, so that section is what it changes.
      const section = (config?.model ?? {}) as Record<string, unknown>;
      const rows = [
        rowIfDifferent("modelId", section.default, model.modelId),
        rowIfDifferent("provider", section.provider, model.provider),
        rowIfDifferent("baseUrl", section.base_url, model.baseUrl),
        rowIfDifferent("contextLength", section.context_length, model.contextLength),
      ].filter((row): row is DiffEntry => row !== null);
      diffs.push(...rows);
      inSync = rows.length === 0;

      // The credential is written to a different file, so it is never a
      // reason the model itself is out of sync — but the operator still has
      // to see it before approving, and can still exclude it.
      if (model.credentialsId && model.apiKey) {
        const envVar = isHermesProvider(model.provider) ? envVarForProvider(model.provider) : null;
        if (envVar) {
          diffs.push({
            id: "model-env",
            label: "Credential",
            detail: `Write ${envVar}=${maskKeyHint(model.apiKey)} to the env file`,
          });
        }
      }
    } else {
      // A pull reads the section matching `provider::modelId`, wherever it
      // lives — the same lookup POST /api/models/sync/pull performs.
      const hermes = readHermesConfigModels().get(modelKey(model.provider, model.modelId));
      if (!hermes) {
        inSync = false;
        note = `No matching section in config.yaml for ${model.provider}/${model.modelId}`;
      } else {
        const { diffs: fields } = diffModelAgainstHermes(model, hermes);
        for (const field of fields) {
          diffs.push({
            id: field.field,
            label: FIELD_LABELS[field.field] ?? field.field,
            detail: `${fmt(field.before)} → ${fmt(field.after)}`,
          });
        }
        inSync = fields.length === 0;
      }
    }

    if (inSync && note === null) {
      note = `${model.name} is already in sync with config.yaml`;
    }

    return ok({ diffs, modelName: model.name, inSync, note });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/models/[id]/diff",
      "computing diff",
      error,
      "Failed to compute diff",
    );
  }
}

// A diff is computed from a submitted candidate, so there is nothing to GET.
export async function GET() {
  return methodNotAllowed(
    "GET is not supported here — POST the candidate model to diff it against the stored one", ["POST"]);
}
