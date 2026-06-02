// ═══════════════════════════════════════════════════════════════
// Optional JSON body parsing helper for Next.js route handlers
// ═══════════════════════════════════════════════════════════════
//
// Sibling of `parseJsonBody` for routes that treat the body as an
// optional bag of flags. Returns `Record<string, unknown>` on success,
// or `{}` when the body is missing, unparseable, or not a JSON object.
//
// USE THIS for routes that:
//   - Accept POST with no body at all (just a Content-Type hint)
//   - Accept POST with `{}` to mean "use defaults"
//   - Have ALL fields optional and a missing/garbled body should
//     behave the same as `{}`
//
// DO NOT USE THIS for routes that:
//   - Require a body shape (use `parseJsonBody` and then zod-validate)
//   - Have any required fields (use `parseJsonBody` and reject 400)
//
// The behaviour is the OPPOSITE of `parseJsonBody`:
//   - `parseJsonBody`           → 400 on parse failure
//   - `parseOptionalJsonBody`   → `{}`  on parse failure
//
// Both helpers accept a minimal `NextRequest`-shaped input (any object
// with a `.json()` method that returns a Promise), so they can be
// called from the same handler without coupling to the full NextRequest
// type surface.

export async function parseOptionalJsonBody(
  request: { json: () => Promise<unknown> },
): Promise<Record<string, unknown>> {
  try {
    const parsed = await request.json();
    // Defensive: only return object-shaped payloads. Arrays, strings,
    // numbers, null, etc. would all crash on `body.field` access; treat
    // them as "no flags set" rather than letting them propagate.
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}
