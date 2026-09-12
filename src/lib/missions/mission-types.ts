// ═══════════════════════════════════════════════════════════════
// mission-types.ts — shared mission + agent domain types
//
// Relocated from the deleted agent-backend/ folder (which was shaped around
// the old bash dispatch backend). These are framework-agnostic domain types
// used across the mission repository, API, and orchestration layers.
// ═══════════════════════════════════════════════════════════════

import type { LocalDirEntry } from "@/types/console";

// ── Mission ────────────────────────────────────────────────────
//
// Status enum is canonical from the V1 mission JSON schema (four states).

export type MissionStatus = "queued" | "dispatched" | "successful" | "failed";

/**
 * The fields a mission draft carries beyond its name and prompt: what it
 * may read, what it may use, which model and profile answer, how long it
 * has, and when it runs. Spelled once here (C2, T-0137); a Mission, the
 * body a route reads, the patch a field update takes, the input a promote
 * takes and the row the repository creates all extend it, where they used
 * to each spell the ten lines.
 */
export interface MissionDraftFields {
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

export interface Mission extends MissionDraftFields {
  id: string;
  name: string;
  prompt: string;
  profileId?: string;
  status: MissionStatus;
  result?: string;
  error?: string;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
  localDirs?: LocalDirEntry[];
  /** ID of the linked cron job (legacy recurring path; superseded by schedules). */
  cronJobId?: string;
  /** True when dispatchMode=queue and waiting for the queue worker; false for save drafts. */
  queuedForRun?: boolean;
}
