import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import yaml from "js-yaml";

import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";
import { requireAuth } from "@/lib/api-auth";
import { appendAuditLine } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { CONFIG_SECTIONS } from "@/lib/config-schema";
import { maskApiKey } from "@/lib/secret-mask";
import { parseJsonBody } from "@/lib/parse-json-body";

const CACHE_TTL_MS = 15_000; // 15 seconds

function readCachedConfig(): Record<string, unknown> {
  const configPath = getActiveHermesPaths().config;

  // Try meta table cache first — single query for both keys
  try {
    const rows = db()
      .prepare("SELECT key, value FROM meta WHERE key IN ('config.cached_json', 'config.cached_at')")
      .all() as { key: string; value: string }[];

    const cachedJson = rows.find((r) => r.key === "config.cached_json")?.value;
    const cachedAt = rows.find((r) => r.key === "config.cached_at")?.value;

    if (cachedJson && cachedAt) {
      const age = Date.now() - new Date(cachedAt).getTime();
      if (age < CACHE_TTL_MS) {
        return JSON.parse(cachedJson) as Record<string, unknown>;
      }
    }
  } catch {
    // Cache read failed — fall through to filesystem
  }

  // Cache miss or stale — read from filesystem
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

  // Update cache (both keys in a transaction for atomicity)
  try {
    const dbInstance = db();
    const txn = dbInstance.transaction(() => {
      const stmt = dbInstance.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)");
      stmt.run("config.cached_json", JSON.stringify(config));
      stmt.run("config.cached_at", new Date().toISOString());
    });
    txn();
  } catch {
    // Cache write failure is non-critical
  }

  return config;
}

function invalidateConfigCache(): void {
  try {
    db()
      .prepare("DELETE FROM meta WHERE key IN ('config.cached_json', 'config.cached_at')")
      .run();
  } catch {
    // Cache invalidation failure is non-critical
  }
}

// Dynamically derive writable sections from the schema
// Only YAML sections with editable fields are writable
const WRITABLE_SECTIONS = new Set(
  Object.entries(CONFIG_SECTIONS)
    .filter(([, def]) => def.type !== "file" && def.fields.length > 0)
    .map(([id]) => id)
);

// Mask sensitive values in config before returning to client
function maskConfigSecrets(config: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(config);
  // Mask model.api_key
  if (clone.model && typeof clone.model === "object") {
    maskApiKeyField(clone.model as Record<string, unknown>, "api_key");
  }
  // Mask auxiliary.<task>.api_key — every task entry can carry a key
  if (clone.auxiliary && typeof clone.auxiliary === "object") {
    const aux = clone.auxiliary as Record<string, Record<string, unknown>>;
    for (const task of Object.keys(aux)) {
      maskApiKeyField(aux[task], "api_key");
    }
  }
  return clone;
}

/**
 * In-place replace `record[key]` with its masked form, but only if it's a
 * non-empty string. Centralises the `typeof === "string" && length > 0`
 * guard that the two model/auxiliary branches used to repeat.
 */
function maskApiKeyField(record: Record<string, unknown>, key: string): void {
  const value = record[key];
  if (typeof value === "string" && value.length > 0) {
    record[key] = maskApiKey(value);
  }
}

// GET /api/config — return full config (with secrets masked)
export async function GET(request: NextRequest) {
  // Auth check outside the main try/catch so it matches the PUT pattern
  // and so any future throw inside requireAuth would be classified as an
  // auth failure rather than a "reading config.yaml" error in the log.
  const auth = requireAuth(request);
  if (auth) return auth;
  try {
    const config = readCachedConfig();
    return NextResponse.json({ data: maskConfigSecrets(config) });
  } catch (error) {
    logApiError("GET /api/config", "reading config.yaml", error);
    return NextResponse.json(
      { error: "Failed to read config.yaml" },
      { status: 500 }
    );
  }
}

// PUT /api/config — update specific section
export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth) return auth;

  // Hoist body parsing out of the main try/catch so malformed JSON
  // returns 400 (via parseJsonBody) rather than 500. This matches the
  // behaviour of every other route that adopted parseJsonBody.
  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  // Narrow body shape — parseJsonBody returns Record<string, unknown>
  // so we cast to the structural shape we expect from the client.
  const { section, values } = bodyResult as {
    section?: string;
    values?: unknown;
  };

  if (!section || !values) {
    return NextResponse.json(
      { error: "Missing 'section' or 'values'" },
      { status: 400 }
    );
  }

  // Validate that values is a plain object (not string, array, or null)
  if (typeof values !== "object" || Array.isArray(values) || values === null) {
    return NextResponse.json(
      { error: "values must be an object" },
      { status: 400 }
    );
  }

  // Security: only allow whitelisted sections (prevent modifying model/provider keys)
  if (!WRITABLE_SECTIONS.has(section)) {
    return NextResponse.json(
      { error: `Section '${section}' is not writable. Allowed: ${[...WRITABLE_SECTIONS].join(", ")}` },
      { status: 403 }
    );
  }

  try {
    const config = readCachedConfig();

    // Create backup
    const H = getActiveHermesPaths();
    const configPath = H.config;
    if (existsSync(configPath)) {
      const backupDir = H.backups;
      mkdirSync(backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = `${backupDir}/config.yaml.${timestamp}.bak`;
      writeFileSync(backupPath, readFileSync(configPath, "utf-8"), "utf-8");
    }

    // Merge values into section
    const current = (config[section] as Record<string, unknown>) || {};
    config[section] = { ...current, ...(values as Record<string, unknown>) };

    // Write back
    const content = yaml.dump(config, { lineWidth: -1, noRefs: true });
    writeFileSync(getActiveHermesPaths().config, content, "utf-8");

    appendAuditLine({
      action: "config.put",
      resource: section,
      ok: true,
    });

    // Invalidate cache so next read picks up the change
    invalidateConfigCache();

    return NextResponse.json({ data: { success: true, section, values } });
  } catch (error) {
    logApiError("PUT /api/config", "updating config", error);
    return NextResponse.json(
      { error: "Failed to update config" },
      { status: 500 }
    );
  }
}
