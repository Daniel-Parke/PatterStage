// ═══════════════════════════════════════════════════════════════
// deep-merge — recursive merge for plain-object config values
// ═══════════════════════════════════════════════════════════════
//
// Used by /api/config PUT to merge an incoming `values` patch into the
// existing `config[section]` object without clobbering sibling keys on
// nested objects. The semantics are:
//
//   - Plain object on BOTH sides  →  recurse (sibling keys preserved)
//   - Object on one side only     →  source wins (no array/Object merge)
//   - Arrays                      →  source wins (replacement, no concat)
//   - Primitives / null           →  source wins
//
// The shape is the standard "shallow-then-recursive" merge that YAML
// config editors want: you can PATCH a single field in a nested
// `personalities` map and the rest of the map survives. Without it,
// the `merge values into section` step in /api/config drops every
// sibling key on any nested object the user touches.
//
// Tests live in `tests/unit/deep-merge.test.ts` and
// `tests/unit/config-deep-merge.test.ts`.

export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (
      srcVal !== null &&
      typeof srcVal === "object" &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === "object" &&
      !Array.isArray(tgtVal)
    ) {
      deepMerge(
        tgtVal as Record<string, unknown>,
        srcVal as Record<string, unknown>,
      );
    } else {
      target[key] = srcVal;
    }
  }
  return target;
}
