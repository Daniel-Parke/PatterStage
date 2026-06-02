// ═══════════════════════════════════════════════════════════════
// /api/memory/route.ts — Memory provider dispatcher
//
// Hindsight: dormant status (facts managed via agent tools)
// None: tell the user to run `hermes memory setup`
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

import { getMemoryProviderType } from "@/lib/memory-providers";
import { requireAuth } from "@/lib/api-auth";
import type { ApiResponse } from "@/types/hermes";
import type { MemoryReadResult } from "@/lib/memory-providers";

// ── Helpers ─────────────────────────────────────────────────

/**
 * Memory facts are managed by agent tools (hindsight_retain / recall /
 * reflect), not by the dashboard. Surface a single consistent 400 across
 * every write verb so the route's capability is self-documenting.
 */
const UNSUPPORTED_WRITE_RESPONSE = NextResponse.json(
  {
    error:
      "Memory management via the dashboard is not supported for the current provider. Use agent tools instead.",
  },
  { status: 400 },
);

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

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  return UNSUPPORTED_WRITE_RESPONSE;
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  return UNSUPPORTED_WRITE_RESPONSE;
}

export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  return UNSUPPORTED_WRITE_RESPONSE;
}