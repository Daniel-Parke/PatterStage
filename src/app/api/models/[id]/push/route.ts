// ═══════════════════════════════════════════════════════════════
// /api/models/[id]/push — push single model DB → Hermes config.yaml
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import { pushModelToHermes } from "@/lib/sync-manager";

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
    return NextResponse.json({
      data: {
        success: result.success,
        details: result.details,
        backupPath: result.backupPath,
      },
    });
  } catch (error) {
    logApiError("POST /api/models/[id]/push", `pushing model ${id}`, error);
    return NextResponse.json({ error: "Failed to push model" }, { status: 500 });
  }
}