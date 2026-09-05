// scripts/tooling/hermes-registry-import.mjs
// Idempotent import of Hermes config.yaml + .env into SQLite models/credentials.

import { createHash, randomUUID } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

import { columnExists } from "./db-schema-ensure.mjs";

const PROVIDER_ENV_VAR = {
  openrouter: "OPENROUTER_API_KEY",
  nous: "NOUS_API_KEY",
  "openai-codex": "OPENAI_API_KEY",
  "copilot-acp": "COPILOT_ACP_API_KEY",
  copilot: "COPILOT_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  huggingface: "HUGGINGFACE_API_KEY",
  zai: "ZAI_API_KEY",
  "kimi-coding": "KIMI_API_KEY",
  minimax: "MINIMAX_API_KEY",
  "minimax-cn": "MINIMAX_CN_API_KEY",
  kilocode: "KILOCODE_API_KEY",
  xiaomi: "XIAOMI_API_KEY",
  openai: "OPENAI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  groq: "GROQ_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  "azure-openai": "AZURE_OPENAI_API_KEY",
  ollama: "OLLAMA_API_KEY",
  lmstudio: "LMSTUDIO_API_KEY",
  vllm: "VLLM_API_KEY",
  custom: "CUSTOM_API_KEY",
};

const TASK_TYPES = [
  "agent",
  "hindsight",
  "compression",
  "vision",
  "web_extract",
  "session_search",
  "title_generation",
  "skills_hub",
  "mcp",
  "triage_specifier",
  "approval",
  "delegation",
];

function deriveProvider(modelId) {
  const lower = modelId.toLowerCase();
  if (
    lower.startsWith("anthropic/") ||
    lower.includes("claude") ||
    lower.includes("opus") ||
    lower.includes("sonnet") ||
    lower.includes("haiku")
  ) {
    return "anthropic";
  }
  if (lower.startsWith("openai/") || lower.includes("gpt")) return "openai";
  if (lower.startsWith("openrouter/")) return "openrouter";
  if (lower.startsWith("google/") || lower.startsWith("gemini/")) return "gemini";
  if (lower.startsWith("deepseek/")) return "deepseek";
  if (lower.startsWith("mistral/")) return "mistral";
  if (lower.startsWith("groq/")) return "groq";
  if (lower.startsWith("huggingface/")) return "huggingface";
  if (lower.startsWith("ollama/")) return "ollama";
  if (lower.startsWith("lmstudio/")) return "lmstudio";
  if (lower.startsWith("vllm/")) return "vllm";
  if (lower.includes("minimax")) return "minimax";
  return null;
}

function keyHint(apiKey) {
  const t = apiKey.trim();
  if (t.length <= 8) return `${t.slice(0, 2)}...${t.slice(-2)}`;
  return `${t.slice(0, Math.min(4, t.length - 4))}...${t.slice(-4)}`;
}

/**
 * Upsert models, model_defaults, and credentials from Hermes config.
 *
 * @param {import('better-sqlite3').Database} database
 * @param {{ hermesHome?: string, silent?: boolean }} [options]
 * @returns {{ modelsUpserted: number, credsUpserted: number, skipped: boolean }}
 */
