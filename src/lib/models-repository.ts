// ═══════════════════════════════════════════════════════════════
// models-repository.ts — CRUD for user models (Hermes dispatch)
// ═══════════════════════════════════════════════════════════════
//
// Drives mission dispatch, generic LLM calls, and the Hindsight bridge.
// Defaults are stored in the model_defaults table keyed on task_type.

import { clampLimit, MODEL_LIST_BOUNDS } from "@/lib/list-bounds";
import { getDb, inTransaction, uuid, now } from "./db";
import { isTaskType, type TaskType } from "./models/task-types";
import { getCredentialWithKey } from "./credentials-repository";
import { emptyModelDefaults } from "./utils";
import { inferApiStyle, normalizeApiStyle, type ApiStyle } from "./llm-endpoint";
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
  /**
   * Wire protocol for the direct-provider path: "openai" (`/chat/completions`)
   * or "anthropic" (`/v1/messages`). Null ⇒ inferred from provider/baseUrl at
   * call time (see {@link inferApiStyle}).
   */
  apiStyle: ApiStyle | null;
  /** `import` when a config.yaml import created the row, `user` when a person did. */
  origin: ModelOrigin;
  /**
   * What the last import wrote into `name` / `baseUrl`. The comparison that
   * tells an operator's edit from a value the import itself put there: when
   * the row still equals these, the import may overwrite; when it differs, the
   * operator changed it and the import leaves it alone (T-0100, D10).
   */
  lastImportedName: string | null;
  lastImportedBaseUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelWithKey extends ModelRecord {
  apiKey: string | null;
}

type ModelDefaultFlags = Partial<Record<TaskType, boolean>>;

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
  /** Direct-provider wire protocol; null/omitted ⇒ inferred at call time. */
  apiStyle?: ApiStyle | null;
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
  /** Direct-provider wire protocol; null/omitted ⇒ inferred at call time. */
  apiStyle?: ApiStyle | null;
  /** Optional default-slot flags (post-migration, writes to model_defaults). */
  defaults?: ModelDefaultFlags;
}

export interface UpsertModelResult {
  id: string;
  action: "inserted" | "updated";
  /**
   * Fields the import left alone because the operator had changed them since
   * the last import. Empty when the import wrote everything it wanted to.
   */
  preserved: ModelEditableField[];
}

/** A field an operator can edit that an import also writes. */
/**
 * @public The fields an operator can edit that an import must not overwrite.
 * Named on `UpsertModelResult.preserved`, so a caller reading that array has
 * something to annotate it with.
 */
export type ModelEditableField = "name" | "baseUrl";

/** Where a row came from: an import of config.yaml, or the operator. */
/**
 * @public Where a registry row came from. Named on `ModelRecord.origin`, which
 * every read of the registry carries, and pinned by the migration 039 oracle.
 */
export type ModelOrigin = "import" | "user";

// ── Row shape ──────────────────────────────────────────────────

