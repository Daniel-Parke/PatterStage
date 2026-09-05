import type { NextRequest } from "next/server";
// ═══════════════════════════════════════════════════════════════
// POST /api/runs/reconcile — reconcile active runs on demand
//
// The BackgroundScheduler reconciles runs every ~15s; this endpoint forces an
// immediate pass (useful for the UI "refresh" affordance and for end-to-end
// tests that don't want to wait a full tick). Idempotent and safe.
// ═══════════════════════════════════════════════════════════════

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { reconcileActiveRuns } from "@/lib/orchestration";

export async function POST(_request: NextRequest) {
  try {
    const advanced = await reconcileActiveRuns();
    return ok({ advanced });
  } catch (error) {
    return serverErrorFromCatch("POST /api/runs/reconcile", "reconcile", error, "Failed to reconcile runs");
  }
}
