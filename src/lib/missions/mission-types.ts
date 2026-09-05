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

export interface Mission {
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
  /** ID of the linked cron job (legacy recurring path; superseded by schedules). */
  cronJobId?: string;
  categoryId?: string | null;
  outputFormat?: string;
  constraints?: string;
  /** True when dispatchMode=queue and waiting for the queue worker; false for save drafts. */
  queuedForRun?: boolean;
}
