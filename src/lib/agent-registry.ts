// ═══════════════════════════════════════════════════════════════
// agent-registry.ts — Persisted Hermes install (single agent)
// ═══════════════════════════════════════════════════════════════
//
// Stores the location of the local Hermes agent install so Control
// Hub can resolve paths, gateway URLs, and LLM endpoints.
// ═══════════════════════════════════════════════════════════════

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { CH_DATA_DIR } from "./paths";

const REGISTRY_VERSION = 3;
const REGISTRY_FILENAME = "agents-registry.json";

/** Minimal record describing where the local Hermes agent lives. */
export interface HermesRegistryEntry {
  id: string;
  label: string;
  filesystemRoot: string;
  /** e.g. http://127.0.0.1:8642 — local gateway health + LLM base */
  gatewayBaseUrl?: string;
  /** Full chat completions URL, or omitted to derive from gatewayBaseUrl */
  llmBaseUrl?: string;
}

/** Persisted JSON shape — version 3 is a single entry (no array). */
interface HermesRegistryFile {
  version: number;
  entry: HermesRegistryEntry;
}

/** Legacy shape (v1–v2) — array-based for backwards compat. */
interface LegacyRegistryFile {
  version: number;
  activeAgentId?: string;
  agents?: Array<{
    id: string;
    label: string;
    filesystemRoot: string;
    gatewayBaseUrl?: string;
    llmBaseUrl?: string;
  }>;
}

function registryFilePath(): string {
  return CH_DATA_DIR + "/" + REGISTRY_FILENAME;
}

function envDefaultRoot(): string {
  const raw = process.env.AGENT_HOME || process.env.HERMES_HOME;
  if (raw && String(raw).trim()) {
    return String(raw).trim().replace(/[/\\]+$/, "");
  }
  return homedir() + "/.hermes";
}

function defaultEntry(): HermesRegistryEntry {
  return {
    id: "default",
    label: "Default Hermes",
    filesystemRoot: envDefaultRoot(),
  };
}

function normalizeEntry(raw: unknown): HermesRegistryEntry {
  const e = raw as Record<string, unknown>;
  const root = typeof e.filesystemRoot === "string"
    ? e.filesystemRoot.replace(/[/\\]+$/, "")
    : envDefaultRoot();
  return {
    id: String(e.id || "default"),
    label: String(e.label || e.id || "Default Hermes"),
    filesystemRoot: root,
    gatewayBaseUrl:
      typeof e.gatewayBaseUrl === "string" && e.gatewayBaseUrl.trim()
        ? e.gatewayBaseUrl.trim()
        : undefined,
    llmBaseUrl:
      typeof e.llmBaseUrl === "string" && e.llmBaseUrl.trim()
        ? e.llmBaseUrl.trim()
        : undefined,
  };
}

/**
 * Read the Hermes registry. Handles three cases:
 *  - File doesn't exist → create default
 *  - v3 format (single entry) → return as-is
 *  - v1/v2 format (agents array) → migrate in-memory to v3
 */
export function getHermesEntry(): HermesRegistryEntry {
  const p = registryFilePath();
  if (!existsSync(p)) {
    const data = buildV3File(defaultEntry());
    mkdirSync(CH_DATA_DIR, { recursive: true });
    writeFileSync(p, JSON.stringify(data, null, 2), { mode: 0o600 });
    return data.entry;
  }
  try {
    const raw = readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // v3: single entry format
    const ver = typeof parsed.version === "number" ? parsed.version : 0;
    if (ver >= 3 && parsed.entry) {
      return normalizeEntry(parsed.entry);
    }

    // v1/v2: array format — pick the active or first entry
    const legacy = parsed as unknown as LegacyRegistryFile;
    if (legacy.agents && Array.isArray(legacy.agents) && legacy.agents.length > 0) {
      const activeId = legacy.activeAgentId || legacy.agents[0].id;
      const match = legacy.agents.find((a) => a.id === activeId);
      const entry = normalizeEntry(match || legacy.agents[0]);
      // Write migrated v3 file
      writeAgentEntry(entry);
      return entry;
    }

    // Fallback: no usable data
    const fallback = defaultEntry();
    writeAgentEntry(fallback);
    return fallback;
  } catch {
    const fallback = defaultEntry();
    writeAgentEntry(fallback);
    return fallback;
  }
}

function buildV3File(entry: HermesRegistryEntry): HermesRegistryFile {
  return { version: REGISTRY_VERSION, entry };
}

export function writeAgentEntry(entry: HermesRegistryEntry): void {
  mkdirSync(CH_DATA_DIR, { recursive: true });
  const p = registryFilePath();
  writeFileSync(p, JSON.stringify(buildV3File(entry), null, 2), { mode: 0o600 });
}

/** Returns the Hermes filesystem root for path allowlist checks. */
export function getHermesFilesystemRoot(): string {
  return getHermesEntry().filesystemRoot.replace(/[/\\]+$/, "");
}
