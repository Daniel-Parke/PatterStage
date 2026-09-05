// ═══════════════════════════════════════════════════════════════
// POST /api/missions/[id]/cancel — cancel a mission, REST-shaped
//
// The same body as POST /api/missions { action: "cancel" }, under the URL a
// REST client expects. It used to be a second implementation
// (`cancelMissionRun`) that stopped the backend FIRST and answered a different
// envelope, so the same click took two orders and two shapes depending on
// which door it came through (T-0095, D128). Now there is one: the local
// record is written synchronously, the backend stop runs in the background,
// and the answer is `{ mission, cancel }` either way.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { requireNotReadOnly } from "@/lib/api-auth";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { handleCancelMission } from "@/lib/missions/mission-handlers/cancel";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, ctx: Ctx) {
  // Read-only mode. NOT authentication: src/proxy.ts authenticates every
  // request before a handler runs, and design-lint forbids a per-route auth
  // check. The proxy also refuses unsafe METHODS under PS_READ_ONLY, so this
  // is defence in depth on a write, spelled with the name that says what it
  // does (T-0034).
  const readOnly = requireNotReadOnly("mission runs cannot be cancelled");
  if (readOnly) return readOnly;

  const { id } = await ctx.params;
  try {
    return handleCancelMission({ id });
  } catch (error) {
    return serverErrorFromCatch(
      "POST /api/missions/[id]/cancel",
      `id=${id}`,
      error,
      "Failed to cancel mission",
    );
  }
}
