// ═══════════════════════════════════════════════════════════════
// /api/models/defaults — read & write the 11 task-slot defaults
// Hermes-only; no framework scoping needed.
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";

import { getDefaultModel, getModelDefaults, setDefaultModel } from "@/lib/models-repository";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { readCachedConfigResult } from "@/lib/config-cache";
import {
  modelFieldsFromConfig,
  resolveModelReadiness,
  type ModelReadiness,
} from "@/lib/models/model-readiness";

import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { appendAuditLine } from "@/lib/audit-log";
import { setDefaultPutSchema } from "@/lib/api-schemas";
import { notFound, ok } from "@/lib/api-response";
import { finalizeRootConfigOnDisk } from "@/modules/hermes/lib/config-sync";
import { recordEvent } from "@/lib/analytics/record-event";
import { route } from "@/lib/api-route";

/**
 * The readiness sentence, or null when the file it is read from cannot answer.
 *
 * THE CONTAINMENT, and why it is a separate function. This endpoint serves two
 * unrelated things: the registry's task slots, which live in SQLite, and the
 * one readiness answer, which is read from the agent's config file. The Models
 * page fetches it throw-on-error (useModelsRegistry), so anything that escapes
 * here takes the models table, the credentials panel and every slot down with
 * it under "Failed to load registry" -- for a file none of those come from.
 * Before readiness moved in, this endpoint was pure registry and could not fail
 * that way; the guard is what keeps that true now that it is not pure.
 *
 * `null` rather than a verdict when the file is unreadable, because both
 * verdicts would be inventions. The gateway reads that file and nothing else,
 * so with the file unavailable we do not know whether the agent has a model.
 * Resolving from an empty config would print "chosen but has not reached the
 * agent yet" and send the operator to re-send a default that may already be
 * live. `null` is the value every reader already renders as "not known yet":
 * no banner in chat, no badge on Models, "-" on the dashboard.
 */
function resolveReadiness(
  agentDefault: { name: string; modelId: string } | null,
): ModelReadiness | null {
  try {
    const { config, error } = readCachedConfigResult();
    if (error) return null;
    return resolveModelReadiness({
      ...modelFieldsFromConfig(config),
      registryLabel: agentDefault ? agentDefault.name || agentDefault.modelId : null,
    });
  } catch {
    // Belt and braces over the `error` field above: config-cache reports a
    // read failure rather than throwing it, and this makes that a property of
    // the endpoint rather than a promise another module has to keep.
    return null;
  }
}

export const GET = route("GET /api/models/defaults", "reading defaults", "Failed to read defaults", async (_request: NextRequest) => {
  // `defaults` carries registry UUIDs (the Models UI needs them to know which
  // model each slot points at).
  //
  // `modelReadiness` is the product's ONE answer to "do I have a model?",
  // resolved here so chat, the dashboard and the Models page read the same
  // sentence instead of each combining the registry slot with the config
  // file in its own way. It replaces `agentModelLabel`, which was the same
  // idea half-finished: a resolved name with no verdict attached, which left
  // every caller to invent the verdict.
  const agentDefault = getDefaultModel("agent");
  return ok({ defaults: getModelDefaults(), modelReadiness: resolveReadiness(agentDefault) });
});

export async function PUT(request: NextRequest) {
  const parsed = await parseAndValidateJsonBody(request, setDefaultPutSchema);
  if (parsed instanceof NextResponse) return parsed;

  try {
    // setDefaultPutSchema narrows parsed.taskType to TaskType, so no
    // cast is needed.
    const defaults = setDefaultModel(parsed.taskType, parsed.modelId);
    // Through finalize, not the bare sync: it refreshes agent_root.config_yaml
    // as well, so the next agent-root Push cannot reinstate a primary this
    // request just cleared from a stale copy of the file (T-0100, D9).
    const result = finalizeRootConfigOnDisk(
      parsed.modelId === null ? { cleared: [parsed.taskType] } : {},
    );
    appendAuditLine({
      action: "model.default.set",
      resource: `${parsed.taskType}=${parsed.modelId ?? "null"}`,
      ok: true,
    });
    recordEvent("model.configured", {
      entityType: "model",
      entityId: parsed.modelId ?? parsed.taskType,
      metadata: { taskType: parsed.taskType },
    });
    // 200, not a 500: the database change IS saved. A refused yaml write is
    // reported beside it rather than hidden behind a success (T-0095, D19).
    return ok({ defaults, error: result.error ?? null });
  } catch (error) {
    if (error instanceof Error && /Model not found/.test(error.message)) {
      return notFound(error.message);
    }
    return serverErrorFromCatch(
      "PUT /api/models/defaults",
      "setting default",
      error,
      "Failed to set default",
    );
  }
}
