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
  return NextResponse.json(
    { error: "Memory management via the dashboard is not supported for the current provider. Use agent tools instead." },
    { status: 400 }
  );
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  return NextResponse.json(
    { error: "Memory management via the dashboard is not supported for the current provider. Use agent tools instead." },
    { status: 400 }
  );
}

export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;
  return NextResponse.json(
    { error: "Memory management via the dashboard is not supported for the current provider. Use agent tools instead." },
    { status: 400 }
  );
}