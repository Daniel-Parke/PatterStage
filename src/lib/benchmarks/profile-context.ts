// ═══════════════════════════════════════════════════════════════
// benchmarks/profile-context.ts — resolve a profile into its benchmark unit
//
// An agent is INSEPARABLE from its LLM ("no human without the brain"). Before a
// benchmark run we resolve the profile (named profile OR the default root "Bob")
// into the concrete model it runs on + its augmentation footprint (skills /
// toolsets / memory), so every run can RECORD the exact brain it used and tag
// whether skills/tools/memory were active. Read-only; pure-ish (DB reads only).
// ═══════════════════════════════════════════════════════════════

import { getProfile } from "@/lib/profiles-repository";
import { getAgentRoot } from "@/lib/agent-root-repository";
import { disabledSkillsFromJson, extractPreservedSections } from "@/lib/profile-config-builder";
import { findModelByModelId, getDefaultModel } from "@/lib/models-repository";
import { listSkills } from "@/lib/skills-repository";

export interface ProfileBenchmarkContext {
  slug: string;
  displayName: string;
  /** Registry model id (for callLLM credential resolution); null if unresolved. */
  modelRegistryId: string | null;
  /** Provider model string (e.g. "anthropic/claude-sonnet-4") for display/cost. */
  modelString: string | null;
  /** Human label for the brain. */
  modelLabel: string;
  /** Enabled (non-disabled) skill count. */
  skillsEnabled: number;
  /** Platform-toolset count. */
  toolsetCount: number;
  /** Configured memory provider (e.g. "hindsight"), or null when none/disabled. */
  memoryProvider: string | null;
}

interface ConfigRow {
  displayName: string;
  configYaml: string;
  disabledSkillsJson: string;
  platformToolsetsJson: string;
}

function rowForSlug(slug: string): ConfigRow | null {
  if (slug === "default") {
    const root = getAgentRoot();
    return {
      displayName: root.displayName,
      configYaml: root.configYaml,
      disabledSkillsJson: root.disabledSkillsJson,
      platformToolsetsJson: root.platformToolsetsJson,
    };
  }
  const row = getProfile(slug);
  if (!row) return null;
  return {
    displayName: row.displayName,
    configYaml: row.configYaml,
    disabledSkillsJson: row.disabledSkillsJson,
    platformToolsetsJson: row.platformToolsetsJson,
  };
}

/** Pull a usable model string out of the config.yaml `model:` block (string or object). */
function modelStringFromPreserved(model: unknown): string | null {
  if (typeof model === "string") return model.trim() || null;
  if (model && typeof model === "object") {
    const o = model as Record<string, unknown>;
    const pick = (k: string) => (typeof o[k] === "string" ? (o[k] as string).trim() : "");
    const base = pick("model") || pick("id") || pick("name") || pick("value");
    if (!base) return null;
    const provider = pick("provider");
    return provider && !base.includes("/") ? `${provider}/${base}` : base;
  }
  return null;
}

function memoryProviderFromPreserved(memory: unknown): string | null {
  if (!memory || typeof memory !== "object") return null;
  const o = memory as Record<string, unknown>;
  if (o.enabled === false) return null;
  const provider = typeof o.provider === "string" ? o.provider.trim() : "";
  if (!provider || provider.toLowerCase() === "none") return null;
  return provider;
}

function countPlatformToolsets(json: string): number {
  try {
    const v = JSON.parse(json);
    if (v && typeof v === "object" && !Array.isArray(v)) return Object.keys(v).length;
    return 0;
  } catch {
    return 0;
  }
}

export function getProfileBenchmarkContext(slug: string): ProfileBenchmarkContext | null {
  const row = rowForSlug(slug);
  if (!row) return null;

  const preserved = extractPreservedSections(row.configYaml);
  const modelString = modelStringFromPreserved(preserved.model);

  // Resolve to a registry row (credentials/baseUrl) so the brain-only path can
  // call it directly; fall back to the configured "agent" default model.
  let registry = modelString ? findModelByModelId(modelString) : null;
  if (!registry) registry = getDefaultModel("agent");

  const disabled = disabledSkillsFromJson(row.disabledSkillsJson);
  const totalSkills = (() => {
    try {
      return listSkills().length;
    } catch {
      return 0;
    }
  })();

  return {
    slug,
    displayName: row.displayName,
    modelRegistryId: registry?.id ?? null,
    modelString: registry?.modelId ?? modelString,
    // When nothing resolves, the run still works via the Hermes gateway's own
    // configured model — label it honestly rather than "Unknown".
    modelLabel: registry?.name ?? modelString ?? "Gateway default",
    skillsEnabled: Math.max(0, totalSkills - disabled.length),
    toolsetCount: countPlatformToolsets(row.platformToolsetsJson),
    memoryProvider: memoryProviderFromPreserved(preserved.memory),
  };
}
