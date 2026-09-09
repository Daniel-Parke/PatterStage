// ═══════════════════════════════════════════════════════════════
// parse-bag-flags — small field-accessors for the "bag of optional
// flags" body shape that sync/* and similar multi-action routes use.
// ═══════════════════════════════════════════════════════════════
//
// A missing or wrong-typed field reads as absent; nothing here throws or
// reports. These are NOT a validation layer: a route that requires a body
// shape uses `parseJsonBody` plus a zod schema (see `lib/api-schemas.ts`).

/**
 * `body[key]` when it is a string, otherwise `undefined`. With `trim`, the
 * string is also `.trim()`-ed, for values that feed further narrowing (a slug
 * must not carry surrounding whitespace).
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
 * `true` only when `body[key]` is the boolean literal `true`. Truthy
 * non-booleans (`"true"`, `1`) are NOT accepted.
 */
export function booleanFlag(
  body: Record<string, unknown>,
  key: string,
): boolean {
  return body[key] === true;
}
