// ═══════════════════════════════════════════════════════════════
// /api/models/sync/push — push single model DB → Hermes config.yaml
// Pushes model to config.yaml primary section, and optionally
// pushes linked credential to .env if pushCredential is true.
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { pushModelToHermes, pushCredential } from "@/lib/sync-manager";
import { getModelWithKey } from "@/lib/models-repository";
import { badRequest } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  const body = bodyResult;
  const modelId = body?.modelId as string | undefined;
  if (!modelId) {
    return badRequest("modelId is required");
  }

  const pushCred = (body.pushCredential as boolean | undefined) !== false;

  try {
    const modelResult = pushModelToHermes(modelId);
    if (!modelResult.success) {
      return NextResponse.json({
        data: { success: false, details: modelResult.details, backupPath: modelResult.backupPath },
      });
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

    return NextResponse.json({
      data: {
        success: true,
        details,
        backupPath: modelResult.backupPath,
      },
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
