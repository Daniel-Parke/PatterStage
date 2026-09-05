// ═══════════════════════════════════════════════════════════════
// /config/models — API row shapes used by the models page
// ═══════════════════════════════════════════════════════════════
//
// Shared types for the models page. TaskType lives in
// models/task-types.ts as the single source of truth.

import type { ModelEditorRecord } from "./ModelEditor";
import type { TaskType } from "@/lib/models/task-types";
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

/**
 * One drift sentence, with the handles needed to act on it.
 *
 * The banner used to offer a single "Sync Now" that ran a whole re-import,
 * whichever way the drift actually pointed. A line says which side is ahead,
 * so the banner can offer the one direction that resolves it (T-0100).
 *
 *  - `primary`      the agent default and config.yaml's primary disagree;
 *                   `registryId` is the registry row matching the Hermes
 *                   primary, or null when no row matches it
 *  - `hermes-only`  config.yaml has a model the registry does not; pull adds it
 *  - `db-only`      the registry has a model config.yaml does not
 */
export interface DriftLine {
  kind: "primary" | "hermes-only" | "db-only";
  /** The sentence, identical to the matching `driftDetails` entry. */
  text: string;
  provider: string;
  modelId: string;
  /** The registry row this line is about, when there is one. */
  registryId: string | null;
}

/**
 * A stable key for one line, so a busy flag can name the row it belongs to.
 * Lines are not persisted and carry no id of their own; kind plus the model
 * reference is unique within one report.
 */
export function driftLineKey(line: DriftLine): string {
  return `${line.kind}:${line.provider}/${line.modelId}`;
}

export interface SyncDrift {
  hasDrift: boolean;
  driftDetails: string[];
  /** Optional so a body cached before T-0100 still renders as plain sentences. */
  lines?: DriftLine[];
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
