// ═══════════════════════════════════════════════════════════════
// hermes-env-sync.ts: write-through to ~/.hermes/.env
//
// Split out of config-sync.ts, which now owns only config.yaml.
// Without this module, `hermes chat --model X` would fail because
// Hermes cannot resolve credentials: every credential mutation in
// /api/credentials writes the plaintext key here, and Hermes reads it
// from .env rather than from any config.yaml `api_key` field (which
// the config.yaml writers deliberately reset to the empty string).
//
// The file format is a user's file, not ours. `serializeEnvFile`
// therefore preserves ordering, blank lines and `#` comments
// verbatim, and appends only what is genuinely new.
//
// `parseEnvFile` and the `ENV_LINE_RE` regex live in `@/lib/env-file`
// (shared with `@/modules/hermes/lib/config-import.ts`). They were
// promoted from this module's private implementation in session 164
// because the same parser was duplicated across 2 files.
// `serializeEnvFile` can't call `parseEnvFile` directly, because that
// would throw away the comments, so it reaches for the shared `ENV_LINE_RE`
// to identify keyval lines while iterating the raw file content.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";

import { ensureDir } from "@/lib/fs/fs-helpers";
import { parseEnvFile, ENV_LINE_RE } from "@/lib/env-file";
import { getActiveHermesPaths } from "./agent-runtime";
import { envVarForProvider, isHermesProvider, type HermesProvider } from "./providers";
import { atomicWriteFile, backupFile } from "./hermes-config-write";

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
 *
 * @public Kept exported for tests/unit/hermes-config-sync-env.test.ts, which
 * reaches it through `require("@/modules/hermes/lib/hermes-env-sync")`. knip
 * does not follow a path-aliased `require()`, so it reports this as unused;
 * deleting it would break that suite.
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
