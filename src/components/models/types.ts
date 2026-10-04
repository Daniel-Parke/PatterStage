// ═══════════════════════════════════════════════════════════════
// /config/models — API row shapes used by the models page. TaskType lives in
// models/task-types.ts.
// ═══════════════════════════════════════════════════════════════

import type { ModelEditorRecord } from "./ModelEditor";

// The row is the library's (C2, T-0137); this file keeps the name its importers use.
import type { ApiModel } from "@/lib/models/model-types";
export type { ApiModel };

export type { CredentialSummary as ApiCredential } from "@/types/console";

import type { DriftLine } from "@/lib/models/model-types";
export type { DriftLine, SyncDrift } from "@/lib/models/model-types";

/** A stable key for one line (lines carry no id): kind plus model reference is unique per report. */
export function driftLineKey(line: DriftLine): string {
  return `${line.kind}:${line.provider}/${line.modelId}`;
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
