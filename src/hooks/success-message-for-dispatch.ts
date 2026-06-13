// ═══════════════════════════════════════════════════════════════
// successMessageForDispatch — mode → success-toast string resolver
// ═══════════════════════════════════════════════════════════════
//
// The `handleSubmit` callback in `useMissionsPage.ts` has two branches
// (the promote path + the dispatch path) that each need a different
// success toast string depending on the dispatch mode. Pre-refactor
// the 4-branch resolver was duplicated inline in both places:
//
//   if (mode === "save") return "Mission saved as draft";
//   if (mode === "queue") return "Mission saved to queue";
//   if (mode === "now") return "Mission dispatched";
//   return `Mission scheduled: ${schedule}`;
//
// Extracted to a helper so a future "renamed string" or "new mode"
// change lands in one place. The 4 strings are the ones the 2 inline
// resolvers used — byte-equivalent at the call site.
//
// Location: src/hooks/ (page-local helper, not promoted to src/lib/
// because no other consumer exists; if a 2nd consumer appears, move
// to src/lib/ alongside the toastFromResult helper).
//
// The `DispatchMode` type is re-exported for back-compat with the 1
// inline consumer (`useMissionsPage.ts` imports `DispatchMode` from
// here). The canonical type lives in `src/lib/dispatch-mode.ts`, which
// is the single source of truth for the union and the parsing helper.

export type { DispatchMode } from "@/lib/dispatch-mode";
import type { DispatchMode } from "@/lib/dispatch-mode";
import type { SafeApiCallResult } from "@/lib/api-fetch";
import { safeApiCall } from "@/lib/api-fetch";

/**
 * Inner payload shape for the `/api/missions` POST route. Every action
 * returns `{ data: { mission: { id: string, ... } } }` on success — the
 * helper unwraps the outer `data` envelope via `safeApiCall`'s
 * `SafeApiCallResult<T>` and returns the inner `{ mission? }` shape
 * directly. Callers read `result.data?.mission?.id` (one level) instead
 * of `result.data?.data?.mission?.id` (two levels). The 2 read sites in
 * `useMissionsPage.handleCreate` (the re-dispatch-completed + dispatch-new
 * branches) benefit from the collapse; the 5 sites that only read
 * `ok`/`error` are unaffected.
 *
 * The 1-level unwrap makes the helper's return shape match the comments
 * at `useMissionsPage.ts:800-805, 830-834` (which have always described
 * the post-unwrap shape — the pre-unwrap code path was a stale
 * 2-level indirection that the helper claims to collapse but didn't).
 *
 * Extracted to a top-level type so the `dispatchMissionAction` helper
 * in this file can express the response shape without inlining it 4
 * times across the call sites in `useMissionsPage.handleCreate`.
 */
export interface MissionActionPayload {
  mission?: { id: string } & Record<string, unknown>;
}

