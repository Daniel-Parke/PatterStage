// hindsight-client.ts — the shared GET surface for the Hindsight API on
// localhost:9177, used by src/components/memory/HindsightBrowser.tsx and
// src/app/api/memory/hindsight/route.ts: GET `/api/memory/hindsight?action=<name>&...`,
// unwrap `{ data: { ...inner } }`, type the payload per action. The POST
// surface (create / update / refresh / delete) goes through `runMutation`.

import { safeApiCall } from "@/lib/api-fetch";

type ShowToast = (message: string, tone?: "success" | "error" | "info") => void;

/**
 * Fetch a Hindsight GET endpoint and unwrap the `{ data: { ... } }` envelope.
 * Returns `null` on error or when the response carries no inner data.
 *
 * @param action - The `action` query-param value (e.g. `"list"`, `"directives"`).
 * @param query - Extra query params; `undefined` values are skipped, so `{ limit: undefined }` drops a key.
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
 * Load a list endpoint: the GET, the busy toggle, the error toast and the
 * empty-state reset. A server `error` toasts and resets to `[]`; a network
 * error returns `null` from `hindsightGet` and resets the same way.
 *
 * @param action the Hindsight endpoint name (e.g. `"directives"`, `"mental-models"`)
 * @param setBusy a `useState` setter for the loading flag
 * @param key the inner-payload property holding the items (e.g. `"directives"`, `"models"`)
 * @param setItems a `useState` setter for the items list (the inner array, or `[]` on error)
 * @param showToast the `useToast()` return value, for the server's `error` field
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

// Memory age filter. Hindsight has no per-fact TTL, so the UI filters what the
// daemon returns by `created_at`. Stale facts hide by default; the Memory tab's
// "Show stale" toggle overrides. The 90-day threshold is a constant, not a
// setting, to avoid the "I forgot I set it to 7 days" footgun.
/** Default age threshold (days) for the Memory tab. */
export const HINDSIGHT_DEFAULT_MAX_AGE_DAYS = 90;
/**
 * Filter memories by `created_at`. A missing or unparseable date is kept:
 * better to over-show than to silently drop.
 *
 * @param memories the array to filter
 * @param maxAgeDays facts older than this are dropped; `Infinity` disables the filter ("Show stale").
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
