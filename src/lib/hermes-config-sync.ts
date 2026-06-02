// ═══════════════════════════════════════════════════════════════
// hermes-config-sync.ts — Write-through to ~/.hermes/.env + config.yaml
// ═══════════════════════════════════════════════════════════════
//
// Without this module, `hermes chat --model X` would fail because
// Hermes can't resolve credentials. Every credential mutation in
// /api/credentials and every default-set in /api/models/defaults must
// run through these helpers (PR 7 wires them up).
//
// Guarantees:
//   - atomic writes via tmpfile + fs.renameSync
//   - timestamped backups under <root>/backups/ before any write
//   - idempotent: re-applying the same input produces the same file

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import * as yaml from "js-yaml";

import { getActiveHermesPaths } from "./hermes-agent-runtime";
import {
  AUXILIARY_TASK_TYPES,
  envVarForProvider,
  isHermesProvider,
  type HermesProvider,
} from "./hermes-providers";
import { updateAgentRoot } from "./agent-root-repository";
import { getModelDefaults, getModel } from "./models-repository";

// ── Internal helpers ───────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function backupTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Atomic write: stage to a sibling tmpfile, then rename. fs.rename on
 * POSIX is atomic for same-volume operations. Caller must ensure dir
 * exists.
 */
export function atomicWriteFile(targetPath: string, content: string): void {
  const tmpPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(tmpPath, content, { encoding: "utf-8" });
    renameSync(tmpPath, targetPath);
  } catch (err) {
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch {
        // best-effort cleanup; surface the original error below
      }
    }
    throw err;
  }
}

function backupFile(originalPath: string, backupsDir: string): string | null {
  if (!existsSync(originalPath)) return null;
  ensureDir(backupsDir);
  const base = originalPath.split(/[/\\]/).pop() ?? "file";
  const target = `${backupsDir}/${base}.${backupTimestamp()}.bak`;
  writeFileSync(target, readFileSync(originalPath, "utf-8"), { encoding: "utf-8" });
  return target;
}

// ── ENV (.env) sync ────────────────────────────────────────────

const ENV_LINE_RE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

function parseEnvFile(content: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const m = ENV_LINE_RE.exec(line);
    if (!m) continue;
    out.set(m[1], m[2]);
  }
  return out;
}

function serializeEnvFile(
  prior: Map<string, string>,
  next: Map<string, string>,
  originalContent: string
): string {
  // Strategy: keep the user's original ordering and any comments/blank
  // lines, then update or remove keys, then append any newly added keys
  // at the end.
  const seen = new Set<string>();
  const lines = originalContent.split(/\r?\n/);
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw;
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      out.push(line);
      continue;
    }
    const m = ENV_LINE_RE.exec(trimmed);
    if (!m) {
      out.push(line);
      continue;
    }
    const key = m[1];
    if (!next.has(key)) {
      // key removed — drop the line
      continue;
    }
    seen.add(key);
    out.push(`${key}=${next.get(key)!}`);
  }
  for (const [k, v] of next) {
    if (seen.has(k)) continue;
    if (prior.has(k)) continue; // shouldn't happen, but defensive
    out.push(`${k}=${v}`);
  }
  if (out.length === 0 || out[out.length - 1].length !== 0) {
    out.push("");
  }
  return out.join("\n");
}

export interface SyncCredentialInput {
  provider: HermesProvider;
  apiKey: string;
}

/**
 * Write `<PROVIDER>_API_KEY=<plaintext>` into ~/.hermes/.env. Atomic +
 * backed-up. Returns the path of the backup created (if any) for tests.
 */
export function syncCredentialToHermesEnv(input: SyncCredentialInput): { backupPath: string | null } {
  if (!isHermesProvider(input.provider)) {
    throw new Error(`Unknown provider: ${input.provider}`);
  }
  const paths = getActiveHermesPaths();
  const envPath = paths.env;

  // OAuth-only providers (e.g. nous) have no env var — nothing to write.
  const envVar = envVarForProvider(input.provider);
  if (!envVar) {
    throw new Error(`Provider "${input.provider}" uses OAuth -- no API key env var to write`);
  }

  ensureDir(paths.root);
  const backupPath = backupFile(envPath, paths.backups);

  const original = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";
  const prior = parseEnvFile(original);
  const next = new Map(prior);
  next.set(envVar, input.apiKey);

  atomicWriteFile(envPath, serializeEnvFile(prior, next, original));

  return { backupPath };
}

/**
 * Remove all rows for a given provider's API key from ~/.hermes/.env.
 * Used when a credential is deleted — we can only target the env var
 * tied to the credential's provider; if multiple credentials share the
 * same provider, the caller (PR 7) must repick a winner before calling.
 */
