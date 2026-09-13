// ═══════════════════════════════════════════════════════════════
// seed-profile-toolsets.ts — Read platform_toolsets from data/seed
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { parseConfigYaml, type PlatformToolsets } from "./profile-config-builder";

function resolveRepoRoot(): string {
  const candidates = [
    join(__dirname, "..", ".."),
    process.cwd(),
  ];
  for (const root of candidates) {
    if (existsSync(join(root, "data/seed/profiles/manifest.json"))) {
      return root;
    }
  }
  return candidates[0];
}

const SEED_PROFILES_DIR = join(resolveRepoRoot(), "data/seed/profiles");

export function loadSeedPlatformToolsets(slug: string): PlatformToolsets {
  const repoRoot = resolveRepoRoot();
  const configPath =
    slug === "default" || slug === "agent-root"
      ? join(repoRoot, "data/seed/agent-root/config.yaml")
      : join(SEED_PROFILES_DIR, slug, "config.yaml");
  if (!existsSync(configPath)) return {};
  const yaml = readFileSync(configPath, "utf-8");
  return parseConfigYaml(yaml).platformToolsets;
}
