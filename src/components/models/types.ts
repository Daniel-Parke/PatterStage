// ═══════════════════════════════════════════════════════════════
// /config/models — API row shapes used by the models page. TaskType lives in
// models/task-types.ts.
// ═══════════════════════════════════════════════════════════════

import type { ModelEditorRecord } from "./ModelEditor";

// The row is the library's (C2, T-0137); this file keeps the name its importers use.
import type { ApiModel } from "@/lib/models/model-types";
export type { ApiModel };

export interface ApiCredential {
  id: string;
  label: string;
  provider: string;
  keyHint: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * One drift sentence with the handles to act on it. The banner used to offer a
 * single "Sync Now" that re-imported everything whichever way the drift
 * pointed; a line says which side is ahead so the banner offers the one
 * direction that resolves it (T-0100). `primary`: the agent default and
 * config.yaml's primary disagree, `registryId` the row matching the Hermes
 * primary or null; `hermes-only`: config.yaml has a model the registry lacks,
 * pull adds it; `db-only`: the registry has one config.yaml lacks.
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

/** A stable key for one line (lines carry no id): kind plus model reference is unique per report. */
export function driftLineKey(line: DriftLine): string {
  return `${line.kind}:${line.provider}/${line.modelId}`;
}

export interface SyncDrift {
  hasDrift: boolean;
  driftDetails: string[];
  /** Optional so a body cached before T-0100 still renders as plain sentences. */
  lines?: DriftLine[];
}

/** The subset of an `ApiModel` row the `ModelEditor` form edits. */
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
