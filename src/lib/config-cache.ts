// ══════════════════════════════════════════════════════════════════════════════
// config-cache — cached reads of ~/.hermes/config.yaml
// ══════════════════════════════════════════════════════════════════════════════
//
// Hot-path GET /api/config reads `~/.hermes/config.yaml` 5-10× per page load
// (config index + 1-2 section editor loads). The yaml.parse() + readFileSync
// chain costs ~3-8ms per call, dominated by yaml.parse. A SQLite-meta-keyed
// JSON cache (15s TTL) brings the steady-state cost to ~0.1ms.
//
// The cache is intentionally a separate module from `/api/config/route.ts`
// for two reasons:
//   1. The cache key strings ("config.cached_json", "config.cached_at") are
//      repeated 4× in the route — centralising them here reduces 4 strings
//      to 1 const, and a future "switch to Redis" or "switch to memjs" can
//      replace the read/write functions in this file without touching the
//      route.
//      The keys stay here; the SQL does not. The `meta` table has one
//      repository (system-repository.ts), shared with the scheduler
//      lease, so there is a single answer to "how is a meta row written".
//   2. The cache shape (read + invalidate pair) is a 2-method API — moving
//      it out of the route shrinks the route from 215 lines to ~190 lines
//      and keeps the request handler focused on HTTP shape.
//
// All failures are best-effort: a missing `meta` table (fresh DB before
// migrations run), a stale `cached_at` (TTL expired), or a corrupt cache
// JSON all fall through to the on-disk read. Cache write failures are
// silently swallowed — a missing cache just means the next read goes back
// to the filesystem, which is the same path the cache miss would have
// taken anyway.

import { existsSync, readFileSync } from "fs";
import yaml from "js-yaml";

import { getAgentWorkspace } from "./runtime/workspace";
import { deleteMetaPair, getMetaPair, setMultipleStats } from "./system-repository";

const CACHE_TTL_MS = 15_000; // 15 seconds

const CACHE_KEY_JSON = "config.cached_json";
const CACHE_KEY_AT = "config.cached_at";

/**
 * Read the cached config object, or null if the cache is missing, stale,
 * unreadable, or unparseable. The 4xx->null fallback chain is intentional:
 * the caller will then read from disk (which always works) and re-populate
 * the cache via `writeConfigCache`.
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
    // Cache read failed — fall through to filesystem
    return null;
  }
}

/**
 * Write the parsed config to the cache. Both keys are written in a single
 * transaction so a partial write can't leave the cache in a "has json but
 * no timestamp" state. Failures are silently swallowed (the next read
 * just re-reads from disk and re-populates).
 */
function writeConfigCache(config: Record<string, unknown>): void {
  try {
    // setMultipleStats is the same statement in the same transaction,
    // run for each entry in insertion order — json first, then the
    // timestamp, exactly as the inline version did.
    setMultipleStats({
      [CACHE_KEY_JSON]: JSON.stringify(config),
      [CACHE_KEY_AT]: new Date().toISOString(),
    });
  } catch {
    // Cache write failure is non-critical
  }
}

/**
 * Read the full config from cache (if fresh) or filesystem (if miss/stale).
 * The filesystem branch also re-populates the cache so the next call is
 * fast. Returns an empty object when the file does not exist or fails to
 * parse — matching the pre-extraction behaviour.
 */
export function readCachedConfig(): Record<string, unknown> {
  const cached = readConfigCache();
  if (cached) return cached;

  const configPath = getAgentWorkspace().config;

  if (!existsSync(configPath)) {
    return {};
  }

  const content = readFileSync(configPath, "utf-8");
  let config: Record<string, unknown>;
  try {
    config = (yaml.load(content) as Record<string, unknown>) || {};
  } catch {
    // YAML parse error — return empty config rather than crashing
    return {};
  }

  writeConfigCache(config);
  return config;
}

/**
 * Invalidate the cache so the next read goes back to disk. Called from the
 * PUT handler after a successful write to make the change visible on the
 * next GET without waiting for TTL expiry.
 */
export function invalidateConfigCache(): void {
  try {
    deleteMetaPair(CACHE_KEY_JSON, CACHE_KEY_AT);
  } catch {
    // Cache invalidation failure is non-critical
  }
}
