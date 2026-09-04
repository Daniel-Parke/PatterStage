// ═══════════════════════════════════════════════════════════════
// mission-body.ts — Parses mission action bodies (dispatch/promote/update).
//
// Extracted from src/app/api/missions/route.ts so it can be unit-tested
// in isolation. The single behavior difference from the previous inline
// implementation is the registry check on `modelId` — see below.
// ═══════════════════════════════════════════════════════════════

import { parseTimeoutMinutes } from "@/lib/missions/mission-timeout";
import { findModelByModelId } from "../models-repository";

/** Shared fields destructured from mission action body (dispatch/promote/update). */
export interface MissionBodyFields {
  name?: string;
  instruction?: string;
  context?: string;
  localDirs?: unknown;
  references?: string[];
  skills?: string[];
  suggestedToolsets?: string[];
  goals?: string[];
  modelId?: string;
  provider?: string;
  profileName?: string;
  missionTimeMinutes?: number;
  timeoutMinutes?: number;
  schedule?: string;
  categoryId?: string | null;
  outputFormat?: string;
  constraints?: string;
}

/**
 * Parse a mission action body into a typed shape.
 *
 * `modelId` is validated against the PatterStage models registry. The
 * registry is the SINGLE SOURCE OF TRUTH for which model any mission can
 * run on — no caller-supplied value (including one that pairs `modelId`
 * with a `provider`) is permitted to reach the dispatch path unless it
 * exists in the `models` table. A foreign modelId is silently dropped;
 * the dispatch layer will then fall through to `getDefaultModel("agent")`.
 *
 * `provider` is intentionally NOT validated here — the provider is derived
 * from the registry row at dispatch time, never trusted from the request
 * body. We strip the supplied `provider` whenever the modelId is also
 * foreign, to keep `missions.provider` consistent with the (now-empty)
 * `missions.model_id`.
 */
/** A list of non-empty strings from an untrusted value, or undefined. */
function stringListOrUndefined(value: unknown): string[] | undefined {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/** A timeout the reconciler can trust, or nothing. The 400 lives at the route. */
function timeoutOrUndefined(value: unknown): number | undefined {
  const parsed = parseTimeoutMinutes(value);
  return parsed === "invalid" ? undefined : parsed;
}

export function parseMissionBodyFields(
  body: Record<string, unknown>,
): MissionBodyFields {
  const rawModelId = body.modelId as string | undefined;
  const trimmedModelId = rawModelId?.trim() ?? "";

  let resolvedModelId: string | undefined;
  if (trimmedModelId) {
    const row = findModelByModelId(trimmedModelId);
    if (row) {
      resolvedModelId = row.modelId;
    }
    // else: foreign modelId — drop it (provider stripped below)
  }

  return {
    name: body.name as string | undefined,
    instruction: body.instruction as string | undefined,
    context: body.context as string | undefined,
    localDirs: body.localDirs,
    // The four list fields crashed formatList when a string arrived (T-0088).
    references: stringListOrUndefined(body.references),
    skills: stringListOrUndefined(body.skills),
    suggestedToolsets: stringListOrUndefined(body.suggestedToolsets),
    goals: stringListOrUndefined(body.goals),
    modelId: resolvedModelId,
    provider: resolvedModelId ? (body.provider as string | undefined) : undefined,
    profileName: body.profileName as string | undefined,
    missionTimeMinutes: timeoutOrUndefined(body.missionTimeMinutes),
    timeoutMinutes: timeoutOrUndefined(body.timeoutMinutes),
    schedule: body.schedule as string | undefined,
    categoryId: body.categoryId as string | null | undefined,
    outputFormat: body.outputFormat as string | undefined,
    constraints: body.constraints as string | undefined,
  };
}
