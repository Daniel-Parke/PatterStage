// ═══════════════════════════════════════════════════════════════
// hindsight-client.ts — Shared client for the Hindsight API
// ═══════════════════════════════════════════════════════════════
//
// The Hindsight browser (src/components/memory/HindsightBrowser.tsx)
// and the Hindsight server route (src/app/api/memory/hindsight/route.ts)
// both talk to the same Hindsight HTTP API on localhost:9177. The
// client-side calls have a uniform shape:
//
//   1. Fetch `/api/memory/hindsight?action=<name>&...params` (GET)
//      or POST to `/api/memory/hindsight` with `{ action, ...body }`.
//   2. Unwrap the `{ data: { ...inner } }` envelope.
//   3. The inner payload is endpoint-specific — the typed shape is
//      declared per action.
//
// Before this module, the browser's 5+ fetch callsites inlined the
// envelope-unwrapping pattern (`data?.data?.foo`) with the same
// defensive `?? []` / `?? ""` fallbacks. The repetitive shape made
// the call sites longer than necessary and easy to break in
// lockstep. This module exposes a thin typed wrapper for the GET
// surface. The two near-clone "load list" callbacks for the
// directives + mental-models tabs are a separate, smaller helper.
//
// The POST surface (create / update / refresh / delete) already
// uses `runMutation` from `src/lib/run-mutation.ts` (4 sites) plus
// the legacy `safeApiCall` shape (2 sites — the toggle and the
// inline delete confirmations). Those stay on the existing
// helpers; this module only owns the GET surface.

import { safeApiCall } from "@/lib/api-fetch";

/**
 * Fetch a Hindsight GET endpoint and unwrap the `{ data: { ... } }`
 * envelope. The inner payload is returned typed as `T`; the function
 * returns `null` on error or on a successful response with no inner
 * data field.
 *
 * Mirrors the byte-equivalence contract documented on
 * `safeApiCallData` (src/lib/api-fetch.ts): `null` on `!ok`, `null`
 * on success-without-`data`. Callers can chain `if (inner) { ... }`
 * without TS complaining about `T | null | undefined`.
 *
 * @param action - The `action` query-param value (e.g. `"list"`, `"directives"`).
 * @param query - Optional extra query params. `undefined` values are skipped
 *                so callers can pass `{ limit: undefined }` to drop a key.
 */
export async function hindsightGet<T>(
  action: string,
  query: Record<string, string | number | undefined> = {},
): Promise<T | null> {
  const params = new URLSearchParams({ action });
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const { ok, data } = await safeApiCall<{ data?: T }>(
    `/api/memory/hindsight?${params}`,
  );
  if (!ok) return null;
  return (data?.data ?? null) as T | null;
}
