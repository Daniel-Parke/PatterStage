// ═══════════════════════════════════════════════════════════════
// model-types — the model row, spelled once (C2, T-0137)
//
// A model's identity is four fields: which provider, which model id, at
// which base URL, with what context length. Seven files spelled them, two of
// them as an `ApiModel` each declared for itself. The repository's record,
// the API's row, the editor's record, the Hermes config's entry and the
// diff's argument all extend or alias what is here.
// ═══════════════════════════════════════════════════════════════

import type { ApiStyle } from "@/lib/models/llm-endpoint";
import type { TaskType } from "@/lib/models/task-types";

/** What makes a model the model it is, on either side of the sync. */
export interface ModelIdentity {
  provider: string;
  modelId: string;
  baseUrl: string | null;
  contextLength: number | null;
}

/** A stored model as the editor and the list see it. */
export interface ModelRow extends ModelIdentity {
  id: string;
  name: string;
  credentialsId: string | null;
}

/** The row /api/models returns. */
export interface ApiModel extends ModelRow {
  /** Direct-provider wire protocol (openai | anthropic); null ⇒ inferred at call time. */
  apiStyle: ApiStyle | null;
  defaults: Record<TaskType, string | null>;
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

export interface SyncDrift {
  hasDrift: boolean;
  driftDetails: string[];
  /** Optional so a body cached before T-0100 still renders as plain sentences. */
  lines?: DriftLine[];
}
