// ═══════════════════════════════════════════════════════════════
// yaml-config.ts — the canonical YAML dump options (CORE)
//
// Core rather than Hermes (org/decisions/ADR-0005-product-modules.md): the
// function knows no path, no key and nothing about Hermes.
// ═══════════════════════════════════════════════════════════════

import * as yaml from "js-yaml";

/**
 * Serialize a value to YAML using the canonical PatterStage options:
 *   - `lineWidth: -1` — no automatic line wrapping; long strings/URLs stay on
 *     one line (matches the historical hand-edited config.yaml style)
 *   - `noRefs: true` — never emit YAML anchors/aliases (`&a001` / `*a001`),
 *     even when the same object is referenced twice in the input
 */
export function dumpYamlConfig(value: unknown): string {
  return yaml.dump(value, { lineWidth: -1, noRefs: true });
}
