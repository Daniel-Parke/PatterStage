// ═══════════════════════════════════════════════════════════════
// models-repository.ts — CRUD for user models (Hermes dispatch)
// ═══════════════════════════════════════════════════════════════
//
// Drives mission dispatch, generic LLM calls, and the Hindsight bridge.
// Defaults are stored in the model_defaults table keyed on task_type.

import { db, inTransaction, uuid, now } from "./db";
import { isTaskType, type TaskType } from "./hermes-providers";
import { getCredentialWithKey } from "./credentials-repository";

// ── Public types ────────────────────────────────────────────────

export interface ModelDefaults {
  agent: string | null;
  hindsight: string | null;
  compression: string | null;
  vision: string | null;
  web_extract: string | null;
  session_search: string | null;
  title_generation: string | null;
  skills_hub: string | null;
  mcp: string | null;
  triage_specifier: string | null;
  approval: string | null;
  delegation: string | null;
}

export interface ModelRecord {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  baseUrl: string | null;
  contextLength: number | null;
  credentialsId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelWithKey extends ModelRecord {
  apiKey: string | null;
}

export type ModelDefaultFlags = Partial<Record<TaskType, boolean>>;

/**
 * Default slot flags — used at the API level to declare which task
 * types this model is the default for. Translated into model_defaults
 * table entries by createModel / updateModel.
 */

export interface CreateModelInput {
  name: string;
  provider: string;
  modelId: string;
  baseUrl?: string | null;
  contextLength?: number | null;
  credentialsId?: string | null;
  /** Optional default-slot flags (post-migration, writes to model_defaults). */
  defaults?: ModelDefaultFlags;
}

export interface UpdateModelInput {
  name?: string;
  provider?: string;
  modelId?: string;
  baseUrl?: string | null;
  contextLength?: number | null;
  credentialsId?: string | null;
  /** Optional default-slot flags (post-migration, writes to model_defaults). */
  defaults?: ModelDefaultFlags;
}

export interface UpsertModelResult {
  id: string;
  action: "inserted" | "updated";
}

// ── Row shape ──────────────────────────────────────────────────

interface ModelRow {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  base_url: string | null;
  context_length: number | null;
  credentials_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToModel(row: ModelRow): ModelRecord {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    modelId: row.model_id,
    baseUrl: row.base_url,
    contextLength: row.context_length,
    credentialsId: row.credentials_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function emptyDefaults(): ModelDefaults {
  return {
    agent: null, hindsight: null, compression: null, vision: null,
    web_extract: null, session_search: null, title_generation: null,
    skills_hub: null, mcp: null, triage_specifier: null,
    approval: null, delegation: null,
  };
}

// ── Read ───────────────────────────────────────────────────────

export function listModels(): ModelRecord[] {
  const rows = db()
    .prepare("SELECT * FROM models ORDER BY created_at DESC")
    .all() as ModelRow[];
  return rows.map(rowToModel);
}

export function getModel(id: string): ModelRecord | null {
  const row = db().prepare("SELECT * FROM models WHERE id = ?").get(id) as ModelRow | undefined;
  return row ? rowToModel(row) : null;
}

export function getModelWithKey(id: string): ModelWithKey | null {
  const model = getModel(id);
  if (!model) return null;
  const apiKey = model.credentialsId
    ? getCredentialWithKey(model.credentialsId)?.apiKey ?? null
    : null;
  return { ...model, apiKey };
}

// ── Defaults (now in model_defaults table) ─────────────────────────

export function getDefaultModel(taskType: TaskType): ModelRecord | null {
  if (!isTaskType(taskType)) {
    throw new Error(`Unknown task type: ${taskType}`);
  }
  const row = db()
    .prepare(
      `SELECT m.* FROM models m INNER JOIN model_defaults d ON m.id = d.model_id WHERE d.task_type = ? LIMIT 1`
    )
    .get(taskType) as ModelRow | undefined;
  return row ? rowToModel(row) : null;
}

export function getModelDefaults(): ModelDefaults {
  const defaults = emptyDefaults();
  
  const rows = db()
    .prepare("SELECT task_type, model_id FROM model_defaults")
    .all() as { task_type: string; model_id: string | null }[];
  
  for (const row of rows) {
    if (isTaskType(row.task_type)) {
      defaults[row.task_type] = row.model_id;
    }
  }
  
  return defaults;
}

// ── Write ──────────────────────────────────────────────────────

export function createModel(input: CreateModelInput): ModelRecord {
  if (!input.name || input.name.trim().length === 0) throw new Error("name is required");
  if (!input.provider || input.provider.trim().length === 0) throw new Error("provider is required");
  if (!input.modelId || input.modelId.trim().length === 0) throw new Error("modelId is required");

  const id = uuid();
  const ts = now();

  db()
    .prepare(
      `INSERT INTO models (
         id, name, provider, model_id, base_url, context_length, credentials_id,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.name.trim(),
      input.provider.trim(),
      input.modelId.trim(),
      input.baseUrl ?? null,
      input.contextLength ?? null,
      input.credentialsId ?? null,
      ts,
      ts
    );

  // Process default-slot flags: if any defaults are set, clear existing
  // defaults for that slot, then set the new defaults.
  if (input.defaults && Object.values(input.defaults).some(Boolean)) {
    for (const [slot, isDefault] of Object.entries(input.defaults)) {
      if (isDefault && isTaskType(slot)) {
        db()
          .prepare("DELETE FROM model_defaults WHERE task_type = ?")
          .run(slot);
        db()
          .prepare("INSERT INTO model_defaults (id, task_type, model_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
          .run(uuid(), slot, id, ts, ts);
      }
    }
  }

  return getModel(id)!;
}

export function updateModel(id: string, input: UpdateModelInput): ModelRecord | null {
  const existing = getModel(id);
  if (!existing) return null;

  const ts = now();

  inTransaction(() => {
    const sets: string[] = ["updated_at = ?"];
    const vals: unknown[] = [ts];

    if (input.name !== undefined) {
      sets.push("name = ?");
      vals.push(input.name.trim());
    }
    if (input.provider !== undefined) {
      sets.push("provider = ?");
      vals.push(input.provider.trim());
    }
    if (input.modelId !== undefined) {
      sets.push("model_id = ?");
      vals.push(input.modelId.trim());
    }
    if (input.baseUrl !== undefined) {
      sets.push("base_url = ?");
      vals.push(input.baseUrl);
    }
    if (input.contextLength !== undefined) {
      sets.push("context_length = ?");
      vals.push(input.contextLength);
    }
    if (input.credentialsId !== undefined) {
      sets.push("credentials_id = ?");
      vals.push(input.credentialsId);
    }

    vals.push(id);
    db().prepare(`UPDATE models SET ${sets.join(", ")} WHERE id = ?`).run(...vals);

    // Process default-slot flags
    if (input.defaults) {
      for (const [slot, isDefault] of Object.entries(input.defaults)) {
        if (!isTaskType(slot)) continue;
        db()
          .prepare("DELETE FROM model_defaults WHERE task_type = ?")
          .run(slot);
        if (isDefault) {
          db()
            .prepare("INSERT INTO model_defaults (id, task_type, model_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
            .run(uuid(), slot, id, ts, ts);
        }
      }
    }
  });

  return getModel(id);
}

export function deleteModel(id: string): boolean {
  const exists = db().prepare("SELECT 1 FROM models WHERE id = ?").get(id);
  if (!exists) return false;

  inTransaction(() => {
    db().prepare("DELETE FROM models WHERE id = ?").run(id);
    db().prepare("DELETE FROM model_defaults WHERE model_id = ?").run(id);
  });
  return true;
}

export function setDefaultModel(taskType: TaskType, modelId: string | null): ModelDefaults {
  if (!isTaskType(taskType)) {
    throw new Error(`Unknown task type: ${taskType}`);
  }

  // Validate model exists when setting a non-null default
  if (modelId !== null) {
    const model = getModel(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }
  }

  const ts = now();

  inTransaction(() => {
    // Remove existing default for this task_type
    db()
      .prepare("DELETE FROM model_defaults WHERE task_type = ?")
      .run(taskType);

    // Insert new default if modelId provided
    if (modelId) {
      db()
        .prepare("INSERT INTO model_defaults (id, task_type, model_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .run(uuid(), taskType, modelId, ts, ts);
    }
  });

  return getModelDefaults();
}

// ── Upsert (used by hermes-import.ts) ─────────────────────────

/**
 * Idempotent upsert for imported models from Hermes config.yaml.
 * 
 * Matches existing models by (provider, model_id) — the import_key column
 * may not exist in older schemas. importKey is accepted for API compatibility
 * but is not used in the SQL query.
 * 
 * For each task type in defaultSlots, sets this model as the default
 * for that slot.
 */
export function upsertModel(input: {
  /** Accepted for API compatibility with hermes-import.ts; not used in SQL. */
  importKey: string;
  name: string;
  provider: string;
  modelId: string;
  baseUrl: string | null;
  contextLength: number | null;
  defaultSlots: TaskType[];
}): UpsertModelResult {
  const ts = now();

  // Match by (provider, model_id) — import_key column may not exist
  const existing = db()
    .prepare("SELECT id FROM models WHERE provider = ? AND model_id = ? LIMIT 1")
    .get(input.provider, input.modelId) as { id: string } | undefined;

  if (existing) {
    // Update existing row (preserve credentials_id)
    db()
      .prepare("UPDATE models SET name = ?, base_url = ?, updated_at = ? WHERE id = ?")
      .run(input.name, input.baseUrl, ts, existing.id);

    // Update defaults for this model
    for (const slot of input.defaultSlots) {
      if (isTaskType(slot)) {
        setDefaultModel(slot, existing.id);
      }
    }

    return { id: existing.id, action: "updated" };
  }

  // Insert new row
  const id = uuid();

  db()
    .prepare(
      `INSERT INTO models (
         id, name, provider, model_id, base_url, context_length, credentials_id,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`
    )
    .run(
      id,
      input.name.trim(),
      input.provider.trim(),
      input.modelId.trim(),
      input.baseUrl ?? null,
      input.contextLength ?? null,
      ts,
      ts
    );

  // Set defaults for newly inserted model
  for (const slot of input.defaultSlots) {
    if (isTaskType(slot)) {
      setDefaultModel(slot, id);
    }
  }

  return { id, action: "inserted" };
}