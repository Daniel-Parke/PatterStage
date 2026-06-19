// ═══════════════════════════════════════════════════════════════
// benchmarks/bench-agent.ts — the ephemeral fair-test agent
//
// A benchmark must be able to toggle individual seed components (which skills,
// which tools, memory on/off) and have those toggles ACTUALLY apply to the
// agentic run — not just flip a tag. To do that reproducibly without disturbing
// the user's real agents, we assemble a throwaway `__bench_<runId>` profile from
// exactly the selected components, push it to Hermes, run against it, then tear
// it down. Orphans from a crash are swept on boot.
// ═══════════════════════════════════════════════════════════════

import { existsSync, rmSync } from "fs";
import { getProfileOrRoot, upsertProfile, deleteProfile, listProfiles } from "@/lib/profiles-repository";
import { configYamlToColumnValues, disabledSkillsFromJson } from "@/lib/profile-config-builder";
import { listSkills } from "@/lib/skills-repository";
import { resolveToolsetIds } from "@/lib/tool-catalog-repository";
import { pushProfileToHermes } from "@/lib/hermes-profile-sync";
import { resolveProfileHermesHome } from "@/lib/hermes-profile-paths";
import { killBenchGateway } from "@/lib/runtime/gateway-manager";
import { logApiError } from "@/lib/api-logger";

const BENCH_PREFIX = "__bench_";

export function benchAgentSlug(runId: string): string {
  return (BENCH_PREFIX + runId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
}

export function isBenchAgent(slug: string): boolean {
  return slug.startsWith(BENCH_PREFIX);
}

export interface BenchAgentSpec {
  /** Base profile slug to inherit identity from (e.g. "baseline" or the user's). */
  base: string;
  /** Selected bundled skill keys; null/undefined → keep the base's skills. */
  skills?: string[] | null;
  /** Selected tool-bundle keys; null/undefined → keep the base's toolsets. */
  tools?: string[] | null;
  /** Memory provider on/off. */
  memory?: boolean;
}

function buildBenchConfig(disabledSkills: string[], platformToolsets: Record<string, string[]>, memory: boolean): string {
  const lines: string[] = ["skills:"];
  if (disabledSkills.length) {
    lines.push("  disabled:");
    for (const s of disabledSkills) lines.push(`    - ${s}`);
  } else {
    lines.push("  disabled: []");
  }
  const platforms = Object.keys(platformToolsets);
  if (platforms.length) {
    lines.push("platform_toolsets:");
    for (const plat of platforms) {
      lines.push(`  ${plat}:`);
      for (const id of platformToolsets[plat]) lines.push(`    - ${id}`);
    }
  } else {
    lines.push("platform_toolsets: {}");
  }
  lines.push("memory:");
  lines.push(`  enabled: ${memory ? "true" : "false"}`);
  lines.push("agent:");
  lines.push("  max_turns: 20");
  lines.push("");
  return lines.join("\n");
}

/**
 * Create an ephemeral benchmark profile from `spec`, push it to Hermes, and
 * return its slug. The agentic runner targets this slug; call teardownBenchAgent
 * when the run finishes.
 */
export function createBenchAgent(runId: string, spec: BenchAgentSpec): string {
  const base = getProfileOrRoot(spec.base);
  if (!base) throw new Error(`bench base profile "${spec.base}" not found`);

  const slug = benchAgentSlug(runId);

  // Skills: select a subset → disable every other bundled skill; else inherit.
  let disabledSkills: string[];
  if (spec.skills) {
    const allBundled = listSkills()
      .filter((s) => s.source === "bundled")
      .map((s) => s.skillKey);
    const selected = new Set(spec.skills);
    disabledSkills = allBundled.filter((k) => !selected.has(k));
  } else {
    disabledSkills = disabledSkillsFromJson(base.disabledSkillsJson);
  }

  // Tools: resolve selected bundles to toolset ids (CLI platform); else inherit.
  let platformToolsets: Record<string, string[]>;
  if (spec.tools) {
    const ids = resolveToolsetIds(spec.tools);
    platformToolsets = ids.length ? { cli: ids } : {};
  } else {
    try {
      platformToolsets = JSON.parse(base.platformToolsetsJson || "{}") as Record<string, string[]>;
    } catch {
      platformToolsets = {};
    }
  }

  const configYaml = buildBenchConfig(disabledSkills, platformToolsets, spec.memory ?? true);
  const cols = configYamlToColumnValues(configYaml);

  upsertProfile({
    slug,
    displayName: `Bench: ${base.displayName}`,
    description: "Ephemeral benchmark agent (auto-generated; safe to delete).",
    personality: base.personality,
    configYaml: cols.configYaml,
    soulMd: base.soulMd,
    agentsMd: base.agentsMd,
    disabledSkillsJson: cols.disabledSkillsJson,
    platformToolsetsJson: cols.platformToolsetsJson,
    seedKey: null,
  });

  // Push so Hermes can load the profile for the agentic run. (Bundled skills are
  // already on disk from the install seed; the disabled list controls activation.)
  const push = pushProfileToHermes(slug);
  if (!push.success) {
    logApiError("benchmarks.benchAgent.push", slug, new Error(push.error ?? "push failed"));
  }
  return slug;
}

/** Delete an ephemeral benchmark profile (gateway + CH DB + Hermes dir). No-op for non-bench slugs. */
export async function teardownBenchAgent(slug: string): Promise<void> {
  if (!isBenchAgent(slug)) return;
  // Kill the dedicated gateway first so nothing holds the profile dir open.
  try {
    killBenchGateway(slug);
  } catch {
    // no live gateway
  }
  try {
    deleteProfile(slug);
  } catch {
    // already gone
  }
  // A just-killed gateway can still be releasing its HERMES_HOME, so a single
  // rmSync can race and leave the dir behind. Retry briefly until it's gone.
  const home = resolveProfileHermesHome(slug);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      rmSync(home, { recursive: true, force: true });
      if (!existsSync(home)) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** Boot-time sweep: remove any ephemeral benchmark profiles left by a crash. */
export async function sweepBenchAgents(): Promise<void> {
  let profiles: ReturnType<typeof listProfiles> = [];
  try {
    profiles = listProfiles();
  } catch {
    return;
  }
  for (const p of profiles) {
    if (isBenchAgent(p.slug)) await teardownBenchAgent(p.slug);
  }
}
