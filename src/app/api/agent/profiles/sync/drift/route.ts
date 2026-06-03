import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ensureDb } from "@/lib/db";
import { detectFullDrift } from "@/lib/hermes-profile-sync";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  try {
    ensureDb();
    const drift = detectFullDrift();
    return NextResponse.json({ data: drift });
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
