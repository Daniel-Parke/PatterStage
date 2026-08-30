import type { NextRequest } from "next/server";

import { ok } from "@/lib/api-response";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ensureDb } from "@/lib/db";
import { detectFullDrift } from "@/modules/hermes/lib/profile-drift";

export async function GET(_request: NextRequest) {
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
