// ═══════════════════════════════════════════════════════════════
// mission-body.ts — Parses mission action bodies (dispatch/promote/update).
//
// Extracted from src/app/api/missions/route.ts so it can be unit-tested
// in isolation. The single behavior difference from the previous inline
// implementation is the registry check on `modelId` — see below.
// ═══════════════════════════════════════════════════════════════

import { findModelByModelId } from "./models-repository";

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
    references: body.references as string[] | undefined,
    skills: body.skills as string[] | undefined,
    suggestedToolsets: body.suggestedToolsets as string[] | undefined,
    goals: body.goals as string[] | undefined,
    modelId: resolvedModelId,
    provider: resolvedModelId ? (body.provider as string | undefined) : undefined,
    profileName: body.profileName as string | undefined,
    missionTimeMinutes: body.missionTimeMinutes as number | undefined,
    timeoutMinutes: body.timeoutMinutes as number | undefined,
    schedule: body.schedule as string | undefined,
    categoryId: body.categoryId as string | null | undefined,
    outputFormat: body.outputFormat as string | undefined,
    constraints: body.constraints as string | undefined,
  };
}
