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

type ShowToast = (message: string, tone?: "success" | "error" | "info") => void;

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

/**
 * Load a list endpoint from `/api/memory/hindsight` with the same
 * 5-line shape that HindsightBrowser.tsx previously inlined twice
 * (`loadDirectives` and `loadModels` — both 12-line `useCallback`s
 * with the exact same envelope → error-toast → set-state ladder).
 *
 * The helper composes the GET fetch, the busy-state toggle, the
 * server-error toast, and the empty-state reset. The inner payload's
 * `key` (e.g. `"directives"` or `"models"`) is read by the helper,
 * and the typed items are forwarded to `setItems` only on the
 * no-error path. On a server-reported `error` field (any truthy
 * value — matches the pre-form's `if (inner?.error)` check exactly),
 * the helper shows the toast, resets the items to `[]`, and returns
 * without calling `setItems` on the happy path (the caller can rely
 * on the items list being empty on the error path). On a network
 * error, `hindsightGet` returns `null` and the helper does the same
 * reset-and-return dance so the caller's UI is always in a consistent
 * state.
 *
 * **Byte-equivalence:** the helper body is the EXACT same 5-line
 * composition as the pre-form inline `loadDirectives` /
 * `loadModels` callbacks — same `hindsightGet` call (which itself
 * unwraps the `{ data: { ... } }` envelope), same busy-state
 * toggle (set true → fetch → set false, no try/catch wrapper), same
 * `if (inner?.error) { showToast; setX([]); return; }` ladder, same
 * `setX(inner?.[key] || [])` happy-path. No throw propagation
 * changes (the inline form never had a try/catch — `hindsightGet`
 * catches network errors and returns `null`).
 *
 * @param action the Hindsight endpoint name (e.g. `"directives"`,
 *   `"mental-models"`)
 * @param setBusy a `useState` setter for the loading flag — the
 *   helper toggles it true before the fetch and false after, with
 *   no try/catch wrapper
 * @param key the property name in the inner payload that holds the
 *   items array (e.g. `"directives"`, `"models"`)
 * @param setItems a `useState` setter for the items list — the
 *   helper writes the inner array (or `[]` on error) via this setter
 * @param showToast the `useToast()` return value — used to surface
 *   the server's `error` field on the !ok path
 */
export async function loadHindsightList<TItem>(
  action: string,
  setBusy: (busy: boolean) => void,
  key: "directives" | "models",
  setItems: (items: TItem[]) => void,
  showToast: ShowToast,
): Promise<void> {
  setBusy(true);
  const inner = await hindsightGet<Record<string, unknown>>(action);
  setBusy(false);
  if (inner?.error) {
    showToast(String(inner.error), "error");
    setItems([]);
    return;
  }
  const items = (inner?.[key] as TItem[] | undefined) ?? [];
  setItems(items);
}

// ── Memory age filter (stale-fact TTL substitute) ──────────────
// Hindsight has no per-fact TTL field, so the UI cannot ask the
// daemon to "give me facts newer than N days" in a single call. We
// fetch what the daemon returns (sorted by recency) and filter
// client-side by `created_at`. Stale facts are hidden by default
// but the user can override via the "Show stale" toggle in the
// Memory tab. Default age threshold is 90 days — facts older than
// that are usually superseded by newer knowledge and add noise to
// the Memory tab. The threshold is a constant here, not user-
// configurable, to avoid the UI surface area of an "I forgot I set
// it to 7 days and now nothing shows" footgun.
//
// Added 2026-06-13 as part of the corpus-flood cleanup. See skill
// hindsight-memory-configuration/references/session-2026-06-13-corpus-
// flood-cleanup.md for context.
/** Default age threshold (days) for the Memory tab. Facts older than
 * this are hidden by default. */
export const HINDSIGHT_DEFAULT_MAX_AGE_DAYS = 90;
/** Filter an array of memories by age, using the `created_at`
 * field on each memory. Memories without a parseable `created_at`
 * are kept (we can't prove they're stale, so default to showing
 * them — better to over-show than to silently drop).
 *
 * @param memories the array to filter
 * @param maxAgeDays facts older than this many days are dropped.
 *   Pass `Infinity` to disable the filter (used by the "Show stale"
 *   toggle in the UI).
 */
export function filterMemoriesByAge<T extends { created_at?: string }>(
  memories: T[],
  maxAgeDays: number,
): T[] {
  if (!Number.isFinite(maxAgeDays)) return memories;
  if (maxAgeDays <= 0) return memories;
  const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  return memories.filter((m) => {
    if (!m.created_at) return true; // unknown age → keep
    const t = Date.parse(m.created_at);
    if (Number.isNaN(t)) return true; // unparseable → keep
    return t >= cutoffMs;
  });
}
