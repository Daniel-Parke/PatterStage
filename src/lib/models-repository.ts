// ═══════════════════════════════════════════════════════════════
// models-repository.ts — CRUD for the user-models registry
// ═══════════════════════════════════════════════════════════════
//
// Drives mission dispatch, generic LLM calls, and the Hindsight bridge.
// One model row may be the default for any subset of the 12 task types
// (`agent` + 11 auxiliary slots — see hermes-providers.ts TASK_TYPES).
//
// Default uniqueness is enforced at the DB layer via partial unique
// indexes (migration 006_models_credentials.sql); setDefaultModel() is
// transactional so the previous default is cleared in the same step.

import { db, inTransaction, uuid, now } from "./db";
import { TASK_TYPES, isTaskType, type TaskType } from "./hermes-providers";
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
  defaults: ModelDefaults;
  createdAt: string;
  updatedAt: string;
}

/** Internal-only: model record + plaintext API key from joined credential. */
export interface ModelWithKey extends ModelRecord {
  apiKey: string | null;
}

/**
 * Slot flags accepted on create/update — `true` makes this row the default
 * for that task type (clearing the previous default in the same transaction),
 * `false` clears it. Slots omitted from the object are left untouched.
 */
export type ModelDefaultFlags = Partial<Record<TaskType, boolean>>;

export interface CreateModelInput {
  name: string;
  provider: string;
  modelId: string;
  baseUrl?: string | null;
  contextLength?: number | null;
  credentialsId?: string | null;
  defaults?: ModelDefaultFlags;
}

export interface UpdateModelInput {
  name?: string;
  provider?: string;
  modelId?: string;
  baseUrl?: string | null;
  contextLength?: number | null;
  credentialsId?: string | null;
  defaults?: ModelDefaultFlags;
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
  is_default_agent: number;
  is_default_hindsight: number;
  is_default_compression: number;
  is_default_vision: number;
  is_default_web_extract: number;
  is_default_session_search: number;
  is_default_title_generation: number;
  is_default_skills_hub: number;
  is_default_mcp: number;
  is_default_triage_specifier: number;
  is_default_approval: number;
  is_default_delegation: number;
  created_at: string;
  updated_at: string;
}

