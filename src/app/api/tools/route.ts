// ═══════════════════════════════════════════════════════════════
// /api/tools — Hermes toolset catalog (read-only reference)
// ═══════════════════════════════════════════════════════════════
// Runtime tool access is configured per profile via platform_toolsets
// (Operations → Tools). This route does not control Hermes runtime.

import { NextRequest } from "next/server";

import { requireAuth, requireNotReadOnly } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { methodNotAllowed, ok } from "@/lib/api-response";
import {
  HERMES_CONFIGURABLE_TOOLSETS,
  HERMES_PLATFORMS,
} from "@/lib/hermes-toolset-catalog";

export async function GET() {
  try {
    return ok({
      platforms: HERMES_PLATFORMS,
      toolsets: HERMES_CONFIGURABLE_TOOLSETS,
    });
  } catch (error) {
    return serverErrorFromCatch(
      "GET /api/tools",
      "catalog",
      error,
      "Failed to load toolset catalog",
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  const ro = requireNotReadOnly("tool mutations are disabled");
  if (ro) return ro;

  return methodNotAllowed(
    "Tool registry mutations are disabled. Configure Hermes runtime toolsets on Operations → Tools (profile-scoped platform_toolsets).",
  );
}
