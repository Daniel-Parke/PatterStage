// ═══════════════════════════════════════════════════════════════
// hermes-home.ts — Local Hermes install path resolution
// ═══════════════════════════════════════════════════════════════
//
// Resolves the local Hermes agent filesystem root purely from
// environment variables with a hard-coded fallback to ~/.hermes.
// A legacy read-only fallback checks agents-registry.json on disk
// for backwards compatibility.
//
// KEY DESIGN: This module NEVER writes to the filesystem. The
// agents-registry.json file is read-only legacy compat; it is
// never written to again after this migration.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const DEFAULT_HERMES_HOME = homedir() + "/.hermes";
const DEFAULT_GATEWAY = "http://127.0.0.1:8642";

// ── Hermes home resolution ──────────────────────────────────────

/**
 * Resolve the Hermes filesystem root with this priority:
 *   1. HERMES_HOME or AGENT_HOME env var
 *   2. Read-only fallback from agents-registry.json (if exists on disk)
 *   3. Hard-coded default: ~/.hermes
 */
export function getHermesHome(): string {
  // 1. Environment variables
  const envHome = process.env.HERMES_HOME || process.env.AGENT_HOME;
  if (envHome && String(envHome).trim()) {
    return String(envHome).trim().replace(/[/\\]+$/, "");
  }

  // 2. Legacy read-only fallback from agents-registry.json
  const legacyRoot = tryLegacyRegistryRoot();
  if (legacyRoot) return legacyRoot;

  // 3. Hard-coded default
  return DEFAULT_HERMES_HOME;
}

/** Legacy read-only fallback: read agents-registry.json if it exists. */
function tryLegacyRegistryRoot(): string | null {
  try {
    const chData = process.env.CH_DATA_DIR || process.env.CONTROL_HUB_DATA_DIR;
    const dataDir = chData && String(chData).trim()
      ? String(chData).trim().replace(/[/\\]+$/, "")
      : join(homedir(), "control-hub", "data");

    const regPath = join(dataDir, "agents-registry.json");
    if (!existsSync(regPath)) return null;

    const raw = readFileSync(regPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // v3: single entry format
    if (parsed.version && typeof parsed.version === "number" && parsed.version >= 3 && parsed.entry) {
      const entry = parsed.entry as Record<string, unknown>;
      return typeof entry.filesystemRoot === "string"
        ? entry.filesystemRoot.replace(/[/\\]+$/, "")
        : null;
    }

    // v1/v2: array format — take active or first
    const legacy = parsed as { version: number; activeAgentId?: string; agents?: Array<{ id: string; filesystemRoot?: string }> };
    if (legacy.agents && Array.isArray(legacy.agents) && legacy.agents.length > 0) {
      const activeId = legacy.activeAgentId || legacy.agents[0].id;
      const match = legacy.agents.find((a) => a.id === activeId) || legacy.agents[0];
      return typeof match.filesystemRoot === "string"
        ? match.filesystemRoot.replace(/[/\\]+$/, "")
        : null;
    }
  } catch {
    // Legacy file absent or corrupt — fall through to default
  }
  return null;
}

// ── URL resolution ──────────────────────────────────────────────

/**
 * Hermes gateway URL. Priority:
 *   1. HERMES_GATEWAY_URL env var
 *   2. CONTROL_HUB_LLM_API (gateway base extracted)
 *   3. Hard-coded default: http://127.0.0.1:8642
 */
export function getHermesGatewayUrl(): string {
  const envGateway = process.env.HERMES_GATEWAY_URL?.trim();
  if (envGateway) return envGateway.replace(/\/$/, "");

  const envApi = process.env.CONTROL_HUB_LLM_API?.trim();
  if (envApi && envApi.includes("/v1/chat/completions")) {
    return envApi.replace(/\/v1\/chat\/completions\/?$/, "").replace(/\/$/, "");
  }

  return DEFAULT_GATEWAY;
}

/**
 * Hermes LLM completions URL. Priority:
 *   1. CONTROL_HUB_LLM_API env var
 *   2. HERMES_GATEWAY_URL + /v1/chat/completions
 *   3. Hard-coded default: http://127.0.0.1:8642/v1/chat/completions
 */
export function getHermesLlmUrl(): string {
  const envApi = process.env.CONTROL_HUB_LLM_API?.trim();
  if (envApi) return envApi;

  const gateway = getHermesGatewayUrl();
  return gateway + "/v1/chat/completions";
}

// ── Convenience aliases ─────────────────────────────────────────

/** Backwards-compatible getter for path allowlist checks. */
export function getHermesFilesystemRoot(): string {
  return getHermesHome();
}