function rowToDefaults(row: ModelRow): ModelDefaults {
  const lookup = (slot: TaskType): string | null =>
    (row[`is_default_${slot}` as keyof ModelRow] as number) === 1 ? row.id : null;
  return {
    agent: lookup("agent"),
    hindsight: lookup("hindsight"),
    compression: lookup("compression"),
    vision: lookup("vision"),
    web_extract: lookup("web_extract"),
    session_search: lookup("session_search"),
    title_generation: lookup("title_generation"),
    skills_hub: lookup("skills_hub"),
    mcp: lookup("mcp"),
    triage_specifier: lookup("triage_specifier"),
    approval: lookup("approval"),
    delegation: lookup("delegation"),
  };
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
    defaults: rowToDefaults(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function flagsFromDefaults(defaults: ModelDefaultFlags | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const slot of TASK_TYPES) {
    const flag = `is_default_${slot}`;
    if (defaults && defaults[slot] !== undefined) {
      out[flag] = defaults[slot] ? 1 : 0;
    } else {
      out[flag] = 0;
    }
  }
  return out;
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

export function getDefaultModel(taskType: TaskType): ModelRecord | null {
  if (!isTaskType(taskType)) {
    throw new Error(`Unknown task type: ${taskType}`);
  }
  const flag = `is_default_${taskType}`;
  const row = db()
    .prepare(`SELECT * FROM models WHERE ${flag} = 1 LIMIT 1`)
    .get() as ModelRow | undefined;
  return row ? rowToModel(row) : null;
}

export function getModelDefaults(): ModelDefaults {
  const blank: ModelDefaults = {
    agent: null,
    hindsight: null,
    compression: null,
    vision: null,
    web_extract: null,
    session_search: null,
    title_generation: null,
    skills_hub: null,
    mcp: null,
    triage_specifier: null,
    approval: null,
    delegation: null,
  };
  const rows = db().prepare("SELECT * FROM models").all() as ModelRow[];
  for (const row of rows) {
    for (const slot of TASK_TYPES) {
      if ((row[`is_default_${slot}` as keyof ModelRow] as number) === 1) {
        blank[slot] = row.id;
      }
    }
  }
  return blank;
}

// ── Write ──────────────────────────────────────────────────────

export function createModel(input: CreateModelInput): ModelRecord {
  if (!input.name || input.name.trim().length === 0) throw new Error("name is required");
  if (!input.provider || input.provider.trim().length === 0) throw new Error("provider is required");
  if (!input.modelId || input.modelId.trim().length === 0) throw new Error("modelId is required");

  const id = uuid();
  const ts = now();
  const flags = flagsFromDefaults(input.defaults);

  inTransaction(() => {
    // Clear existing defaults for any slot we're claiming to avoid the
    // partial unique index violating mid-transaction.
    for (const slot of TASK_TYPES) {
      const flag = `is_default_${slot}`;
      if (flags[flag] === 1) {
        db().prepare(`UPDATE models SET ${flag} = 0, updated_at = ? WHERE ${flag} = 1`).run(ts);
      }
    }

    db()
      .prepare(
        `INSERT INTO models (
           id, name, provider, model_id, base_url, context_length, credentials_id,
           is_default_agent, is_default_hindsight, is_default_compression,
           is_default_vision, is_default_web_extract, is_default_session_search,
           is_default_title_generation, is_default_skills_hub, is_default_mcp,
           is_default_triage_specifier, is_default_approval, is_default_delegation,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name.trim(),
        input.provider.trim(),
        input.modelId.trim(),
        input.baseUrl ?? null,
        input.contextLength ?? null,
        input.credentialsId ?? null,
        flags.is_default_agent,
        flags.is_default_hindsight,
        flags.is_default_compression,
        flags.is_default_vision,
        flags.is_default_web_extract,
        flags.is_default_session_search,
        flags.is_default_title_generation,
        flags.is_default_skills_hub,
        flags.is_default_mcp,
        flags.is_default_triage_specifier,
        flags.is_default_approval,
        flags.is_default_delegation,
        ts,
        ts
      );
  });

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

    if (input.defaults !== undefined) {
      // Clear any other model holding a slot we're claiming.
      for (const slot of TASK_TYPES) {
        if (input.defaults[slot] !== undefined && input.defaults[slot]) {
          const flag = `is_default_${slot}`;
          db()
            .prepare(`UPDATE models SET ${flag} = 0, updated_at = ? WHERE ${flag} = 1 AND id != ?`)
            .run(ts, id);
        }
      }
      for (const slot of TASK_TYPES) {
        if (input.defaults[slot] !== undefined) {
          const flag = `is_default_${slot}`;
          sets.push(`${flag} = ?`);
          vals.push(input.defaults[slot] ? 1 : 0);
        }
      }
    }

    vals.push(id);
    db().prepare(`UPDATE models SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  });

  return getModel(id);
}

export function deleteModel(id: string): boolean {
  const result = db().prepare("DELETE FROM models WHERE id = ?").run(id);
  return result.changes > 0;
}

/**
 * Set (or clear, if modelId is null) the default for a task type. Single
 * transaction so the partial unique index is never violated.
 */
export function setDefaultModel(taskType: TaskType, modelId: string | null): ModelDefaults {
  if (!isTaskType(taskType)) {
    throw new Error(`Unknown task type: ${taskType}`);
  }
  const flag = `is_default_${taskType}`;
  const ts = now();

  inTransaction(() => {
    db().prepare(`UPDATE models SET ${flag} = 0, updated_at = ? WHERE ${flag} = 1`).run(ts);
    if (modelId) {
      const result = db()
        .prepare(`UPDATE models SET ${flag} = 1, updated_at = ? WHERE id = ?`)
        .run(ts, modelId);
      if (result.changes === 0) {
        throw new Error(`Model not found: ${modelId}`);
      }
    }
  });

  return getModelDefaults();
}

// ── Upsert (used by hermes-import.ts) ─────────────────────────────────

export interface UpsertModelResult {
  id: string;
  action: "inserted" | "updated";
}

/**
 * Idempotent upsert: insert a new model if no row with the same import_key
 * exists, otherwise update it (keeping the existing id and defaults not
 * covered by the import).
 *
 * import_key is SHA-256(provider :: model_id) — stable across re-imports.
 * Used by hermes-import.ts so that re-importing the same Hermes config
 * never creates duplicate rows.
 */
export function upsertModel(input: {
  importKey: string;
  name: string;
  provider: string;
  modelId: string;
  baseUrl: string | null;
  contextLength: number | null;
  defaultSlots: TaskType[];
}): UpsertModelResult {
  const ts = now();
  const existing = db()
    .prepare("SELECT id FROM models WHERE import_key = ?")
    .get(input.importKey) as { id: string } | undefined;

  if (existing) {
    // Update existing row — preserve the credentials_id link
    const sets = ["name = ?", "provider = ?", "model_id = ?", "base_url = ?", "updated_at = ?"];
    const vals: unknown[] = [input.name, input.provider, input.modelId, input.baseUrl, ts];

    // Clear all default flags first, then set the ones claimed by this import
    for (const slot of TASK_TYPES) {
      sets.push(`${slot === "agent" ? "is_default_agent" : `is_default_${slot}`} = 0`);
    }
    for (const slot of input.defaultSlots) {
      const flag = `is_default_${slot}`;
      const idx = sets.indexOf(`${flag} = 0`);
      if (idx !== -1) {
        sets.splice(idx, 1, `${flag} = 1`);
      }
    }

    vals.push(existing.id);
    db().prepare(`UPDATE models SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
    return { id: existing.id, action: "updated" };
  }

  // Insert new row
  const id = uuid();
  const flags = flagsFromDefaults(
    input.defaultSlots.reduce<Partial<Record<TaskType, boolean>>>(
      (acc, slot) => ({ ...acc, [slot]: true }),
      {}
    )
  );

  inTransaction(() => {
    for (const slot of TASK_TYPES) {
      const flag = `is_default_${slot}`;
      if (flags[flag] === 1) {
        db().prepare(`UPDATE models SET ${flag} = 0, updated_at = ? WHERE ${flag} = 1`).run(ts);
      }
    }

    db()
      .prepare(
        `INSERT INTO models (
           id, name, provider, model_id, base_url, context_length, credentials_id, import_key,
           is_default_agent, is_default_hindsight, is_default_compression,
           is_default_vision, is_default_web_extract, is_default_session_search,
           is_default_title_generation, is_default_skills_hub, is_default_mcp,
           is_default_triage_specifier, is_default_approval, is_default_delegation,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name.trim(),
        input.provider.trim(),
        input.modelId.trim(),
        input.baseUrl ?? null,
        input.contextLength ?? null,
        input.importKey,
        flags.is_default_agent,
        flags.is_default_hindsight,
        flags.is_default_compression,
        flags.is_default_vision,
        flags.is_default_web_extract,
        flags.is_default_session_search,
        flags.is_default_title_generation,
        flags.is_default_skills_hub,
        flags.is_default_mcp,
        flags.is_default_triage_specifier,
        flags.is_default_approval,
        flags.is_default_delegation,
        ts,
        ts
      );
  });

  return { id, action: "inserted" };
}

