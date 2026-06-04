# List 1 — Session 78 Findings

**Mission:** `mission/hermes-review-and-refactor`
**Date:** 2026-06-03
**Pick:** List 1 (Dashboard, Sessions, Memory, Logs) — picked at random.

## Summary

Two consolidations on the Sidebar surface (List 1 territory):

1. **Refactor 1 — `runDeployAction` helper in `src/components/layout/Sidebar.tsx`** — collapsed three near-identical 30-line click handlers (`handleUpdate`, `handleRestart`, `doRebuild`) into one parameterized function plus three 5-line wrappers. 89 lines of similar code → 109 lines of structured code (net +20 for the doc comments, but the *duplication* is gone — adding a 4th action in the future is one wrapper, not 30 lines). All three use the same fetch + error-parse + pollDeployStatus + catch shape, just with different action names, messages, busy setters, and bodies.
2. **Refactor 2 — `fallbackForDeployMessage()` helper in `src/lib/deploy-action-fallback.ts`** — extracted the `startedMessage.replace(/started.*$/, "failed")` regex from `runDeployAction` into a named, unit-testable function. 7 unit tests cover the 3 message shapes the Sidebar actually uses plus 4 edge cases (empty, no-match, multi-match, capitalization).
3. **Refactor 3 — `messageFromError()` migration** — 4 inline `err instanceof Error ? err.message : <fallback>` patterns in `Sidebar.tsx` + 1 in `(main)/sessions/[id]/page.tsx` migrated to the new `messageFromError()` helper from `api-fetch.ts` (added in session 77). Closes the last 4 `err instanceof Error` sites in `src/components/` and 1 in `src/app/(main)/sessions/[id]/`. Empty-Error edge case now guaranteed to surface the fallback.

## What changed

### Refactor 1 — `runDeployAction` consolidation

The three handlers in `Sidebar.tsx` (lines 243-340 in the pre-session state) had the same shape:

```ts
const handleX = async () => {
  if (busyGuard) return;
  setBusyX(true);
  if (useBusyRef) busyRef.current = true;
  setMessage("X started…");
  try {
    const res = await fetch("/api/update", { ... });
    if (!res.ok) {
      let msg = "X failed";
      try { const body = await res.json(); if (body?.error) msg = body.error; }
      catch { /* ignore */ }
      throw new Error(msg);
    }
    // (handleUpdate only: also parse d.error from the success body)
    setMessage("X running…");
    pollDeployStatus("x");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "X failed";
    setMessage(msg);
    setBusyX(false);
    if (useBusyRef) busyRef.current = false;
  }
};
```