export function removeCredentialFromHermesEnv(provider: HermesProvider): { backupPath: string | null } {
  if (!isHermesProvider(provider)) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  const paths = getActiveHermesPaths();
  if (!existsSync(paths.env)) return { backupPath: null };
  const backupPath = backupFile(paths.env, paths.backups);

  const original = readFileSync(paths.env, "utf-8");
  const prior = parseEnvFile(original);
  const next = new Map(prior);
  const envVar = envVarForProvider(provider);
  // OAuth-only providers (e.g. nous) have no .env key — nothing to remove
  if (!envVar) return { backupPath };
  next.delete(envVar);

  atomicWriteFile(paths.env, serializeEnvFile(prior, next, original));
  return { backupPath };
}

// ── config.yaml sync ───────────────────────────────────────────

interface AuxiliarySection {
  provider?: string;
  model?: string;
  base_url?: string;
  api_key?: string;
  timeout?: number;
}

interface HermesConfig {
  model?: { default?: string; provider?: string; base_url?: string; api_key?: string; context_length?: number };
  auxiliary?: Record<string, AuxiliarySection>;
  fallback_providers?: Array<{ provider: string; model: string; base_url?: string; api_key?: string }>;
  [key: string]: unknown;
}

/**
 * Collect every unique (provider, modelId) pair currently written in
 * config.yaml's model.* + auxiliary.* + fallback_providers.* sections.
 *
 * Shared by sync-manager.ts (drift detection) and the sync/pull route
 * (per-model pull from Hermes config → DB).
 */
export interface HermesConfigModelEntry {
  modelId: string;
  provider: string;
  baseUrl: string | null;
  contextLength: number | null;
}

export function readHermesConfigModels(): Map<string, HermesConfigModelEntry> {
  const paths = getActiveHermesPaths();
  if (!existsSync(paths.config)) return new Map();

  try {
    const raw = readFileSync(paths.config, "utf-8");
    const config = (yaml.load(raw) as Record<string, unknown> | null) ?? {};
    const map = new Map<string, HermesConfigModelEntry>();

    type ConfigModelSlice = {
      default?: string;
      model?: string;
      provider?: string;
      base_url?: string;
      context_length?: number;
    };

    const entryFromSlice = (slice: ConfigModelSlice): HermesConfigModelEntry | null => {
      const modelId = slice.default ?? slice.model;
      if (!modelId || !slice.provider) return null;
      return {
        modelId,
        provider: slice.provider,
        baseUrl: slice.base_url?.trim() || null,
        contextLength:
          typeof slice.context_length === "number" ? slice.context_length : null,
      };
    };

    // Primary model section
    const model = config.model as ConfigModelSlice | undefined;
    const primary = model ? entryFromSlice(model) : null;
    if (primary) {
      map.set(`${primary.provider}::${primary.modelId}`, primary);
    }

    // Auxiliary sections
    const aux = config.auxiliary as Record<string, ConfigModelSlice> | undefined;
    for (const entry of Object.values(aux ?? {})) {
      const parsed = entryFromSlice(entry);
      if (parsed) {
        map.set(`${parsed.provider}::${parsed.modelId}`, parsed);
      }
    }

    // Fallback providers chain — models used as fallbacks
    const fallback = config.fallback_providers as ConfigModelSlice[] | undefined;
    for (const entry of fallback ?? []) {
      const parsed = entryFromSlice(entry);
      if (parsed) {
        const key = `${parsed.provider}::${parsed.modelId}`;
        if (!map.has(key)) {
          map.set(key, parsed);
        }
      }
    }

    return map;
  } catch {
    return new Map();
  }
}

/** Auxiliary slots written through to `auxiliary.<task>.*`.
 *  See `AUXILIARY_TASK_TYPES` in `@/lib/hermes-providers` (canonical). */

/**
 * Read ~/.hermes/config.yaml, set `model.*` from Control Hub DB's default
 * `agent` model and `auxiliary.<task>.{model, provider, base_url, api_key}`
 * for each of the 11 auxiliary slots, then write back atomically with a
 * pre-write backup.
 *
 * `model.api_key` and `auxiliary.<task>.api_key` are reset to the empty
 * string so Hermes resolves the key from .env (canonical posture).
 */
