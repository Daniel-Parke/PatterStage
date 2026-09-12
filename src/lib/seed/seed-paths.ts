// ═══════════════════════════════════════════════════════════════
// seed/seed-paths.ts — where the bundled seed data lives (CORE)
//
// `data/seed/` is PatterStage's own shipped content: profile packs, the agent
// root files, skills, tool bundles, memory facts and template packs. It is not
// any framework's directory, so the resolver is core and both halves of the seed
// share it.
//
// Extracted when catalog-seed was split (org/decisions/ADR-0005-product-modules.md): the
// agent-shaped half moved to the hermes module and needed the same root, and
// duplicating a filesystem probe in two places is how the two silently disagree
// about where the data is.
// ═══════════════════════════════════════════════════════════════

import { existsSync } from "fs";
import { join } from "path";

/**
 * Repo root, probed rather than assumed.
 *
 * `__dirname/../../..` is correct for a normal build; `process.cwd()` covers
 * being run from a packaged/relocated layout. The probe checks for a file that
 * only exists in the real tree, so a wrong candidate is rejected rather than
 * silently producing empty seeds.
 */
function resolveRepoRoot(): string {
  // Three levels up from src/lib/seed/. This file deliberately sits at the same
  // depth catalog-seed.ts did, so the resolution is byte-identical to before the
  // split, and `__dirname` here does not depend on which side imports it.
  const candidates = [join(__dirname, "..", "..", ".."), process.cwd()];
  for (const root of candidates) {
    if (existsSync(join(root, "data/seed/profiles/manifest.json"))) return root;
  }
  return candidates[0];
}

export const REPO_ROOT = resolveRepoRoot();

/** A path under `data/seed/`. */
export function seedPath(...parts: string[]): string {
  return join(REPO_ROOT, "data/seed", ...parts);
}
