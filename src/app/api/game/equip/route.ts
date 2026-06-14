// POST /api/game/equip — equip (or clear) an operator cosmetic.
import { NextRequest } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { equipCosmetic } from "@/lib/game/game-service";
import type { CosmeticType } from "@/lib/game/types";

export async function POST(request: NextRequest) {
  try {
    ensureDb();
    const body = (await request.json().catch(() => ({}))) as { type?: string; itemId?: string };
    return ok(equipCosmetic((body.type ?? "") as CosmeticType, String(body.itemId ?? "")));
  } catch (error) {
    return serverErrorFromCatch("POST /api/game/equip", "", error, "Equip failed");
  }
}
