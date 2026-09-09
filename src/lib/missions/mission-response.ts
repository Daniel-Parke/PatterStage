// ═══════════════════════════════════════════════════════════════
// mission-response — Tiny `NextResponse` helper for the mission endpoints
// ═══════════════════════════════════════════════════════════════
//
// The success body of every single-mission mutation in `/api/missions` and
// `mission-promote-handler.ts`. The inline form's `getMission(id)!` was the
// dangerous part: a delete between the mutation and the response produces
// `undefined`, the `!` lies to the type checker and the body becomes
// `{ mission: undefined }`, which the client treats as a valid mission. The
// check lives here so a call site cannot skip it.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { getMission } from "@/lib/missions/mission-repository";
import type { Mission } from "@/lib/missions/mission-types";

/**
 * Return a `NextResponse` carrying the enriched mission row under
 * `{ data: { mission: ... } }`. Use this as the success body for any
 * `POST /api/missions` action that returns a single mission record.
 *
 * @param missionId The mission id to look up. Caller is responsible for
 *   ensuring the mission exists (e.g. from a prior `createMission` or
 *   `updateMission` call that returned non-null).
 * @param status HTTP status code. Defaults to 200; pass 201 for create-style
 *   responses (the cron-dispatch success body).
 */
export function missionResponse(
  missionId: string,
  status: number = 200,
): NextResponse {
  const mission = getMission(missionId);
  if (!mission) {
    // Deleted between the mutation and the response: a 404 rather than
    // `{ mission: undefined }` in a 200 body, which the client cannot tell
    // from a valid mission.
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }
  return NextResponse.json({ data: { mission } }, { status });
}

/**
 * Look up an enriched mission row by id. Returns `undefined` if the mission
 * was deleted. Use this from lib helpers (e.g. `mission-promote-handler.ts`)
 * that build their own response shape and don't want the `NextResponse` body
 * that `missionResponse()` produces.
 */
export function enrichedMission(missionId: string): Mission | undefined {
  return getMission(missionId) ?? undefined;
}
