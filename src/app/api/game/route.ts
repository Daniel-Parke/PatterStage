// GET /api/game — full gamification snapshot (reconciles awards on read).
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { ensureDb } from "@/lib/db";
import { loadGameSnapshot } from "@/lib/game/game-service";

export async function GET() {
  try {
    ensureDb();
    return ok(loadGameSnapshot());
  } catch (error) {
    return serverErrorFromCatch("GET /api/game", "", error, "Failed to load game state");
  }
}
