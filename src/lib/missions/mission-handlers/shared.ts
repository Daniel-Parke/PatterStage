// ═══════════════════════════════════════════════════════════════
// mission-handlers/shared.ts — shared id/category resolution helpers
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the /api/missions route god-file. The per-action POST
// handlers (dispatch/promote/update/cancel/delete) and the GET handler
// share these "resolve a mission/category from the request body, or
// return the right 4xx NextResponse" helpers. Each returns either the
// resolved value or a NextResponse the caller short-circuits on:
//
//   const mission = requireMissionOrNotFound(body);
//   if (mission instanceof NextResponse) return mission;

import { NextResponse } from "next/server";

import { getMission } from "@/lib/missions/mission-repository";
import { getCategory } from "@/lib/missions/mission-category-repository";
import { badRequest, notFound } from "@/lib/api-response";

function resolveMissionId(body: Record<string, unknown>): string | undefined {
  return (body.id ?? body.missionId) as string | undefined;
}

/**
 * Resolve a mission id from the request body and return a 400 NextResponse
 * if it is missing. Callers check `if (missionId instanceof NextResponse) return missionId;`.
 */
export function requireMissionId(body: Record<string, unknown>): string | NextResponse {
  const id = resolveMissionId(body);
  if (!id) {
    return badRequest("Mission id is required");
  }
  return id;
}

/**
 * Look up a mission by id and return a 404 NextResponse if it is missing.
 */
export function getMissionOrNotFound(
  id: string,
): NonNullable<ReturnType<typeof getMission>> | NextResponse {
  const mission = getMission(id);
  if (!mission) {
    return notFound("Mission not found");
  }
  return mission;
}

/**
 * Look up a mission by id from a request body, returning either the
 * `Mission` record or a `NextResponse` (400 if id missing, 404 if not
 * found). The 2-step (`requireMissionId` + `getMissionOrNotFound`) form.
 */
export function requireMissionOrNotFound(
  body: Record<string, unknown>,
): NonNullable<ReturnType<typeof getMission>> | NextResponse {
  const id = requireMissionId(body);
  if (id instanceof NextResponse) return id;
  return getMissionOrNotFound(id);
}

function parseCategoryId(
  raw: unknown,
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") {
    return { ok: false, error: "categoryId must be a string" };
  }
  if (!getCategory(raw)) {
    return { ok: false, error: "Category not found" };
  }
  return { ok: true, value: raw };
}

/**
 * Resolve the categoryId field from a request body, returning either the
 * validated id (`string | null | undefined`) or a 400 NextResponse on
 * failure.
 */
export function parseCategoryIdOrError(
  raw: unknown,
): string | null | undefined | NextResponse {
  const result = parseCategoryId(raw);
  if (!result.ok) {
    return badRequest(result.error);
  }
  return result.value;
}
