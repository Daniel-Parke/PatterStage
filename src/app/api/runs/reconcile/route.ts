import type { NextRequest } from "next/server";
// ═══════════════════════════════════════════════════════════════
// POST /api/runs/reconcile — reconcile active runs on demand
//
// The BackgroundScheduler reconciles runs every ~15s; this endpoint forces an
// immediate pass (useful for the UI "refresh" affordance and for end-to-end
// tests that don't want to wait a full tick). Idempotent and safe.
// ═══════════════════════════════════════════════════════════════

import { ok } from "@/lib/api/api-response";
import { reconcileActiveRuns } from "@/lib/orchestration";
import { route } from "@/lib/api/api-route";

export const POST = route("POST /api/runs/reconcile", "reconcile", "Failed to reconcile runs", async (_request: NextRequest) => {
  const advanced = await reconcileActiveRuns();
  return ok({ advanced });
});
