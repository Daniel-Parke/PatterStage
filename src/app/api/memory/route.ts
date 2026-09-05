// ═══════════════════════════════════════════════════════════════
// /api/memory/route.ts — Memory provider dispatcher
//
// Hindsight: dormant status (facts managed via agent tools)
// None: tell the user to run `hermes memory setup`
// ═══════════════════════════════════════════════════════════════

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getActiveMemoryConfig,
  getActiveMemoryProvider,
  getMemoryProviderType,
} from "@/lib/memory/memory-providers";

import { badRequest, ok } from "@/lib/api-response";
import type { MemoryReadResult } from "@/lib/memory/memory-providers";

// ── GET — Memory status ──────────────────────────────────────
// Resolves the provider the SAME way MemorySync + /api/monitor do — by probing
// the DB-owned active provider — instead of the old config.yaml regex parse,
// which returned "none" (provider unset / malformed YAML) while Hindsight was
// live with thousands of facts. That mismatch was the three-endpoint drift the
// QA report flagged; now all three agree.
export async function GET(_request: NextRequest) {
  // Holographic reports from its local DB; everything else probes the live
  // provider over HTTP (the registry defaults to Hindsight).
  if (getMemoryProviderType() === "holographic") {
    return ok<MemoryReadResult>({
      facts: [], total: 0, dbSize: 0, available: true, provider: "holographic",
      message: "Holographic memory is active.",
    });
  }

  try {
    // The provider the DB actually resolved, not a literal. This body used to
    // say "hindsight" whatever was active, so even a correct registry would
    // still have answered the wrong name on the wire (T-0077).
    const provider = getActiveMemoryProvider();
    const stats = await provider.stats();
    if (stats.available) {
      return ok<MemoryReadResult>({
        facts: [], total: stats.factCount, dbSize: 0, available: true, provider: provider.type,
        message:
          "Hindsight memory is active. Facts are managed through agent tools: " +
          "hindsight_retain (store), hindsight_recall (search), hindsight_reflect (reason).",
      });
    }
  } catch {
    /* unreachable — fall through to the not-configured response */
  }

  // Name the provider the DATABASE says is active, even when it cannot be
  // reached — the operator needs to know WHICH backend is unreachable before
  // they can do anything about it. Reporting a flat "none" for both "nothing is
  // configured" and "holographic is configured and we have no client for it"
  // collapses two different problems into one unhelpful word (T-0077).
  const active = getActiveMemoryConfig();
  return ok<MemoryReadResult>({
    facts: [], total: 0, dbSize: 0, available: false, provider: active.type,
    message:
      active.type === "none"
        ? "No memory provider configured or reachable. Run: hermes memory setup"
        : `The '${active.type}' memory provider is selected but not reachable at ` +
          `${active.config.host}:${active.config.port}. Check it on the Memory page.`,
  });
}

// Memory facts are managed by agent tools (hindsight_retain / recall /
// reflect), not by the dashboard. Every write verb (POST/PUT/DELETE) on
// this route is the same shape, so the handlers are one-line delegations to a
// single helper.
//
// It used to combine a read-only guard with the 400. The guard is gone: the
// proxy refuses unsafe methods under PS_READ_ONLY before any handler runs
// (T-0048). The parameter stays because Next passes one to every handler and
// callers, tests included, supply it.
function unsupportedWriteHandler(_request: NextRequest): NextResponse {
  return badRequest(
    "Memory management via the dashboard is not supported for the current provider. Use agent tools instead.",
  );
}

export const POST = unsupportedWriteHandler;
export const PUT = unsupportedWriteHandler;
export const DELETE = unsupportedWriteHandler;
