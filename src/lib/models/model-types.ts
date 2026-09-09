// ═══════════════════════════════════════════════════════════════
// model-types — the model row, spelled once (C2, T-0137)
//
// A model's identity is four fields: which provider, which model id, at
// which base URL, with what context length. Seven files spelled them, two of
// them as an `ApiModel` each declared for itself. The repository's record,
// the API's row, the editor's record, the Hermes config's entry and the
// diff's argument all extend or alias what is here.
// ═══════════════════════════════════════════════════════════════

import type { ApiStyle } from "@/lib/llm-endpoint";
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
