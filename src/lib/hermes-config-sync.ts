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
import { modelKey } from "./model-key";
import { toError } from "./api-fetch";
import { backupFile as backupFileShared, ensureDir } from "./fs-helpers";
import { parseFallbackAgentSettingsFromYaml } from "./fallback-config-yaml";
import { parseEnvFile, ENV_LINE_RE } from "./env-file";
import type { FallbackConfigPutInput } from "./fallback-config-schema";

/**
 * Read `~/.hermes/config.yaml` and return the parsed YAML object, or
 * `null` if the file is missing or unparseable. Single source of truth
 * for the "existsSync + readFileSync + yaml.load + try/catch fallback"
 * pattern that was duplicated across 5 sites (this module, the drift
 * detector, the per-model diff route, and the fallbacks/import GET/POST).
 *
 * Byte-equivalence: callers that previously did
 *   `yaml.load(raw) as HermesConfig ?? {}`
 * get `null` instead and must handle the missing-file case explicitly —
 * a more honest contract than silently substituting an empty object
 * (which previously masked missing files in 2 of the 5 sites).
 */
export function readHermesYamlConfig<T = Record<string, unknown>>(): T | null {
  const paths = getActiveHermesPaths();
  if (!existsSync(paths.config)) return null;
  try {
    const raw = readFileSync(paths.config, "utf-8");
    return (yaml.load(raw) as T) ?? null;
  } catch {
    return null;
  }
}

/**
 * Parse a YAML string into a HermesConfig, treating empty/whitespace-only
 * content as an empty object. The 3 callers that previously wrote
 *   `original ? ((yaml.load(original) as HermesConfig) ?? {}) : {}`
 * inline (syncDefaultsToHermesConfig's tail, syncSingleModelToHermesConfig,
 * syncFallbacksToHermesConfig) all want the same "empty-string → {}" short
 * circuit. Centralises the load + empty-fallback so a future parser tweak
 * (e.g. swapping js-yaml for a different library) lands in one place.
 *
 * **Does NOT catch parse errors** — the three pre-refactor sites all
 * allowed yaml.load throws to propagate, so this helper matches that
 * behaviour. The exception is `syncDefaultsToHermesConfig`, which has a
 * custom try/catch that *surfaces* the parse error to server logs and
 * skips the write to avoid corrupting the on-disk file. That site stays
 * inline (with a comment pointing here) because the recovery logic is
 * specific to "must not overwrite a partially-written file".
 */
export function loadHermesConfigFromString(content: string): HermesConfig {
  if (!content) return {};
  return (yaml.load(content) as HermesConfig) ?? {};
}

/**
 * Serialize a value to YAML using the canonical PatterStage options:
 *   - `lineWidth: -1` — no automatic line wrapping; long strings/URLs stay on
 *     one line (matches the historical hand-edited config.yaml style)
 *   - `noRefs: true` — never emit YAML anchors/aliases (`&a001` / `*a001`),
 *     even when the same object is referenced twice in the input
 *
 * Single source of truth for `yaml.dump(..., { lineWidth: -1, noRefs: true })`
 * which was duplicated across 5 sites (3 in this module, 1 in
 * `src/app/api/config/route.ts`, 1 in `src/lib/profile-config-builder.ts`).
 * Byte-equivalent to the inline form for every reachable input — same string.
 */
export function dumpYamlConfig(value: unknown): string {
  return yaml.dump(value, { lineWidth: -1, noRefs: true });
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
  return backupFileShared(originalPath, backupsDir);
}