export function syncDefaultsToHermesConfig(): { backupPath: string | null } {
  const paths = getActiveHermesPaths();
  ensureDir(paths.root);
  const configPath = paths.config;
  const backupPath = backupFile(configPath, paths.backups);

  const original = existsSync(configPath) ? readFileSync(configPath, "utf-8") : "";
  let config: HermesConfig;
  try {
    config = original ? ((yaml.load(original) as HermesConfig) ?? {}) : {};
  } catch (err) {
    // If the YAML is malformed (e.g. duplicated keys from a prior failed write),
    // yaml.load throws and we cannot safely write a merged config. Report the
    // backing error so it surfaces in server logs but do NOT write a corrupted
    // file — return the backup path so the caller can surface a meaningful error.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[syncDefaultsToHermesConfig] yaml.load failed: ${msg} — not overwriting ${configPath}`);
    console.error(`[syncDefaultsToHermesConfig] Backup at: ${backupPath}. Please repair the YAML and retry.`);
    return { backupPath };
  }

  const defaults = getModelDefaults();

  // ── Primary agent model
  const agentDefault = defaults.agent ? getModel(defaults.agent) : null;
  if (agentDefault) {
    config.model = {
      ...(config.model ?? {}),
      default: agentDefault.modelId,
      provider: agentDefault.provider,
      base_url: agentDefault.baseUrl ?? "",
      api_key: "",
      context_length: agentDefault.contextLength ?? config.model?.context_length,
    };
  }

  // ── 11 auxiliary slots
  const aux: Record<string, AuxiliarySection> = { ...(config.auxiliary ?? {}) };
  for (const slot of AUXILIARY_TASK_TYPES) {
    const modelId = defaults[slot];
    if (!modelId) continue;
    const m = getModel(modelId);
    if (!m) continue;
    aux[slot] = {
      ...(aux[slot] ?? {}),
      provider: m.provider,
      model: m.modelId,
      base_url: m.baseUrl ?? "",
      api_key: "",
    };
  }
  if (Object.keys(aux).length > 0) {
    config.auxiliary = aux;
  }

  const serialized = yaml.dump(config, { lineWidth: -1, noRefs: true });
  atomicWriteFile(configPath, serialized);

  return { backupPath };
}

export interface FinalizeRootConfigResult {
  /** Whether `model_defaults.agent` was applied to disk. */
  appliedModelDefaults: boolean;
  backupPath: string | null;
}

/**
 * After profile push writes skills/toolsets, re-apply Models registry defaults
 * to `model` / `auxiliary` on disk and refresh `agent_root.config_yaml` so the
 * next push does not strip the model section.
 */
export function finalizeRootConfigOnDisk(): FinalizeRootConfigResult {
  const defaults = getModelDefaults();
  const appliedModelDefaults = Boolean(defaults.agent);
  const { backupPath } = syncDefaultsToHermesConfig();

  const paths = getActiveHermesPaths();
  if (existsSync(paths.config)) {
    const fullYaml = readFileSync(paths.config, "utf-8");
    updateAgentRoot({ configYaml: fullYaml });
  }

  return { appliedModelDefaults, backupPath };
}

// ── Combined helper used by API routes ─────────────────────────

/**
 * Re-apply the full Control Hub DB state to Hermes. Called after every
 * model/credential mutation so the on-disk Hermes config stays in lock
 * step with the Control Hub DB.
 */
export function syncAllToHermes(): { envBackup: string | null; configBackup: string | null } {
  // .env writes happen per-provider, but here we don't have a single
  // credential — the calling route is responsible for the env write
  // when a credential mutates. This helper only refreshes config.yaml.
  const { backupPath } = syncDefaultsToHermesConfig();
  return { envBackup: null, configBackup: backupPath };
}

// ── Single model sync to Hermes config ─────────────────────

/**
 * Update only the `model.*` section of ~/.hermes/config.yaml
 * for a single model, leaving auxiliary slots untouched.
 * Used by the per-model Push button.
 */
export function syncSingleModelToHermesConfig(modelId: string): { backupPath: string | null } {
  const paths = getActiveHermesPaths();
  const configPath = paths.config;
  const backupPath = backupFile(configPath, paths.backups);

  const original = existsSync(configPath) ? readFileSync(configPath, "utf-8") : "";
  const config: HermesConfig = original
    ? ((yaml.load(original) as HermesConfig) ?? {})
    : {};

  const model = getModel(modelId);
  if (model) {
    config.model = {
      ...(config.model ?? {}),
      default: model.modelId,
      provider: model.provider,
      base_url: model.baseUrl ?? "",
      api_key: "",
      context_length: model.contextLength ?? config.model?.context_length,
    };
  }

  const serialized = yaml.dump(config, { lineWidth: -1, noRefs: true });
  atomicWriteFile(configPath, serialized);

  return { backupPath };
}

// ── Per-credential sync to .env ──────────────────────────────

interface FallbackAgentSettingsFromDisk {
  apiMaxRetries?: number;
  restorePrimaryOnFallback?: boolean;
  fallbackNotification?: boolean;
}

/**
 * Read `agent.*` fallback fields from on-disk config.yaml (post-write verify).
 */
