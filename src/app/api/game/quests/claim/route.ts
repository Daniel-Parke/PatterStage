// POST /api/game/quests/claim — claim a completed quest's reward.
import { NextRequest } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { claimQuestReward } from "@/lib/game/game-service";

export async function POST(request: NextRequest) {
  try {
    ensureDb();
    const body = (await request.json().catch(() => ({}))) as { questId?: string };
    return ok(claimQuestReward(String(body.questId ?? "")));
  } catch (error) {
    return serverErrorFromCatch("POST /api/game/quests/claim", "", error, "Claim failed");
  }
}
