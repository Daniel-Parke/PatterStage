// POST /api/game/synthesis — spend Cores on a gacha pull.
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { synthesisPull } from "@/lib/game/game-service";

export async function POST() {
  try {
    ensureDb();
    return ok(synthesisPull());
  } catch (error) {
    return serverErrorFromCatch("POST /api/game/synthesis", "", error, "Synthesis failed");
  }
}
