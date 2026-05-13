import { NextResponse } from "next/server";
import { getHermesEntry } from "@/lib/agent-registry";
import { logApiError } from "@/lib/api-logger";

/** Returns the single local Hermes agent entry for dashboard display. */
export async function GET() {
  try {
    const entry = getHermesEntry();
    return NextResponse.json({
      data: {
        id: entry.id,
        label: entry.label,
        filesystemRoot: entry.filesystemRoot,
        gatewayBaseUrl: entry.gatewayBaseUrl ?? null,
        llmBaseUrl: entry.llmBaseUrl ?? null,
      },
    });
  } catch (error) {
    logApiError("GET /api/agent/targets", "read hermes entry", error);
    return NextResponse.json({ error: "Failed to read Hermes agent info" }, { status: 500 });
  }
}
