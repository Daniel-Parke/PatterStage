import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import yaml from "js-yaml";

import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { appendAuditLine } from "@/lib/audit-log";
import { db } from "@/lib/db";

const CACHE_TTL_MS = 15_000; // 15 seconds

function readCachedConfig(): Record<string, unknown> {
  const configPath = getActiveHermesPaths().config;

  // Try meta table cache first
  try {
    const cachedJson = db()
      .prepare("SELECT value FROM meta WHERE key = ?")
      .pluck()
      .get("config.cached_json") as string | undefined;

    const cachedAt = db()
      .prepare("SELECT value FROM meta WHERE key = ?")
      .pluck()
      .get("config.cached_at") as string | undefined;

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
  const config = (yaml.load(content) as Record<string, unknown>) || {};

  // Update cache
  try {
    db()
      .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)")
      .run("config.cached_json", JSON.stringify(config));
    db()
      .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)")
      .run("config.cached_at", new Date().toISOString());
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

// Whitelist of config sections that can be modified via PUT
const WRITABLE_SECTIONS = new Set([
  "agent", "display", "memory", "terminal", "compression",
  "security", "tts", "stt", "delegation", "cron", "checkpoints", "approvals",
]);

// Mask sensitive values in config before returning to client
function maskConfigSecrets(config: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(config));
  // Mask api_key in model section
  if (clone.model && typeof clone.model === "object" && clone.model.api_key) {
    const key = String(clone.model.api_key);
    clone.model.api_key = key.length > 8 ? key.slice(0, 4) + "••••" + key.slice(-4) : "••••";
  }
  return clone;
}

// GET /api/config — return full config (with secrets masked)
export async function GET() {
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
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  try {
    const body = await request.json();
    const { section, values } = body;

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
    config[section] = { ...current, ...values };

    // Write back
    const content = yaml.dump(config, { lineWidth: -1, noRefs: true });
    writeFileSync(getActiveHermesPaths().config, content, "utf-8");

    appendAuditLine({
      action: "config.put",
      resource: String(section),
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
