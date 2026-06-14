// ═══════════════════════════════════════════════════════════════
// POST /api/runs/reconcile — reconcile active runs on demand
//
// The BackgroundScheduler reconciles runs every ~15s; this endpoint forces an
// immediate pass (useful for the UI "refresh" affordance and for end-to-end
// tests that don't want to wait a full tick). Idempotent and safe.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { reconcileActiveRuns } from "@/lib/orchestration";

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  try {
    const advanced = await reconcileActiveRuns();
    return ok({ advanced });
  } catch (error) {
    return serverErrorFromCatch("POST /api/runs/reconcile", "reconcile", error, "Failed to reconcile runs");
  }
}
