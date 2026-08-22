// ═══════════════════════════════════════════════════════════════
// /api/memory/route.ts — Memory provider dispatcher
//
// Hindsight: dormant status (facts managed via agent tools)
// None: tell the user to run `hermes memory setup`
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { getActiveMemoryProvider, getMemoryProviderType } from "@/lib/memory/memory-providers";
import { requireAuth } from "@/lib/api-auth";
import { badRequest, ok } from "@/lib/api-response";
import type { MemoryReadResult } from "@/lib/memory/memory-providers";

// ── GET — Memory status ──────────────────────────────────────
// Resolves the provider the SAME way MemorySync + /api/monitor do — by probing
// the DB-owned active provider — instead of the old config.yaml regex parse,
// which returned "none" (provider unset / malformed YAML) while Hindsight was
// live with thousands of facts. That mismatch was the three-endpoint drift the
// QA report flagged; now all three agree.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  // Holographic reports from its local DB; everything else probes the live
  // provider over HTTP (the registry defaults to Hindsight).
  if (getMemoryProviderType() === "holographic") {
    return ok<MemoryReadResult>({
      facts: [], total: 0, dbSize: 0, available: true, provider: "holographic",
      message: "Holographic memory is active.",
    });
  }

  try {
    const stats = await getActiveMemoryProvider().stats();
    if (stats.available) {
      return ok<MemoryReadResult>({
        facts: [], total: stats.factCount, dbSize: 0, available: true, provider: "hindsight",
        message:
          "Hindsight memory is active. Facts are managed through agent tools: " +
          "hindsight_retain (store), hindsight_recall (search), hindsight_reflect (reason).",
      });
    }
  } catch {
    /* unreachable — fall through to the not-configured response */
  }

  return ok<MemoryReadResult>({
    facts: [], total: 0, dbSize: 0, available: false, provider: "none",
    message: "No memory provider configured or reachable. Run: hermes memory setup",
  });
}

// Memory facts are managed by agent tools (hindsight_retain / recall /
// reflect), not by the dashboard. Every write verb (POST/PUT/DELETE) on
// this route is the same shape, so the handlers are one-line delegations
// to a single helper that combines the auth check + the 400 response.
function unsupportedWriteHandler(request: NextRequest): NextResponse {
  const auth = requireAuth(request);
  if (auth) return auth;
  return badRequest(
    "Memory management via the dashboard is not supported for the current provider. Use agent tools instead.",
  );
}

export const POST = unsupportedWriteHandler;
export const PUT = unsupportedWriteHandler;
export const DELETE = unsupportedWriteHandler;
