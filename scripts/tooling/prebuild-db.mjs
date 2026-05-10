// scripts/prebuild-db.mjs
// Forces SQLite migrations and seeds before `next build`.
// Run automatically via `prebuild` npm script.

import Database from "better-sqlite3";
import { createHash } from "crypto";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DB_DIR = join(ROOT, "data");
const DB_PATH = join(DB_DIR, "control-hub.db");
const MIGRATIONS_DIR = join(ROOT, "src/lib/db/migrations");
const SEEDS_DIR = join(ROOT, "src/lib/db/seeds");

// Ensure data dir
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

// Bootstrap meta table
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

function getMeta(database, key) {
  const row = database.prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row ? row.value : null;
}

function setMeta(database, key, value) {
  database.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run(key, value);
}

function getSchemaVersion(database) {
  const v = getMeta(database, "schema_version");
  return v ? parseInt(v, 10) : 0;
}

function setSchemaVersion(database, version) {
  setMeta(database, "schema_version", String(version));
}

// ── Run pending migrations ───────────────────────────────────
const currentVersion = getSchemaVersion(db);
const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let migrationsApplied = 0;
for (const file of migrationFiles) {
  const num = parseInt(file.split("_")[0], 10);
  if (!isNaN(num) && num > currentVersion) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    db.exec(sql);
    setSchemaVersion(db, num);
    console.log(`✓ Migration ${num} (${file}) applied`);
    migrationsApplied++;
  }
}

if (migrationsApplied === 0) {
  console.log("✓ Database schema up to date");
} else {
  console.log(`✓ ${migrationsApplied} migration(s) applied`);
}

