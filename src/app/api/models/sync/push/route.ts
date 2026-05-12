// ═══════════════════════════════════════════════════════════════
// /api/models/sync/push — push single model DB → Hermes config.yaml
// Pushes model to config.yaml primary section, and optionally
// pushes linked credential to .env if pushCredential is true.
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { pushModelToHermes, pushCredential } from "@/lib/sync-manager";
import { getModelWithKey } from "@/lib/models-repository";

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

  const body = raw as Record<string, unknown>;
  const modelId = body?.modelId as string | undefined;
  if (!modelId) {
    return NextResponse.json({ error: "modelId is required" }, { status: 400 });
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
    logApiError("POST /api/models/sync/push", `pushing model ${modelId}`, error);
    return NextResponse.json({ error: "Failed to push model" }, { status: 500 });
  }
}
