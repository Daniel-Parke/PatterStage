// ═══════════════════════════════════════════════════════════════
// /config/models — API row shapes used by the models page
// ═══════════════════════════════════════════════════════════════
//
// Shared types for the models page. TaskType lives in
// hermes-providers.ts as the single source of truth.

import type { ModelEditorRecord } from "./ModelEditor";
import type { TaskType } from "@/lib/hermes-providers";
import type { ApiStyle } from "@/lib/llm-endpoint";

export interface ApiModel {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  baseUrl: string | null;
  contextLength: number | null;
  credentialsId: string | null;
  /** Direct-provider wire protocol (openai | anthropic); null ⇒ inferred at call time. */
  apiStyle: ApiStyle | null;
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

/**
 * Project an `ApiModel` row down to the subset of fields the
 * `ModelEditor` form edits (omits `defaults`, `createdAt`, `updatedAt`).
 *
 * Centralised here so the table row and any future call site (e.g. a
 * context-menu "Edit" action, a bulk-edit, an admin row in another
 * page) stay in lockstep with the `ModelEditorRecord` shape. Adding a
 * new editable field is a one-line change in `ModelEditor.tsx` plus
 * one line here, instead of touching every call site.
 */
export function toModelEditorRecord(m: ApiModel): ModelEditorRecord {
  return {
    id: m.id,
    name: m.name,
    provider: m.provider,
    modelId: m.modelId,
    baseUrl: m.baseUrl,
    contextLength: m.contextLength,
    credentialsId: m.credentialsId,
  };
}