// ── Run pending seeds ────────────────────────────────────────
if (!existsSync(SEEDS_DIR)) {
  console.log("✓ No seeds directory — skipping");
} else {
  const seedFiles = readdirSync(SEEDS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const seedsRun = getMeta(db, "seeds_run") || "";
  const seedsRunSet = new Set(seedsRun ? seedsRun.split(",") : []);

  let seedsApplied = 0;
  for (const file of seedFiles) {
    if (!seedsRunSet.has(file)) {
      const sql = readFileSync(join(SEEDS_DIR, file), "utf-8");
      db.exec(sql);
      seedsRunSet.add(file);
      setMeta(db, "seeds_run", [...seedsRunSet].join(","));
      console.log(`✓ Seed ${file} applied`);
      seedsApplied++;
    }
  }

  if (seedsApplied === 0) {
    console.log("✓ Seeds up to date");
  } else {
    console.log(`✓ ${seedsApplied} seed(s) applied`);
  }
}

// ── Migration 008: add + backfill import_key column (idempotent) ──
{
  const cols = db.prepare("PRAGMA table_info(models)").all();
  const hasImportKey = cols.some((c) => c.name === "import_key");

  if (!hasImportKey) {
    // SQLite doesn't support IF NOT EXISTS for ADD COLUMN, but catching the
    // error is safe here since the column-check above is the guard.
    db.exec("ALTER TABLE models ADD COLUMN import_key TEXT");
    console.log("✓ Added import_key column to models table");
  }

  const rows = db
    .prepare(
      "SELECT id, provider, model_id FROM models WHERE import_key IS NULL AND provider IS NOT NULL AND model_id IS NOT NULL"
    )
    .all();
  if (rows.length > 0) {
    const update = db.prepare("UPDATE models SET import_key = ? WHERE id = ?");
    const backfill = db.transaction((rows) => {
      for (const row of rows) {
        const importKey = createHash("sha256")
          .update(`${row.provider}::${row.model_id}`)
          .digest("hex")
          .slice(0, 16);
        update.run(importKey, row.id);
      }
    });
    backfill(rows);
    console.log(`✓ Backfilled import_key for ${rows.length} pre-existing model row(s)`);
  }
}

// ── Hermes model auto-import ─────────────────────────────────
// Reads ~/.hermes/config.yaml and ~/.hermes/.env and upserts any
// discovered models + credentials into the registry. Safe to run on
// every prebuild — upsert is idempotent.

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

const HERMES_HOME = process.env.HERMES_HOME ?? join(homedir(), ".hermes");
const CONFIG_PATH = join(HERMES_HOME, "config.yaml");
const ENV_PATH = join(HERMES_HOME, ".env");

function deriveProvider(modelId) {
  const lower = modelId.toLowerCase();
  if (lower.startsWith("anthropic/") || lower.includes("claude") || lower.includes("opus") || lower.includes("sonnet") || lower.includes("haiku")) return "anthropic";
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

function uuid() {
  return crypto.randomUUID();
}

if (!existsSync(CONFIG_PATH)) {
  console.log("ℹ  No Hermes config — skipping Hermes model import");
  db.close();
  process.exit(0);
}

try {
  // Parse config.yaml
  const configYaml = yaml.load(readFileSync(CONFIG_PATH, "utf-8")) ?? {};
  const configModel = configYaml.model ?? {};
  const configAux = configYaml.auxiliary ?? {};

  // Parse .env
  const envVars = new Map();
  if (existsSync(ENV_PATH)) {
    for (const raw of readFileSync(ENV_PATH, "utf-8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
      if (m) envVars.set(m[1], m[2].trim());
    }
  }

  // env var name → provider key
  const envToProvider = new Map();
  for (const [prov, envVar] of Object.entries(PROVIDER_ENV_VAR)) {
    envToProvider.set(envVar, prov);
  }

  // Collect models: importKey → model descriptor
  const modelsToUpsert = new Map();

  // Primary agent model
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

  // Auxiliary slots
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

  // Upsert models
  let modelsUpserted = 0;
  const upsertAll = db.transaction(() => {
    for (const [, m] of modelsToUpsert) {
      const existing = db.prepare("SELECT id FROM models WHERE import_key = ?").get(m.importKey);
      const ts = new Date().toISOString();
      if (existing) {
        // Clear all default flags, then re-set claimed slots
        db.prepare(
          "UPDATE models SET is_default_agent=0,is_default_hindsight=0,is_default_compression=0," +
          "is_default_vision=0,is_default_web_extract=0,is_default_session_search=0," +
          "is_default_title_generation=0,is_default_skills_hub=0,is_default_mcp=0," +
          "is_default_triage_specifier=0,is_default_approval=0,is_default_delegation=0," +
          "updated_at=? WHERE id=?"
        ).run(ts, existing.id);
        for (const slot of m.defaultSlots) {
          db.prepare(`UPDATE models SET is_default_${slot}=1, updated_at=? WHERE id=?`).run(ts, existing.id);
        }
      } else {
        const id = uuid();
        db.prepare(
          "INSERT INTO models (id,name,provider,model_id,base_url,context_length,credentials_id,import_key," +
          "is_default_agent,is_default_hindsight,is_default_compression,is_default_vision," +
          "is_default_web_extract,is_default_session_search,is_default_title_generation," +
          "is_default_skills_hub,is_default_mcp,is_default_triage_specifier,is_default_approval," +
          "is_default_delegation,created_at,updated_at)" +
          " VALUES (?,?,?,?,?,NULL,NULL,?,0,0,0,0,0,0,0,0,0,0,0,0,?,?)"
        ).run(id, m.name, m.provider, m.modelId, m.baseUrl, m.importKey, ts, ts);
        for (const slot of m.defaultSlots) {
          db.prepare(`UPDATE models SET is_default_${slot}=1 WHERE id=?`).run(id);
        }
      }
      modelsUpserted++;
    }
  });
  upsertAll();

  // Upsert credentials
  const usedProviders = new Set(Array.from(modelsToUpsert.values()).map((m) => m.provider));
  let credsUpserted = 0;
  for (const [envVar, apiKey] of envVars) {
    const prov = envToProvider.get(envVar);
    if (!prov || !usedProviders.has(prov) || !apiKey) continue;
    const existing = db.prepare("SELECT id, api_key FROM credentials WHERE provider = ?").get(prov);
    const ts = new Date().toISOString();
    if (existing) {
      if (existing.api_key !== apiKey) {
        db.prepare("UPDATE credentials SET api_key=?,key_hint=?,updated_at=? WHERE id=?").run(
          apiKey,
          keyHint(apiKey),
          ts,
          existing.id
        );
      }
    } else {
      db.prepare(
        "INSERT INTO credentials (id,label,provider,api_key,key_hint,created_at,updated_at)" +
        " VALUES (?,?,?,?,?,?,?)"
      ).run(uuid(), `${prov} key`, prov, apiKey, keyHint(apiKey), ts, ts);
    }
    credsUpserted++;
  }

  console.log(`✓ Hermes model import: ${modelsUpserted} model(s), ${credsUpserted} credential(s)`);
} catch (err) {
  // Non-fatal — hermes-import is best-effort during prebuild
  console.warn(`⚠  Hermes model import skipped: ${err}`);
}

db.close();