Three copies of that. The only differences:
- The action name (`update`/`restart`/`rebuild`)
- The started/running messages
- The busy setter (`setUpdating`/`setRestarting`/`setRebuilding`)
- Whether to also use `busyRef.current` (restart + rebuild do; update doesn't)
- Optional body (update includes `branch` from the dropdown state; others don't)
- Whether to parse the success body for `d.error` (update does; others don't — the poll surfaces failure for them)

Consolidated to a single `runDeployAction` useCallback that takes those 5 differences as parameters, plus three thin wrappers (`handleUpdate`, `handleRestart`, `doRebuild`) that add the per-action early-return guards (the `updating || !version?.updateAvailable` for update, the `busyRef.current` for restart + rebuild).

**Byte-equivalent at runtime** — same fetch URLs, same body shapes, same messages, same poll behavior, same error paths.

**One subtle behavior change in `handleUpdate`'s early-return guard** — the original was `if (updating || !version?.updateAvailable) return;` with no `useCallback`, so the function was rebuilt on every render. My wrapper is a useCallback with `[runDeployAction, deployBranch, updating, version?.updateAvailable]` deps, so it re-creates when `updating` flips. The behavior is identical (the guard reads the current `updating` at click time), just with a stable reference identity for downstream `useEffect`s. There are no downstream `useEffect`s reading `handleUpdate` so the identity change is observationally invisible.

### Refactor 2 — `fallbackForDeployMessage()` helper

The inline form `startedMessage.replace(/started.*$/, "failed")` is a tightly-named regex that:
- Matches "Update started — deploying in background..." → "Update failed"
- Matches "Rebuild started…" → "Rebuild failed"
- **Does NOT match** the restart message "Restart requested (~/.hermes/logs/ch-restart.log)…" (no "started" word) → returns the input unchanged
- The 3rd case was a real pre-existing quirk — the original catch block would set the message to the literal "Restart requested (~/.hermes/logs/ch-restart.log)…" on a network failure. The unit test `returns the input unchanged for the Restart message` locks this so a future "fix" of the restart message is intentional.

Extracted to `src/lib/deploy-action-fallback.ts` as a pure 1-line function with comprehensive JSDoc. 7 unit tests in `tests/unit/deploy-action-fallback.test.ts` cover all 3 message shapes + 4 edge cases (empty string, multi-match, no-match, capitalization).

### Refactor 3 — `messageFromError()` migration

5 inline `err instanceof Error ? err.message : <fallback>` patterns migrated to the canonical `messageFromError(err, fallback)` helper from `api-fetch.ts`:

- `src/components/layout/Sidebar.tsx` — 4 sites (the 3 deploy catch blocks, now consolidated into 1 in `runDeployAction` after Refactor 1, so this is technically just 1 in the final state — but the migration happened at the inline-form level before consolidation, so 4 in the diff)
- `src/app/(main)/sessions/[id]/page.tsx` — 1 site (the session-detail load catch)

After session 78, the `err instanceof Error` pattern in `src/components/` is reduced from 4 to 0 sites. The only remaining `err instanceof Error` patterns in the List 1 surface are:
- `src/app/api/memory/hindsight/route.ts:41` — `(error instanceof Error)` in a `truthy-check` (not a `?:` fallback)
- `src/app/api/memory/hindsight/route.ts:310` — `error instanceof Error ? error.message : "Hindsight error"` (1 site, in a List 1 API route)

The `api/memory/hindsight/route.ts:310` site is the only remaining inline `err instanceof Error` pattern in the List 1 surface. Out of scope for "AT LEAST identical results" — would change the user-visible body string for non-Error throws. Will catch in a future List 1 session.

## Why this refactor (and not the obvious candidates)

Three candidates were considered:

1. **`useApiData` adoption in `useApiData`'s 5 callers** — out of scope for "AT LEAST identical results". The hook wraps the unsafe `fetch` + `res.json()` shape in a try/catch with manual error handling. Several callers (e.g. `(main)/logs/page.tsx`) use the auto-refetch / abort pattern, which `useApiData` doesn't support (no AbortController wiring). The full sweep is a behaviour change.
2. **HindsightBrowser 4 inline `error ?? "..."` sites → runMutation migration** — out of scope. The 4 sites are toggle/delete handlers (handleToggleDirective, handleDeleteDirective, handleRefreshModel, handleDeleteModel) that don't have a single `isValid` + `busy` + `build` shape. `runMutation` requires all 4 props. Forcing the migration would change the success toast semantics (runMutation shows the successMsg before the onSuccess callback; the inline form shows the successMsg only after a refresh round-trip).
3. **`runDeployAction` consolidation** — chosen. Justified by the Rule of Three (3 sites, 30+ lines each, identical shape) and the testability of the `fallbackForDeployMessage` extraction. Pre-existing `err instanceof Error` patterns in the same handlers provided a natural 1-helper opportunity.

## Files

- `src/components/layout/Sidebar.tsx` (MODIFIED) — `runDeployAction` useCallback + 3 thin wrappers; `messageFromError` migration; 3 `DeployAction` type alias for the `expectedAction` param of `pollDeployStatus`
- `src/lib/deploy-action-fallback.ts` (NEW) — 22-line pure helper
- `src/app/(main)/sessions/[id]/page.tsx` (MODIFIED) — 1 `messageFromError` migration
- `tests/unit/deploy-action-fallback.test.ts` (NEW) — 7 unit tests
- `references/control-hub-list1-session78-findings.md` (NEW) — this file

## Verification

- All 1197 unit tests pass (189 suites, +7 from this session)
- `npx tsc --noEmit` clean
- `CI=true npx eslint . --max-warnings 0` clean
- `npm run build` passes
- Byte-equivalent at runtime for the 3 deploy actions (same fetch URL, same body, same poll behavior, same error envelope)
- 1 documented quirk preserved: the restart catch block sets the message to the literal startedMessage on network failure (no "started" word to match). Pre-existing behaviour.

## "Next session should:" block (carried forward)

1. **`useApiData` adoption in `(main)/logs/page.tsx`** — the page is the only List 1 file that uses a manual `useEffect` + `useInterval` + `setRefreshing` + `handleScroll` pattern around a log fetch. The hook can be extended to support the auto-refresh + auto-scroll pattern.
2. **`HindsightBrowser` 4 inline `error ?? "..."` sites** — would need a `runMutation`-shaped variant for the toggle/delete handlers. Defer until a 2nd consumer (e.g. the cron page) wants the same shape.
3. **`api/memory/hindsight/route.ts:310`** — the only remaining inline `err instanceof Error` pattern in List 1 territory. Out of scope for "AT LEAST identical results" — would change the user-visible body for non-Error throws from "Hindsight error" to the empty string + the catch (currently the route returns `{error: ""}` for non-Error throws, which is a real bug — the empty message then displays in the toast as "Failed to load memories" via the `error || data?.data?.error || "Failed to load ..."` fallback).
4. **`Sidebar.tsx`'s `openCheckDropdown` / `handleDropdownConfirm` / `doCheck` triplet** — 3 similar patterns for the version-check dropdown. Lower-value than the deploy consolidation but a candidate for a future session.
5. **Sessions page `loadSessions` data fetching** — uses `apiFetch` + try/catch, could be ported to `useApiData` with the abort pattern extended. Out of scope for behaviour-equivalent sweep.
6. **`useMissionsPage.ts` decomposition** — 1180 LOC, still the biggest hook in the codebase. List 2 territory.
