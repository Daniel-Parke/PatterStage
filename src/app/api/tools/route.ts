// ═══════════════════════════════════════════════════════════════
// /api/tools — Hermes toolset catalog (read-only reference)
// ═══════════════════════════════════════════════════════════════
// Runtime tool access is configured per profile via platform_toolsets
// (Operations → Tools). This route does not control Hermes runtime.

import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { logApiError } from "@/lib/api-logger";
import {
  HERMES_CONFIGURABLE_TOOLSETS,
  HERMES_PLATFORMS,
} from "@/lib/hermes-toolset-catalog";

export async function GET() {
  try {
    return NextResponse.json({
      data: {
        platforms: HERMES_PLATFORMS,
        toolsets: HERMES_CONFIGURABLE_TOOLSETS,
      },
    });
  } catch (error) {
    logApiError("GET /api/tools", "catalog", error);
    return NextResponse.json({ error: "Failed to load toolset catalog" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  return NextResponse.json(
    {
      error:
        "Tool registry mutations are disabled. Configure Hermes runtime toolsets on Operations → Tools (profile-scoped platform_toolsets).",
    },
    { status: 410 }
  );
}
