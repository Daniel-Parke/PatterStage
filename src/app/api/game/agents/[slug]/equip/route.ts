// POST /api/game/agents/[slug]/equip — equip (or clear) an agent cosmetic.
import { NextRequest } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { equipAgentCosmetic } from "@/lib/game/game-service";
import type { CosmeticType } from "@/lib/game/types";

interface Ctx {
  params: Promise<{ slug: string }>;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  try {
    ensureDb();
    const body = (await request.json().catch(() => ({}))) as { type?: string; itemId?: string };
    return ok(equipAgentCosmetic(slug, (body.type ?? "") as CosmeticType, String(body.itemId ?? "")));
  } catch (error) {
    return serverErrorFromCatch("POST /api/game/agents/[slug]/equip", `slug=${slug}`, error, "Equip failed");
  }
}
