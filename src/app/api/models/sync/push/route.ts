// ═══════════════════════════════════════════════════════════════
// /api/models/sync/push — push single model DB → Hermes config.yaml
// Pushes model to config.yaml primary section, and optionally
// pushes linked credential to .env if pushCredential is true.
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { parseAndValidateJsonBody } from "@/lib/parse-json-body";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { pushModelToHermes, pushCredential } from "@/modules/hermes/lib/sync-manager";
import { getModelWithKey } from "@/lib/models-repository";
import { ok } from "@/lib/api-response";
import { z } from "zod";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  // `modelId` is required; `pushCredential` defaults to `true` when
  // absent (matches the pre-refactor `!== false` semantics). The zod
  // `.min(1)` + string check makes the post-parse `if (!modelId)`
  // unreachable — a missing/empty `modelId` surfaces as a 400 from
  // `zodErrorResponse` with the same "modelId is required" text.
  const pushPostSchema = z
    .object({
      modelId: z.string().min(1, "modelId is required"),
      pushCredential: z.boolean().optional(),
    })
    .strict();

  const parsed = await parseAndValidateJsonBody(request, pushPostSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { modelId, pushCredential: pushCredRaw } = parsed;
  const pushCred = pushCredRaw !== false;

  try {
    const modelResult = pushModelToHermes(modelId);
    if (!modelResult.success) {
      return ok({ success: false, details: modelResult.details, backupPath: modelResult.backupPath });
    }

    const details = [...modelResult.details];

    // Push credential only if requested (user didn't exclude it)
    if (pushCred) {
      const model = getModelWithKey(modelId);
      if (model?.apiKey && model.credentialsId) {
        try {
          const credResult = pushCredential(model.credentialsId);
          if (credResult.success) {
            details.push({ action: "pushed", detail: credResult.details[0]?.detail });
          }
        } catch {
          // Best-effort — credential push failure is non-fatal
          details.push({ action: "warning", detail: "Credential push failed (non-fatal)" });
        }
      }
    }

    return ok({
      success: true,
      details,
      backupPath: modelResult.backupPath,
    });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/models/sync/push",
      `pushing model ${modelId}`,
      error,
      "Failed to push model",
    );
  }
}
