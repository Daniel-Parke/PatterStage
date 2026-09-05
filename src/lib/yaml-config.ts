// ═══════════════════════════════════════════════════════════════
// yaml-config.ts — the canonical YAML dump options (CORE)
//
// Extracted from modules/hermes/lib/config-sync.ts for the hermes module move
// (org/decisions/ADR-0005-product-modules.md). The function knows no path, no key and
// nothing about Hermes; its own docstring already called these "the canonical
// PatterStage YAML options", and two of its five call sites were never Hermes
// code at all (src/app/api/config/route.ts and src/lib/profile-config-builder.ts).
//
// Third neutral helper mined out of that file, after fs-helpers.ts and
// env-file.ts. A file that keeps yielding core utilities was carrying core
// concerns because of its name, not its contents.
// ═══════════════════════════════════════════════════════════════

import * as yaml from "js-yaml";

/**
 * Serialize a value to YAML using the canonical PatterStage options:
 *   - `lineWidth: -1` — no automatic line wrapping; long strings/URLs stay on
 *     one line (matches the historical hand-edited config.yaml style)
 *   - `noRefs: true` — never emit YAML anchors/aliases (`&a001` / `*a001`),
 *     even when the same object is referenced twice in the input
 *
 * Single source of truth for `yaml.dump(..., { lineWidth: -1, noRefs: true })`.
 * Byte-equivalent to the inline form for every reachable input — same string.
 */
export function dumpYamlConfig(value: unknown): string {
  return yaml.dump(value, { lineWidth: -1, noRefs: true });
}
