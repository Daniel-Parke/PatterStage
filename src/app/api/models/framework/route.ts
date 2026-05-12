// ═══════════════════════════════════════════════════════════════
// /api/models/framework — persist active framework preference
//
// GET  — returns the currently active framework ID
// PUT  — sets the active framework (persists to disk)
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { listFrameworks } from "@/lib/framework-registry";
import { getActiveFrameworkId, setActiveFrameworkId } from "@/lib/framework-registry.server";
import { logApiError } from "@/lib/api-logger";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";

export async function GET() {
  try {
    return NextResponse.json({ data: { active: getActiveFrameworkId() } });
  } catch (error) {
    logApiError("GET /api/models/framework", "reading active framework", error);
    return NextResponse.json({ error: "Failed to read framework" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

  const framework = (raw as Record<string, unknown>)?.framework as string;
  if (!framework) {
    return NextResponse.json({ error: "framework is required" }, { status: 400 });
  }

  const valid = listFrameworks().map(f => f.id);
  if (!valid.includes(framework) && framework !== "*") {
    return NextResponse.json({ error: `Invalid framework. Must be one of: ${valid.join(", ")}` }, { status: 400 });
  }

  try {
    setActiveFrameworkId(framework);
    return NextResponse.json({ data: { active: framework } });
  } catch (error) {
    logApiError("PUT /api/models/framework", `setting framework to ${framework}`, error);
    return NextResponse.json({ error: "Failed to set framework" }, { status: 500 });
  }
}