interface ModelRow {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  base_url: string | null;
  context_length: number | null;
  credentials_id: string | null;
  api_style: string | null;
  origin: string | null;
  last_imported_name: string | null;
  last_imported_base_url: string | null;
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
    apiStyle: normalizeApiStyle(row.api_style),
    origin: row.origin === "import" ? "import" : "user",
    lastImportedName: row.last_imported_name ?? null,
    lastImportedBaseUrl: row.last_imported_base_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Read ───────────────────────────────────────────────────────

export function listModels(opts?: { limit?: number }): ModelRecord[] {
  const rows = getDb()
    .prepare("SELECT * FROM models ORDER BY created_at DESC LIMIT ?")
    .all(clampLimit(opts?.limit, MODEL_LIST_BOUNDS)) as ModelRow[];
  return rows.map(rowToModel);
}

export function getModel(id: string): ModelRecord | null {
  const row = getDb().prepare("SELECT * FROM models WHERE id = ?").get(id) as ModelRow | undefined;
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

/**
 * Resolve a registry row by provider model id string (e.g. anthropic/claude-sonnet-4).
 * When multiple providers share the same model_id, prefer the agent default slot.
 */
export function findModelByModelId(modelId: string): ModelRecord | null {
  const trimmed = modelId.trim();
  if (!trimmed) return null;

  const rows = getDb()
    .prepare("SELECT * FROM models WHERE model_id = ?")
    .all(trimmed) as ModelRow[];

  if (rows.length === 0) return null;
  if (rows.length === 1) return rowToModel(rows[0]);

  const agentDefault = getDefaultModel("agent");
  if (agentDefault) {
    const match = rows.find((r) => r.id === agentDefault.id);
    if (match) return rowToModel(match);
  }

  return rowToModel(rows[0]);
}

// ── Defaults (now in model_defaults table) ─────────────────────────

export function getDefaultModel(taskType: TaskType): ModelRecord | null {
  if (!isTaskType(taskType)) {
    throw new Error(`Unknown task type: ${taskType}`);
  }
  const row = getDb()
    .prepare(
      `SELECT m.* FROM models m INNER JOIN model_defaults d ON m.id = d.model_id WHERE d.task_type = ? LIMIT 1`
    )
    .get(taskType) as ModelRow | undefined;
  return row ? rowToModel(row) : null;
}

export function getModelDefaults(): ModelDefaults {
  const defaults = emptyModelDefaults();
  
  const rows = getDb()
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

  getDb()
    .prepare(
      `INSERT INTO models (
         id, name, provider, model_id, base_url, context_length, credentials_id,
         api_style, origin, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'user', ?, ?)`
    )
    .run(
      id,
      input.name.trim(),
      input.provider.trim(),
      input.modelId.trim(),
      input.baseUrl ?? null,
      input.contextLength ?? null,
      input.credentialsId ?? null,
      input.apiStyle ?? inferApiStyle(input.provider, input.baseUrl ?? null),
      ts,
      ts
    );

  // Process default-slot flags: if any defaults are set, clear existing
  // defaults for that slot, then set the new defaults.
  if (input.defaults && Object.values(input.defaults).some(Boolean)) {
    for (const [slot, isDefault] of Object.entries(input.defaults)) {
      if (isDefault && isTaskType(slot)) {
        getDb()
          .prepare("DELETE FROM model_defaults WHERE task_type = ?")
          .run(slot);
        getDb()
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
    if (input.apiStyle !== undefined) {
      sets.push("api_style = ?");
      vals.push(input.apiStyle);
    }

    vals.push(id);
    getDb().prepare(`UPDATE models SET ${sets.join(", ")} WHERE id = ?`).run(...vals);

    // Process default-slot flags
    if (input.defaults) {
      for (const [slot, isDefault] of Object.entries(input.defaults)) {
        if (!isTaskType(slot)) continue;
        getDb()
          .prepare("DELETE FROM model_defaults WHERE task_type = ?")
          .run(slot);
        if (isDefault) {
          getDb()
            .prepare("INSERT INTO model_defaults (id, task_type, model_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
            .run(uuid(), slot, id, ts, ts);
        }
      }
    }
  });

  return getModel(id);
}

export function deleteModel(id: string): boolean {
  const exists = getDb().prepare("SELECT 1 FROM models WHERE id = ?").get(id);
  if (!exists) return false;

  inTransaction(() => {
    getDb().prepare("DELETE FROM models WHERE id = ?").run(id);
    getDb().prepare("DELETE FROM model_defaults WHERE model_id = ?").run(id);
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
    getDb()
      .prepare("DELETE FROM model_defaults WHERE task_type = ?")
      .run(taskType);

    // Insert new default if modelId provided
    if (modelId) {
      getDb()
        .prepare("INSERT INTO model_defaults (id, task_type, model_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .run(uuid(), taskType, modelId, ts, ts);
    }
  });

  return getModelDefaults();
}

// ── Upsert (used by modules/hermes/lib/config-import.ts) ─────────────────────────

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
  name: string;
  provider: string;
  modelId: string;
  baseUrl: string | null;
  contextLength: number | null;
  defaultSlots: TaskType[];
}): UpsertModelResult {
  const ts = now();

  // Match by (provider, model_id) — import_key column may not exist
  const existing = getDb()
    .prepare(
      "SELECT id, name, base_url, last_imported_name, last_imported_base_url FROM models WHERE provider = ? AND model_id = ? LIMIT 1",
    )
    .get(input.provider, input.modelId) as
    | {
        id: string;
        name: string;
        base_url: string | null;
        last_imported_name: string | null;
        last_imported_base_url: string | null;
      }
    | undefined;

  const apiStyle = inferApiStyle(input.provider, input.baseUrl);

  if (existing) {
    // Keep what the operator changed. The row still equal to what the last
    // import wrote is the import's own value and may be overwritten; a row
    // that differs was edited by hand. A row this import has never seen
    // (last_imported_name NULL, so a createModel row or a pre-039 one the
    // backfill judged the operator's) keeps both fields: the import may learn
    // what it wanted, but it does not get to claim a row it never wrote.
    // COALESCE on api_style is unchanged; context_length and credentials_id
    // are still absent from the UPDATE, so they are spared as they always were.
    const neverImported = existing.last_imported_name === null;
    const keepName = neverImported || existing.name !== existing.last_imported_name;
    const keepBaseUrl = neverImported || existing.base_url !== existing.last_imported_base_url;
    const preserved: ModelEditableField[] = [];
    if (keepName && existing.name !== input.name) preserved.push("name");
    if (keepBaseUrl && existing.base_url !== input.baseUrl) preserved.push("baseUrl");

    getDb()
      .prepare(
        `UPDATE models
            SET name = ?, base_url = ?, api_style = COALESCE(api_style, ?),
                last_imported_name = ?, last_imported_base_url = ?, updated_at = ?
          WHERE id = ?`,
      )
      .run(
        keepName ? existing.name : input.name,
        keepBaseUrl ? existing.base_url : input.baseUrl,
        apiStyle,
        input.name,
        input.baseUrl,
        ts,
        existing.id,
      );

    // Validate all task types upfront — failures are programmer errors
    // in internal callers, not user input, so throw rather than silently skip.
    for (const slot of input.defaultSlots) {
      if (!isTaskType(slot)) {
        throw new Error(`Unknown task type in defaultSlots: ${slot}`);
      }
    }

    // Update defaults for this model
    for (const slot of input.defaultSlots) {
      setDefaultModel(slot, existing.id);
    }

    return { id: existing.id, action: "updated", preserved };
  }

  // Insert new row
  const id = uuid();

  getDb()
    .prepare(
      `INSERT INTO models (
         id, name, provider, model_id, base_url, context_length, credentials_id,
         origin, last_imported_name, last_imported_base_url, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'import', ?, ?, ?, ?)`
    )
    .run(
      id,
      input.name.trim(),
      input.provider.trim(),
      input.modelId.trim(),
      input.baseUrl ?? null,
      input.contextLength ?? null,
      input.name.trim(),
      input.baseUrl ?? null,
      ts,
      ts
    );

  // Validate all task types upfront — failures are programmer errors
  // in internal callers, not user input, so throw rather than silently skip.
  for (const slot of input.defaultSlots) {
    if (!isTaskType(slot)) {
      throw new Error(`Unknown task type in defaultSlots: ${slot}`);
    }
  }

  // Set defaults for newly inserted model
  for (const slot of input.defaultSlots) {
    setDefaultModel(slot, id);
  }

  return { id, action: "inserted", preserved: [] };
}