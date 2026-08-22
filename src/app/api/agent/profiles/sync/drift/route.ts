import { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";

import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ensureDb } from "@/lib/db";
import { detectFullDrift } from "@/modules/hermes/lib/profile-drift";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    ensureDb();
    const drift = detectFullDrift();
    return ok(drift);
  }
  catch (error) {
    return serverErrorFromCatch(
      "GET /api/agent/profiles/sync/drift",
      "detecting drift",
      error,
      "Failed to detect drift",
    );
  }
}
