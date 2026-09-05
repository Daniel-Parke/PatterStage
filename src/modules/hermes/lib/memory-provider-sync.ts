// ═══════════════════════════════════════════════════════════════
// memory-provider-sync.ts — tell the agent's own file which memory it uses
// ═══════════════════════════════════════════════════════════════
//
// PatterStage owns the answer: a `memory_providers` row says which provider is
// active and how to reach it. Hermes reads `memory.provider` from its
// config.yaml for its own purposes, so the two used to be able to disagree
// indefinitely, and this product used to resolve the question by re-reading the
// file it was not writing (T-0101, D64).
//
// One direction only. The database is the source; the file is written to
// follow. Nothing here ever reads the file to decide anything.

import { existsSync } from "fs";

import { dumpYamlConfig } from "@/lib/yaml-config";

import { getActiveHermesPaths } from "./agent-runtime";
import { readHermesYamlConfig } from "./hermes-config-read";
import { writeHermesConfigFile } from "./hermes-config-write";

export interface MemoryProviderWriteResult {
  written: boolean;
  /** Why nothing was written, in the operator's terms. Null on success. */
  error: string | null;
}

/**
 * Set `memory.provider` in the agent's config.yaml.
 *
 * A file that exists and does not parse is REFUSED, not repaired: merging into
 * a failed parse and writing the result is how a config.yaml holding models,
 * providers and toolsets became twenty-three bytes (T-0060). The refusal is a
 * value, not a throw, because the database write it follows has already
 * happened and the caller has to be able to report both.
 *
 * A missing file is written, because a fresh install has none and the provider
 * is a fact worth recording.
 */
export function writeMemoryProviderToHermesConfig(type: string): MemoryProviderWriteResult {
  const configPath = getActiveHermesPaths().config;

  let existsButBroken = false;
  let config: Record<string, unknown> | null = null;
  try {
    config = readHermesYamlConfig<Record<string, unknown>>();
    existsButBroken = config === null && existsSync(configPath);
  } catch (error) {
    return { written: false, error: error instanceof Error ? error.message : String(error) };
  }

  if (existsButBroken) {
    return {
      written: false,
      error: `config.yaml did not parse, so the memory provider was not written into it. Repair the YAML and save again.`,
    };
  }

  const doc: Record<string, unknown> = { ...(config ?? {}) };
  const memory = (doc.memory as Record<string, unknown> | undefined) ?? {};
  doc.memory = { ...memory, provider: type };

  try {
    writeHermesConfigFile(configPath, dumpYamlConfig(doc));
  } catch (error) {
    return { written: false, error: error instanceof Error ? error.message : String(error) };
  }
  return { written: true, error: null };
}
