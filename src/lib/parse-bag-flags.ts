// ═══════════════════════════════════════════════════════════════
// parse-bag-flags — small field-accessors for the "bag of optional
// flags" body shape that sync/* and similar multi-action routes use.
// ═══════════════════════════════════════════════════════════════
//
// Background: routes that accept a JSON body where every field is
// optional (e.g. `POST /api/agent/profiles/sync/push` accepts
// `{slug?, all?, root?, skills?, skillKey?, missingOnly?, onlyOutOfSync?}`)
// hand-roll the same narrow-on-type pattern:
//
//   const slug = typeof body.slug === "string" ? body.slug : undefined;
//   const all = body.all === true;
//   const skillKey = typeof body.skillKey === "string" ? body.skillKey : undefined;
//
// 11 sites across the codebase (sync push/pull, templates, seed,
// mission-categories) repeated this pattern. The helpers below
// collapse each one-liner to a single token call and keep the
// "missing or wrong-type field" semantics identical to the inline form:
//
//   - `stringFlag(body, "slug")` returns `body.slug` when it's a string,
//     else `undefined`. Trim is opt-in (default off) so the helper is
//     byte-equivalent to the inline form unless the caller asks.
//   - `booleanFlag(body, "all")` returns `true` only when `body.all` is
//     literally `true` (matches the existing `=== true` strictness —
//     truthy strings like `"true"` or `1` are NOT accepted, matching
//     pre-refactor behaviour).
//
// The helpers are tiny, dependency-free, and apply to any
// `Record<string, unknown>` body. They are NOT a validation layer —
// for routes that require a body shape, use `parseJsonBody` plus a
// zod schema (see `lib/api-schemas.ts`).
//
// Migration recipe for a single route:
//   const slug = typeof body.slug === "string" ? body.slug : undefined;
//   const all  = body.all === true;
//   ─ becomes ─
//   const slug = stringFlag(body, "slug");
//   const all  = booleanFlag(body, "all");

/**
 * Return `body[key]` if it is a string, otherwise `undefined`. When
 * `trim` is true, a returned string is also `.trim()`-ed. Pass `trim`
 * to normalise flag values that callers will pass into further
 * narrowing (e.g. slugs that must not have surrounding whitespace).
 */
export function stringFlag(
  body: Record<string, unknown>,
  key: string,
  options?: { trim?: boolean },
): string | undefined {
  const value = body[key];
  if (typeof value !== "string") return undefined;
  return options?.trim ? value.trim() : value;
}

/**
 * Return `true` only when `body[key]` is the boolean literal `true`.
 * Matches the inline `body.X === true` form: truthy non-boolean values
 * (`"true"`, `1`, etc.) are NOT accepted. Returns `false` for missing,
 * wrong-type, or falsy values.
 */
export function booleanFlag(
  body: Record<string, unknown>,
  key: string,
): boolean {
  return body[key] === true;
}
