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
import { handleCancelMission } from "@/lib/missions/mission-handlers/cancel";
import { route } from "@/lib/api/api-route";

interface Ctx {
  params: Promise<{ id: string }>;
}

export const POST = route("POST /api/missions/[id]/cancel", (p) => `id=${p.id}`, "Failed to cancel mission", async (_request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  return handleCancelMission({ id });
});