// ── ENV (.env) sync ────────────────────────────────────────────
//
// `parseEnvFile` and the `ENV_LINE_RE` regex now live in
// `@/lib/env-file` (shared with `@/lib/hermes-import.ts`). They were
// promoted from this module's private implementation in session 164
// because the same parser was duplicated across 2 files. The sibling
// `serializeEnvFile` (this module) preserves blank lines and `#`
// comments verbatim, so it can't call `parseEnvFile` directly — it
// reaches for the shared `ENV_LINE_RE` to identify keyval lines while
// iterating the raw file content.

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
  const config = readHermesYamlConfig<Record<string, unknown>>();
  if (!config) return new Map();

  try {
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
      map.set(modelKey(primary.provider, primary.modelId), primary);
    }

    // Auxiliary sections
    const aux = config.auxiliary as Record<string, ConfigModelSlice> | undefined;
    for (const entry of Object.values(aux ?? {})) {
      const parsed = entryFromSlice(entry);
      if (parsed) {
        map.set(modelKey(parsed.provider, parsed.modelId), parsed);
      }
    }

    // Fallback providers chain — models used as fallbacks
    const fallback = config.fallback_providers as ConfigModelSlice[] | undefined;
    for (const entry of fallback ?? []) {
      const parsed = entryFromSlice(entry);
      if (parsed) {
        const key = modelKey(parsed.provider, parsed.modelId);
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
 * Read ~/.hermes/config.yaml, set `model.*` from PatterStage DB's default
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
  // Inline (not `loadHermesConfigFromString`) because this site needs
  // custom parse-error handling — we must not overwrite a partially-
  // corrupted file. The helper has the same happy path; the catch
  // block is the only reason this isn't a one-liner.
  let config: HermesConfig;
  try {
    config = original ? ((yaml.load(original) as HermesConfig) ?? {}) : {};
  } catch (err) {
    // If the YAML is malformed (e.g. duplicated keys from a prior failed write),
    // yaml.load throws and we cannot safely write a merged config. Report the
    // backing error so it surfaces in server logs but do NOT write a corrupted
    // file — return the backup path so the caller can surface a meaningful error.
    const msg = toError(err).message || String(err);
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

  const serialized = dumpYamlConfig(config);
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
 * Re-apply the full PatterStage DB state to Hermes. Called after every
 * model/credential mutation so the on-disk Hermes config stays in lock
 * step with the PatterStage DB.
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
  const config: HermesConfig = loadHermesConfigFromString(original);

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

  const serialized = dumpYamlConfig(config);
  atomicWriteFile(configPath, serialized);

  return { backupPath };
}

// ── Per-credential sync to .env ──────────────────────────────

/**
 * Read `agent.*` fallback fields from on-disk config.yaml (post-write verify).
 * Thin wrapper over `parseFallbackAgentSettingsFromYaml` — keeps the file I/O
 * + YAML parse + null-on-missing-file contract at this layer and delegates
 * the field-mapping + clamp (apiMaxRetries → 0..10) to the single source of
 * truth. Previously this function duplicated the field extraction AND
 * skipped the clamp, which let a corrupt on-disk value (e.g. apiMaxRetries
 * 15) slip past `assertFallbackAgentSettingsWritten`'s "matches expected"
 * check silently. Now both the import path (read Hermes → DB) and the
 * read-back path enforce the same 0..10 contract defined by the Zod
 * schema (`fallbackConfigPutSchema`).
 */
export function readFallbackAgentSettingsFromConfig(
  configPath?: string,
): FallbackConfigPutInput | null {
  const paths = getActiveHermesPaths();
  const target = configPath ?? paths.config;
  if (!existsSync(target)) return null;

  try {
    const raw = readFileSync(target, "utf-8");
    const yamlConfig = (yaml.load(raw) as HermesConfig) ?? {};
    return parseFallbackAgentSettingsFromYaml(yamlConfig.agent);
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
  const yamlConfig: HermesConfig = loadHermesConfigFromString(original);

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

  const serialized = dumpYamlConfig(yamlConfig);
  atomicWriteFile(configPath, serialized);

  assertFallbackAgentSettingsWritten(configPath, {
    apiMaxRetries: config.apiMaxRetries,
    restorePrimaryOnFallback: config.restorePrimaryOnFallback,
    fallbackNotification: config.fallbackNotification,
  });

  return { backupPath, configPath, hermesHome: paths.root };
}
