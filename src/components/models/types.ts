// ═══════════════════════════════════════════════════════════════
// /config/models — API row shapes used by the models page
// ═══════════════════════════════════════════════════════════════
//
// Shared types for the models page. TaskType lives in
// hermes-providers.ts as the single source of truth.

import type { TaskType } from "@/lib/hermes-providers";

export interface ApiModel {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  baseUrl: string | null;
  contextLength: number | null;
  credentialsId: string | null;
  defaults: Record<TaskType, string | null>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiCredential {
  id: string;
  label: string;
  provider: string;
  keyHint: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncDrift {
  hasDrift: boolean;
  driftDetails: string[];
}
