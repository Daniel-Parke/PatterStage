// ═══════════════════════════════════════════════════════════════
// /api/models/[id]/push — push single model DB → Hermes config.yaml
// Pushes model to config.yaml primary section, then pushes linked
// credential to .env if the model has credentialsId set.
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { pushModelToHermes, pushCredential } from "@/lib/sync-manager";
import { getModelWithKey } from "@/lib/models-repository";

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
    const result = pushModelToHermes(id);
    if (!result.success) {
      return NextResponse.json({
        data: { success: false, details: result.details, backupPath: result.backupPath },
      });
    }

    // Also push the linked credential if the model has one
    const model = getModelWithKey(id);
    let credentialResult: { pushed: boolean; detail?: string } = { pushed: false };
    if (model?.apiKey && model.credentialsId) {
      try {
        const credResult = pushCredential(model.credentialsId);
        credentialResult = {
          pushed: credResult.success,
          detail: credResult.details[0]?.detail,
        };
      } catch {
        // Best-effort — credential push failure is non-fatal
        credentialResult = { pushed: false, detail: "Credential push failed (non-fatal)" };
      }
    }

    // Merge details
    const details = [
      ...result.details,
      ...(credentialResult.pushed ? [{ action: "pushed", detail: credentialResult.detail }] : []),
    ];

    return NextResponse.json({
      data: {
        success: true,
        details,
        backupPath: result.backupPath,
      },
    });
  } catch (error) {
    logApiError("POST /api/models/[id]/push", `pushing model ${id}`, error);
    return NextResponse.json({ error: "Failed to push model" }, { status: 500 });
  }
}