export function readFallbackAgentSettingsFromConfig(
  configPath?: string,
): FallbackAgentSettingsFromDisk | null {
  const paths = getActiveHermesPaths();
  const target = configPath ?? paths.config;
  if (!existsSync(target)) return null;

  try {
    const raw = readFileSync(target, "utf-8");
    const yamlConfig = (yaml.load(raw) as HermesConfig) ?? {};
    const agent = yamlConfig.agent as Record<string, unknown> | undefined;
    if (!agent) return {};
    const out: FallbackAgentSettingsFromDisk = {};
    if (typeof agent.api_max_retries === "number") {
      out.apiMaxRetries = agent.api_max_retries;
    }
    if (typeof agent.restore_primary_on_fallback === "boolean") {
      out.restorePrimaryOnFallback = agent.restore_primary_on_fallback;
    }
    if (typeof agent.fallback_notification === "boolean") {
      out.fallbackNotification = agent.fallback_notification;
    }
    return out;
  } catch {
    return null;
  }
}

function assertFallbackAgentSettingsWritten(
  configPath: string,
  expected: {
    apiMaxRetries?: number | null;
    restorePrimaryOnFallback?: boolean;
    fallbackNotification?: boolean;
  },
): void {
  const readBack = readFallbackAgentSettingsFromConfig(configPath);
  if (!readBack) {
    throw new Error("Failed to read back config.yaml after fallback sync");
  }
  if (expected.apiMaxRetries !== undefined && readBack.apiMaxRetries !== expected.apiMaxRetries) {
    throw new Error(
      `config.yaml api_max_retries mismatch: expected ${expected.apiMaxRetries}, got ${readBack.apiMaxRetries ?? "missing"}`,
    );
  }
  if (
    expected.restorePrimaryOnFallback !== undefined &&
    readBack.restorePrimaryOnFallback !== expected.restorePrimaryOnFallback
  ) {
    throw new Error("config.yaml restore_primary_on_fallback did not persist");
  }
  if (
    expected.fallbackNotification !== undefined &&
    readBack.fallbackNotification !== expected.fallbackNotification
  ) {
    throw new Error("config.yaml fallback_notification did not persist");
  }
}

/**
 * Write the fallback chain and behavioural config entries to
 * ~/.hermes/config.yaml as `fallback_providers` (chain) +
 * `agent.api_max_retries`, `agent.restore_primary_on_fallback`,
 * `agent.fallback_notification`.
 */
export function syncFallbacksToHermesConfig(
  chain: Array<{ modelId: string; provider: string; baseUrl: string | null; apiKey: string | null; overrideBaseUrl?: string | null }>,
  config: {
    restorePrimaryOnFallback?: boolean;
    fallbackNotification?: boolean;
    apiMaxRetries?: number;
  }
): { backupPath: string | null; configPath: string; hermesHome: string } {
  const paths = getActiveHermesPaths();
  const configPath = paths.config;
  ensureDir(paths.root);
  const backupPath = backupFile(configPath, paths.backups);

  const original = existsSync(configPath) ? readFileSync(configPath, "utf-8") : "";
  const yamlConfig: HermesConfig = original
    ? ((yaml.load(original) as HermesConfig) ?? {})
    : {};

  // Write fallback_providers chain
  yamlConfig.fallback_providers = chain.map(
    (entry): { provider: string; model: string; base_url?: string; api_key?: string } => {
      const result: { provider: string; model: string; base_url?: string; api_key?: string } = {
        provider: entry.provider,
        model: entry.modelId,
      };
      const url = entry.overrideBaseUrl || entry.baseUrl;
      if (url) result.base_url = url;
      if (entry.apiKey) result.api_key = entry.apiKey;
      return result;
    },
  );

  // Write agent behavioural settings
  const agentSection: Record<string, unknown> = { ...(yamlConfig.agent ?? {}) };
  if (config.apiMaxRetries !== undefined) agentSection.api_max_retries = config.apiMaxRetries;
  if (config.restorePrimaryOnFallback !== undefined) agentSection.restore_primary_on_fallback = config.restorePrimaryOnFallback;
  if (config.fallbackNotification !== undefined) agentSection.fallback_notification = config.fallbackNotification;
  yamlConfig.agent = agentSection;

  const serialized = yaml.dump(yamlConfig, { lineWidth: -1, noRefs: true });
  atomicWriteFile(configPath, serialized);

  assertFallbackAgentSettingsWritten(configPath, {
    apiMaxRetries: config.apiMaxRetries,
    restorePrimaryOnFallback: config.restorePrimaryOnFallback,
    fallbackNotification: config.fallbackNotification,
  });

  return { backupPath, configPath, hermesHome: paths.root };
}
