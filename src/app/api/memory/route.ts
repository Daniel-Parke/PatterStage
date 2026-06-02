// ═══════════════════════════════════════════════════════════════
// /api/memory/route.ts — Memory provider dispatcher
//
// Hindsight: dormant status (facts managed via agent tools)
// None: tell the user to run `hermes memory setup`
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { getMemoryProviderType } from "@/lib/memory-providers";
import { requireAuth } from "@/lib/api-auth";
import { badRequest } from "@/lib/api-response";
import type { ApiResponse } from "@/types/hermes";
import type { MemoryReadResult } from "@/lib/memory-providers";

// ── GET — Memory status ──────────────────────────────────────
// Hindsight: dormant status (facts managed via agent tools)
// None: tell the user to run `hermes memory setup`
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  const providerType = getMemoryProviderType();

  if (providerType === "none") {
    return NextResponse.json<ApiResponse<MemoryReadResult>>({
      data: {
        facts: [], total: 0, dbSize: 0, available: false, provider: "none",
        message: "No memory provider configured. Run: hermes memory setup",
      },
    });
  }

  // hindsight (or unexpected future provider) — dormant/read-only
  return NextResponse.json<ApiResponse<MemoryReadResult>>({
    data: {
      facts: [], total: 0, dbSize: 0,
      available: true, provider: "hindsight",
      message:
        "Hindsight memory is active. Facts are managed through agent tools: " +
        "hindsight_retain (store), hindsight_recall (search), hindsight_reflect (reason).",
    },
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
