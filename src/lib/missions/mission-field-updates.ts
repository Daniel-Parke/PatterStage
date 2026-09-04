// ═══════════════════════════════════════════════════════════════
// mission-field-updates.ts — shared prompt/field merge for update & promote
// ═══════════════════════════════════════════════════════════════

import { normaliseMissionName } from "@/lib/missions/mission-name";
import { buildMissionPrompt, parseMissionPrompt } from "@/lib/missions/build-mission-prompt";
import { normalizeLocalDirsInput } from "@/lib/fs/local-dir-entry";
import type { LocalDirEntry } from "@/types/console";
import type { Mission } from "@/lib/missions/mission-types";
import type { MissionStatus } from "@/lib/missions/mission-types";

export interface MissionFieldPatchInput {
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
  status?: string;
  result?: string;
  queuedForRun?: boolean;
}

export interface MissionFieldPatchResult {
  shouldRebuildPrompt: boolean;
  prompt?: string;
  updates: {
    status?: MissionStatus;
    result?: string;
    prompt?: string;
    name?: string;
    localDirs?: LocalDirEntry[];
    references?: string[];
    skills?: string[];
    suggestedToolsets?: string[];
    goals?: string[];
    modelId?: string | null;
    provider?: string | null;
    profileName?: string | null;
    missionTimeMinutes?: number | null;
    timeoutMinutes?: number | null;
    schedule?: string | null;
    categoryId?: string | null;
    outputFormat?: string | null;
    constraints?: string | null;
    queuedForRun?: boolean;
  };
}

export function buildMissionFieldPatch(
  existing: Mission,
  input: MissionFieldPatchInput,
  categoryIdResolved: string | null | undefined,
): MissionFieldPatchResult {
  const shouldRebuildPrompt =
    input.instruction !== undefined ||
    input.context !== undefined ||
    input.localDirs !== undefined ||
    input.references !== undefined ||
    input.skills !== undefined ||
    input.suggestedToolsets !== undefined ||
    input.goals !== undefined ||
    input.missionTimeMinutes !== undefined ||
    input.timeoutMinutes !== undefined ||
    input.outputFormat !== undefined ||
    input.constraints !== undefined;

  let prompt: string | undefined;
  if (shouldRebuildPrompt) {
    const parsed = parseMissionPrompt(existing.prompt);
    prompt = buildMissionPrompt({
      instruction:
        input.instruction !== undefined ? input.instruction.trim() : parsed.instruction,
      context: input.context !== undefined ? input.context : parsed.context,
      localDirs:
        input.localDirs !== undefined
          ? normalizeLocalDirsInput(input.localDirs)
          : existing.localDirs,
      references: input.references !== undefined ? input.references : existing.references,
      skills: input.skills !== undefined ? input.skills : existing.skills,
      toolsets:
        input.suggestedToolsets !== undefined
          ? input.suggestedToolsets
          : existing.suggestedToolsets,
      goals: input.goals !== undefined ? input.goals : existing.goals,
      missionTimeMinutes:
        input.missionTimeMinutes !== undefined
          ? input.missionTimeMinutes
          : existing.missionTimeMinutes,
      timeoutMinutes:
        input.timeoutMinutes !== undefined
          ? input.timeoutMinutes
          : existing.timeoutMinutes,
      outputFormat:
        input.outputFormat !== undefined
          ? input.outputFormat
          : existing.outputFormat ?? parsed.outputFormat,
      constraints:
        input.constraints !== undefined
          ? input.constraints
          : existing.constraints ?? parsed.constraints,
    });
  }

  const updates: MissionFieldPatchResult["updates"] = {};
  if (input.status) updates.status = input.status as MissionStatus;
  if (input.result !== undefined) updates.result = input.result;
  if (prompt !== undefined) updates.prompt = prompt;
  if (input.name !== undefined) updates.name = normaliseMissionName(input.name) ?? existing.name;
  if (input.outputFormat !== undefined) {
    updates.outputFormat = input.outputFormat.trim() || null;
  }
  if (input.constraints !== undefined) {
    updates.constraints = input.constraints.trim() || null;
  }
  if (input.localDirs !== undefined) {
    updates.localDirs = normalizeLocalDirsInput(input.localDirs);
  }
  if (input.references !== undefined) updates.references = input.references;
  if (input.skills !== undefined) updates.skills = input.skills;
  if (input.suggestedToolsets !== undefined) {
    updates.suggestedToolsets = input.suggestedToolsets;
  }
  if (input.goals !== undefined) updates.goals = input.goals;
  if (input.modelId !== undefined) updates.modelId = input.modelId;
  if (input.provider !== undefined) updates.provider = input.provider;
  if (input.profileName !== undefined) updates.profileName = input.profileName;
  if (input.missionTimeMinutes !== undefined) {
    updates.missionTimeMinutes = input.missionTimeMinutes;
  }
  if (input.timeoutMinutes !== undefined) updates.timeoutMinutes = input.timeoutMinutes;
  if (input.schedule !== undefined) updates.schedule = input.schedule;
  if (categoryIdResolved !== undefined) updates.categoryId = categoryIdResolved;
  if (input.queuedForRun !== undefined) updates.queuedForRun = input.queuedForRun;

  return { shouldRebuildPrompt, prompt, updates };
}