export function importHermesRegistry(database, options = {}) {
  const hermesHome = options.hermesHome ?? process.env.HERMES_HOME ?? join(homedir(), ".hermes");
  const configPath = join(hermesHome, "config.yaml");
  const envPath = join(hermesHome, ".env");

  if (!existsSync(configPath)) {
    return { modelsUpserted: 0, credsUpserted: 0, skipped: true };
  }

  const configYaml = yaml.load(readFileSync(configPath, "utf-8")) ?? {};
  const configModel = configYaml.model ?? {};
  const configAux = configYaml.auxiliary ?? {};

  const envVars = new Map();
  if (existsSync(envPath)) {
    for (const raw of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
      if (m) envVars.set(m[1], m[2].trim());
    }
  }

  const envToProvider = new Map();
  for (const [prov, envVar] of Object.entries(PROVIDER_ENV_VAR)) {
    envToProvider.set(envVar, prov);
  }

  const modelsToUpsert = new Map();

  if (configModel.default && configModel.provider) {
    const prov = String(configModel.provider);
    const modelId = String(configModel.default);
    const baseUrl = configModel.base_url ? String(configModel.base_url).trim() || null : null;
    const key = createHash("sha256").update(`${prov}::${modelId}`).digest("hex").slice(0, 16);
    modelsToUpsert.set(key, {
      importKey: key,
      name: modelId,
      provider: prov,
      modelId,
      baseUrl,
      defaultSlots: ["agent"],
    });
  } else if (configModel.default) {
    const modelId = String(configModel.default);
    const prov = deriveProvider(modelId);
    if (prov) {
      const baseUrl = configModel.base_url ? String(configModel.base_url).trim() || null : null;
      const key = createHash("sha256").update(`${prov}::${modelId}`).digest("hex").slice(0, 16);
      modelsToUpsert.set(key, {
        importKey: key,
        name: modelId,
        provider: prov,
        modelId,
        baseUrl,
        defaultSlots: ["agent"],
      });
    }
  }

  for (const slot of TASK_TYPES) {
    const entry = configAux[slot];
    if (!entry || !entry.model) continue;
    const modelId = String(entry.model);
    const prov = entry.provider ? String(entry.provider) : deriveProvider(modelId);
    if (!prov) continue;
    const baseUrl = entry.base_url ? String(entry.base_url).trim() || null : null;
    const key = createHash("sha256").update(`${prov}::${modelId}`).digest("hex").slice(0, 16);
    if (modelsToUpsert.has(key)) {
      const existing = modelsToUpsert.get(key);
      if (!existing.defaultSlots.includes(slot)) existing.defaultSlots.push(slot);
    } else {
      modelsToUpsert.set(key, {
        importKey: key,
        name: modelId,
        provider: prov,
        modelId,
        baseUrl,
        defaultSlots: [slot],
      });
    }
  }

  let modelsUpserted = 0;
  // This runs at PREBUILD, against a database that has only the v001 baseline
  // and is pinned at schema_version 3: the TypeScript ladder has not run, so
  // models.origin does not exist yet and naming it would throw "no such
  // column", be swallowed, and ship a database with no models at all. When the
  // columns are absent the script writes today's set and migration 039's
  // backfill classifies these rows (they carry import_key) on the app's first
  // open (T-0100).
  const hasOrigin = columnExists(database, "models", "origin");
  const upsertAll = database.transaction(() => {
    for (const [, m] of modelsToUpsert) {
      const existing = database.prepare("SELECT id FROM models WHERE import_key = ?").get(m.importKey);
      const ts = new Date().toISOString();
      let modelRowId;
      if (existing) {
        modelRowId = existing.id;
        if (hasOrigin) {
          // The same keep-rule the repository applies: a row the operator has
          // renamed since the last import keeps its name.
          const row = database
            .prepare("SELECT name, base_url, last_imported_name, last_imported_base_url FROM models WHERE id=?")
            .get(modelRowId);
          const neverImported = row.last_imported_name === null;
          const keepName = neverImported || row.name !== row.last_imported_name;
          const keepBaseUrl = neverImported || row.base_url !== row.last_imported_base_url;
          database
            .prepare(
              "UPDATE models SET name=?, provider=?, model_id=?, base_url=?," +
                " last_imported_name=?, last_imported_base_url=?, updated_at=? WHERE id=?"
            )
            .run(
              keepName ? row.name : m.name,
              m.provider,
              m.modelId,
              keepBaseUrl ? row.base_url : m.baseUrl,
              m.name,
              m.baseUrl,
              ts,
              modelRowId,
            );
        } else {
          database
            .prepare(
              "UPDATE models SET name=?, provider=?, model_id=?, base_url=?, updated_at=? WHERE id=?"
            )
            .run(m.name, m.provider, m.modelId, m.baseUrl, ts, modelRowId);
        }
      } else {
        modelRowId = randomUUID();
        if (hasOrigin) {
          database
            .prepare(
              "INSERT INTO models (id,name,provider,model_id,base_url,context_length,credentials_id,import_key," +
                "origin,last_imported_name,last_imported_base_url,created_at,updated_at)" +
                " VALUES (?,?,?,?,?,NULL,NULL,?,'import',?,?,?,?)"
            )
            .run(modelRowId, m.name, m.provider, m.modelId, m.baseUrl, m.importKey, m.name, m.baseUrl, ts, ts);
        } else {
          database
            .prepare(
              "INSERT INTO models (id,name,provider,model_id,base_url,context_length,credentials_id,import_key,created_at,updated_at)" +
                " VALUES (?,?,?,?,?,NULL,NULL,?,?,?)"
            )
            .run(modelRowId, m.name, m.provider, m.modelId, m.baseUrl, m.importKey, ts, ts);
        }
      }
      for (const slot of m.defaultSlots) {
        database.prepare("DELETE FROM model_defaults WHERE task_type = ?").run(slot);
        database
          .prepare(
            "INSERT INTO model_defaults (id, task_type, model_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
          )
          .run(randomUUID(), slot, modelRowId, ts, ts);
      }
      modelsUpserted++;
    }
  });
  upsertAll();

  const usedProviders = new Set(Array.from(modelsToUpsert.values()).map((m) => m.provider));
  let credsUpserted = 0;
  for (const [envVar, apiKey] of envVars) {
    const prov = envToProvider.get(envVar);
    if (!prov || !usedProviders.has(prov) || !apiKey) continue;
    const existing = database.prepare("SELECT id, api_key FROM credentials WHERE provider = ?").get(prov);
    const ts = new Date().toISOString();
    if (existing) {
      if (existing.api_key !== apiKey) {
        database
          .prepare("UPDATE credentials SET api_key=?,key_hint=?,updated_at=? WHERE id=?")
          .run(apiKey, keyHint(apiKey), ts, existing.id);
      }
    } else {
      database
        .prepare(
          "INSERT INTO credentials (id,label,provider,api_key,key_hint,created_at,updated_at)" +
            " VALUES (?,?,?,?,?,?,?)"
        )
        .run(randomUUID(), `${prov} key`, prov, apiKey, keyHint(apiKey), ts, ts);
    }
    credsUpserted++;
  }

  if (!options.silent) {
    console.log(`✓ Hermes model import: ${modelsUpserted} model(s), ${credsUpserted} credential(s)`);
  }

  return { modelsUpserted, credsUpserted, skipped: false };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const Database = (await import("better-sqlite3")).default;
  const { join: joinPath, dirname } = await import("path");
  const { fileURLToPath: toPath } = await import("url");
  const scriptDir = dirname(toPath(import.meta.url));
  const dataDir = joinPath(scriptDir, "..", "..", "data");
  const nextDb = joinPath(dataDir, "patterstage.db");
  const legacyDb = joinPath(dataDir, "control-hub.db");
  const defaultDb = !existsSync(nextDb) && existsSync(legacyDb) ? legacyDb : nextDb;
  const dbPath = process.argv[2] ?? defaultDb;

  if (!existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    process.exit(1);
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  try {
    importHermesRegistry(db);
  } catch (err) {
    console.warn(`⚠  Hermes model import skipped: ${err}`);
    process.exit(0);
  } finally {
    db.close();
  }
}