/**
 * POST a `{ action, ...body }` envelope to `/api/missions` and return
 * the safe-typed result with the inner payload unwrapped to one level.
 * The 7 call sites (5 in `useMissionsPage` + 1 in `page.tsx` cancel +
 * 1 future expansion) all share the exact same shape: a POST with
 * `{ action, missionId?, name, ...payload }` and a typed
 * `SafeApiCallResult<MissionActionPayload>` return.
 *
 * Centralising the call shape has 4 wins:
 *  1. The inner-payload type (`MissionActionPayload`) is declared once
 *     instead of inlined at every read site.
 *  2. Future migrations to a different safe-call wrapper (e.g.
 *     `safeApiCallData`) only need to touch this helper.
 *  3. The 7 sites collapse to a 4-line call each (action + body + helper
 *     invocation + destructure) instead of a 12-line call with the
 *     envelope type and method/body boilerplate.
 *  4. The 2 read sites in `useMissionsPage` collapse from
 *     `body?.data?.mission?.id` (two indirections) to
 *     `body?.mission?.id` (one indirection) — a real code-quality
 *     improvement that aligns with the (always-intended) post-unwrap
 *     comment shape.
 *
 * Byte-equivalence: the helper body is literally
 * `safeApiCall<{ data?: MissionActionPayload }>("/api/missions", { method: "POST", body: { action, ...body } })`
 * — same wire call, same `{ data: { mission: { id } } }` envelope, same
 * `SafeApiCallResult` shape on return. The 7 callers each spread their
 * own body shape (e.g. `{ missionId, name, ...dispatchPayload(...) }`)
 * into the helper — no shape change at the call site's body.
 * The 2 read sites that did `result.data?.data?.mission?.id` (the
 * 2-level pre-unwrap form) collapse to `result.data?.mission?.id`
 * (1-level post-unwrap) — semantically identical because the
 * `safeApiCall<T>` return type is `{ ok, data?: T, error? }` and the
 * inner T here is `{ data?: MissionActionPayload }`, so the original
 * 2-level access read the inner `MissionActionPayload` after walking
 * the outer envelope. Post-unwrap, `T` is `MissionActionPayload`
 * directly, so the same payload is at `result.data?.mission?.id`.
 */
export async function dispatchMissionAction(
  action: "dispatch" | "update" | "promote" | "delete" | "cancel",
  body: Record<string, unknown>,
): Promise<SafeApiCallResult<MissionActionPayload>> {
  // The route returns `{ data: { mission: { id } } }` (envelope). The
  // helper unwraps the outer `data` envelope so the 2 read sites in
  // `useMissionsPage` can collapse from `body?.data?.mission?.id`
  // (2 levels) to `body?.mission?.id` (1 level). The 5 sites that only
  // read `ok`/`error` are unaffected by the unwrap.
  //
  // The unwrap is `data?.data ?? undefined` (preserving the missing-payload
  // case as `undefined` so the 2 read sites' `?.mission?.id` chain
  // short-circuits). We could use `safeApiCallData<MissionActionPayload>(...)`
  // for the unwrap (it has the same `data?.data ?? null` shape), but that
  // helper returns `MissionActionPayload | null` and drops the
  // `ok`/`error` fields — `safeApiCallData` is for read-only fetchers, not
  // mutation consumers that need the toast result. Doing the unwrap inline
  // here preserves the `SafeApiCallResult<MissionActionPayload>` shape the
  // call sites need.
  //
  // The `as` cast on the return is the same shape `safeApiCallData`
  // uses internally (`(data?.data ?? null) as T | null`) — both
  // helpers do the same `data?.data` walk; the difference is that
  // `safeApiCallData` drops the `ok`/`error` fields and returns
  // `T | null`, while we preserve the full `SafeApiCallResult` shape
  // and only unwrap the inner `data` envelope.
  const { ok, error, data } = await safeApiCall<{ data?: MissionActionPayload }>(
    "/api/missions",
    { method: "POST", body: { action, ...body } },
  );
  return { ok, error, data: data?.data } as SafeApiCallResult<MissionActionPayload>;
}

/**
 * Resolve the success toast message for a dispatched mission based on
 * the dispatch mode.
 *
 *   save  → "Mission saved as draft"
 *   queue → "Mission saved to queue"
 *   now   → "Mission dispatched"
 *   cron  → `Mission scheduled: ${schedule}` (falls through)
 *
 * @param mode The dispatch mode chosen by the user.
 * @param schedule The cron expression, required when `mode === "cron"`.
 *   When `undefined` or `""` is passed, the helper produces the same
 *   pre-refactor template-literal output ("Mission scheduled: undefined"
 *   or "Mission scheduled: "). No special-casing — matches the inline form.
 */
export function successMessageForDispatch(
  mode: DispatchMode,
  schedule?: string,
): string {
  if (mode === "save") return "Mission saved as draft";
  if (mode === "queue") return "Mission saved to queue";
  if (mode === "now") return "Mission dispatched";
  return `Mission scheduled: ${schedule}`;
}
