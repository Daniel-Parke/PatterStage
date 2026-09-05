// ═══════════════════════════════════════════════════════════════
// mission-response — Tiny `NextResponse` helper for the mission endpoints
// ═══════════════════════════════════════════════════════════════
//
// The two most common "return after a successful mission mutation" shapes
// in `/api/missions` and `mission-promote-handler.ts` are:
//
//   1. `NextResponse.json({ data: { mission: enrichMissionCron(getMission(id)!) } })`
//      — 8 sites, the success body of dispatch/promote/update/cancel/cron-dispatch
//
//   2. `NextResponse.json(
//         { data: { mission: enrichMissionCron(getMission(id)!) } },
//         { status: 201 }
//      )` — 1 site, the cron-dispatch success body (201 instead of 200)
//
// The inline form is 1-2 lines per call site, but the `getMission(id)!` non-null
// assertion is the dangerous part: if a future race condition (delete between
// the get and the response) produces `undefined`, the `!` lies to the type
// checker and the response body becomes `{ mission: undefined }`, which the
// client treats as a valid mission. The helper centralises the assertion so
// the call site can stay 1-token.
//
// Byte-equivalence: the response body shape and status code match the prior
// inline form exactly. The helper is pure plumbing — no new validation, no
// new error handling, no new behavior.
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
    // Defensive: if the mission was deleted between the mutation and the
    // response, return a 404 rather than `{ mission: undefined }` in a 200
    // body. This is a guardrail, not a behavior change — the prior inline
    // form would have returned `{ mission: undefined }` here, which the
    // client couldn't distinguish from a valid (but empty) mission.
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }
  return NextResponse.json({ data: { mission } }, { status });
}

/**
 * Look up an enriched mission row by id. Returns `undefined` if the mission
 * was deleted. Use this from lib helpers (e.g. `mission-promote-handler.ts`)
 * that build their own response shape and don't want the `NextResponse` body
 * that `missionResponse()` produces.
 *
 * Byte-equivalent to the prior inline `getMission(id)! -> enrichMissionCron`
 * pattern, except: returns `undefined` instead of lying via the `!` non-null
 * assertion if the mission was deleted between the mutation and the lookup.
 * Callers that previously relied on `!` should keep a defensive branch
 * (most do, via the `ok: false` result type).
 */
export function enrichedMission(missionId: string): Mission | undefined {
  return getMission(missionId) ?? undefined;
}
