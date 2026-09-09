// config-cache — cached reads of ~/.hermes/config.yaml. GET /api/config reads
// the file 5-10× per page load at ~3-8ms each (yaml.parse dominates); a
// SQLite-meta-keyed JSON cache with a 15s TTL brings that to ~0.1ms.
//
// The keys live here, the SQL does not: the `meta` table has one repository
// (system-repository.ts), shared with the scheduler lease. Every failure is
// best-effort and falls through to the on-disk read: a missing `meta` table
// (fresh DB), a stale `cached_at`, corrupt cache JSON, or a failed cache write.

import { existsSync, readFileSync } from "fs";
import yaml from "js-yaml";

import { getAgentWorkspace } from "./runtime/workspace";
import { deleteMetaPair, getMetaPair, setMultipleStats } from "./system-repository";

const CACHE_TTL_MS = 15_000;

const CACHE_KEY_JSON = "config.cached_json";
const CACHE_KEY_AT = "config.cached_at";

/**
 * The cached config, or null when missing, stale, unreadable or unparseable;
 * the caller then reads disk and re-populates via `writeConfigCache`.
 */
function readConfigCache(): Record<string, unknown> | null {
  try {
    const rows = getMetaPair(CACHE_KEY_JSON, CACHE_KEY_AT);

    const cachedJson = rows.find((r) => r.key === CACHE_KEY_JSON)?.value;
    const cachedAt = rows.find((r) => r.key === CACHE_KEY_AT)?.value;

    if (!cachedJson || !cachedAt) return null;

    const age = Date.now() - new Date(cachedAt).getTime();
    if (age >= CACHE_TTL_MS) return null;

    return JSON.parse(cachedJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Both keys in one transaction, so a partial write cannot leave json without a
 * timestamp. Failures are swallowed: the next read re-reads disk.
 */
function writeConfigCache(config: Record<string, unknown>): void {
  try {
    setMultipleStats({
      [CACHE_KEY_JSON]: JSON.stringify(config),
      [CACHE_KEY_AT]: new Date().toISOString(),
    });
  } catch {
    // Cache write failure is non-critical
  }
}

/**
 * The config, AND whether the file on disk failed to read or parse.
 * `readCachedConfig` is this with the error dropped: right for a render path,
 * wrong for anything deciding whether to let the operator hit Save (T-0064).
 *
 * THE READ IS INSIDE THE TRY. It used to guard yaml.load alone, so a file that
 * existed but could not be OPENED (EACCES, EISDIR, EBUSY on Windows) threw
 * through a function whose contract is to report trouble in `error`: a
 * permission problem on config.yaml 500ed GET /api/models/defaults and blanked
 * the whole Models page for data that lives in SQLite. Unreadable and
 * unparseable are the same fact to every caller.
 */
export function readCachedConfigResult(): {
  config: Record<string, unknown>;
  error: string | null;
} {
  const cached = readConfigCache();
  if (cached) return { config: cached, error: null };

  const configPath = getAgentWorkspace().config;
  if (!existsSync(configPath)) return { config: {}, error: null };

  let config: Record<string, unknown>;
  try {
    const content = readFileSync(configPath, "utf-8");
    config = (yaml.load(content) as Record<string, unknown>) || {};
  } catch (err) {
    // First line only, as PUT /api/config does: the rest of a js-yaml message
    // quotes the offending LINES of config.yaml, which holds api_key values.
    const message = err instanceof Error ? err.message : String(err);
    return { config: {}, error: message.split("\n")[0] };
  }

  writeConfigCache(config);
  return { config, error: null };
}

/**
 * The same read with the verdict dropped, for render paths. Delegates rather
 * than repeats: the two copies were identical apart from the error return, and
 * only one was fixed last time the failure handling moved (T-0064).
 */
export function readCachedConfig(): Record<string, unknown> {
  return readCachedConfigResult().config;
}

/** The PUT handler calls this after a write, so the next GET sees it without waiting out the TTL. */
export function invalidateConfigCache(): void {
  try {
    deleteMetaPair(CACHE_KEY_JSON, CACHE_KEY_AT);
  } catch {
    // Cache invalidation failure is non-critical
  }
}
