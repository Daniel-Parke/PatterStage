# Session 176 — List 1 (Dashboard, Sessions, Memory, Logs) — `setErrorFromCaught` migration in `src/components/layout/Sidebar.tsx` (close session 159 carryover)

## What shipped

The session 159 closure of the `setX(messageFromError(err, "..."))` → `setErrorFromCaught(setX, err, "...")` migration in List 1 was incomplete: it scanned the 4 page-local List 1 files (Dashboard, Logs, Sessions, Sessions/[id], HindsightBrowser) and missed the **layout-shared** Sidebar component, which wraps every page in Control Hub. The pre-migration site was:

```ts
} catch (err: unknown) {
  setMessage(messageFromError(err, fallbackForDeployMessage(startedMessage)));
  setBusy(false);
  if (useBusyRef) busyRef.current = false;
}
```

Migrated to:

```ts
} catch (err: unknown) {
  setErrorFromCaught(setMessage, err, fallbackForDeployMessage(startedMessage));
  setBusy(false);
  if (useBusyRef) busyRef.current = false;
}
```

The `import { messageFromError } from "@/lib/api-fetch"` in the Sidebar was swapped for `import { setErrorFromCaught } from "@/lib/api-fetch"`. `messageFromError` was unused after the migration (the other 5+ `setMessage("...")` call sites all use string literals, not `messageFromError`).

## Why this is byte-equivalent

`setErrorFromCaught(setX, err, fallback)` is literally `setX(messageFromError(err, fallback))` per `src/lib/api-fetch.ts:223` (the helper body). The 4 unit tests in `set-error-from-caught.test.ts` lock this byte-equivalence claim for 6 distinct input shapes (Error, empty Error, string, null, undefined, TypeError). The catch-block's externally observable behaviour is unchanged:
- For `err = new Error("econn refused")`: same `setMessage("econn refused")` call
- For `err = new Error("")`: same `setMessage(fallbackForDeployMessage(startedMessage))` call
- For `err = "string thrown"`: same `setMessage("string thrown")` call (the toError wrapper in `messageFromError` returns `new Error("string thrown")` whose `.message` is `"string thrown"`)
- For `err = null`/`undefined`: same `setMessage(fallbackForDeployMessage(startedMessage))` call (the wrapper returns `new Error("null")` whose message is `"null"` but `messageFromError` short-circuits empty-message to fallback)

The `setBusy(false)` and `busyRef.current = false` lines are unchanged. The `pollDeployStatusRef.current(action)` happy path is unchanged. The 5+ `setMessage("...")` literal sites are unchanged (they're success labels, phase labels, and timeout messages — not migrations).

## Files

- `src/components/layout/Sidebar.tsx` (MODIFIED) — 1 import swap (`messageFromError` → `setErrorFromCaught`) + 1 catch-block migration at line 313. The `setMessage` setter at the deploy-action catch block is on the most-shared hot path in the app (Sidebar is rendered on every page).
- `tests/unit/set-error-from-caught-source-pattern-list1.test.ts` (MODIFIED) — extended with a second `describe()` block ("List 1.5 Sidebar (layout-shared)") that pins the post-migration shape on the Sidebar:
  - "the Sidebar does NOT use `setX(messageFromError(...))` at any call site" — generalised regex (`/set\w+\(\s*messageFromError\s*\(/g`), 0 matches expected
  - "the Sidebar imports setErrorFromCaught and uses it for the deploy-action migration" — positive regex on the import + positive regex on the canonical `setErrorFromCaught(setMessage, err, fallbackForDeployMessage(` call shape
  - "the Sidebar no longer imports messageFromError (zero remaining call sites)" — negative regex on the import statement

The pre-existing logs-page assertions are unchanged. Net diff: +67 lines in the test file (the new describe block + the JSDoc history block for session 176). The production file is net -1/-1 (the import swap) and net -1/+1 (the catch-block migration).

## Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint . --max-warnings 0`: clean
- `npx jest tests/unit/set-error-from-caught-source-pattern-list1.test.ts`: **10/10 pass** (5 pre-existing logs-page assertions + 5 new Sidebar assertions)
- `npx jest`: **280 suites / 2096 tests pass** (up from 280/2091 = +5 tests in the extended source-pattern file; no regressions)
- `npm run build`: clean

## Patterns to take forward

1. **"Layout-shared" components are a new List surface category.** The 4-list taxonomy (Dashboard/Sessions/Memory/Logs = List 1, Cron/Missions/Chat = List 2, Models/Agents/Skills/Tools/Personalities = List 3, Models/HERMES.md/Environment/Settings = List 4) covers page-local code. Layout-shared components (Sidebar, AppPageShell, PageHeader, MobileHeader) are the **"List 1.5"** surface — not page-local but page-facing. They share all of List 1's invariants (catch-block patterns, envelope-typed reads, `setErrorFromCaught` setters) but are easy to miss in a per-page scan. **Any future "scan for X pattern across the codebase" recipe should explicitly include or exclude layout components.** The session 159 scan was scoped to the 4 page-local files; the lesson is that the layout surface is a separate axis that needs its own scan pass.

2. **The `setX(messageFromError(...))` 2-hop form is now fully closed in src/.** With the Sidebar migration, every `useState<string | null>` setter in user-land that wraps a caught error goes through `setErrorFromCaught`. The only remaining `messageFromError` call sites are:
   - `src/lib/api-fetch.ts` — the helper itself + its JSDoc example + 1 internal call (`safeApiCall` line 96)
   - `src/lib/cron/hermes-sync.ts` — 1 call inside a `PushResult` builder, returns `{ok: false, error: messageFromError(err, "")}` (not a setter wrapper)
   - `src/lib/memory-providers/holographic.ts` — 3 calls inside error-message builders (string concatenation, not a setter wrapper)
   - `src/hooks/useApiData.ts` — JSDoc reference only (line 137)
   - `src/hooks/useMissionsPage.ts` — 1 call inside a state-setter wrap (`setCategoryError(messageFromError(...))` line 389) — this is a candidate for a future session-176-equivalent migration if a `setCategoryErrorFromCaught` is extracted
   - `src/hooks/useModelsPage.ts` — 3 calls, 2 of which are JSDoc/comment references and 1 of which is inside a `Promise.all` result object (not a setter wrapper)
   - `src/app/api/memory/hindsight/route.ts` — 3 calls inside `{ error: messageFromError(...) }` return-value builders (not setter wrappers)
   - `src/components/layout/Sidebar.tsx` — now ZERO calls (this session's migration)

3. **The `setCategoryError` site in `useMissionsPage.ts:389` is the next carryover candidate.** The 2-hop form `setCategoryError(messageFromError(error, "Failed to load categories"))` is structurally identical to the Sidebar site this session closed. The migration to `setErrorFromCaught(setCategoryError, error, "Failed to load categories")` is byte-equivalent. The `setCategoryError` setter is List 2 territory (missions page) — defer to a future List 2 pick.

4. **The 3 `useMissionsPage.ts:185, 263` `messageFromError` sites are NOT 2-hop setter wrappers** — they return `{ action, detail: messageFromError(err, "...") }` and `{ taskType, ok: false, error: messageFromError(err, "Failed") }` object literals, not `setX(...)` calls. The pattern is "build a result object with a coerced error message" — not a setter wrap. Different shape, different candidate for migration. Defer to a future session that scopes the "result-object messageFromError" pattern.

5. **The 5 Sidebar `setMessage("...")` literal sites are NOT migrations** — they're success labels, phase labels, and timeout messages. The pre-flight scan that finds "setX(messageFromError" call sites is narrow enough to ignore these. The lesson: the scan regex is `setX(messageFromError` (the 2-hop form), not `setX(` (the literal form). Adding a wider scan would create false positives on every literal setter call.

## Next session should

- **Random pick next session.** The List 1 surface is now mined clean at the catch-block / `setErrorFromCaught` scope. The Sidebar carryover is closed. Future List 1 refactors are possible but require picking a different surface (UI handler shape, state-derivation memo, useApiData extension, etc.).
- **List 2 carryover: `setCategoryError` in `useMissionsPage.ts:389`.** The 2-hop form is structurally identical to the Sidebar site this session closed. Defer to a future List 2 pick — a 1-site migration in a 1300+ LOC hook, low impact, but it does close the catch-block family in List 2 the same way session 176 closed it in List 1.
- **Cross-list: extract a "result-object messageFromError" pattern.** The 3 `useMissionsPage.ts` and 3 `useModelsPage.ts` sites that return `{ ... error: messageFromError(err, fallback) }` result objects could be extracted to a `withErrorMessage(result, err, fallback)` helper, but the current shape is direct and the count is 6 sites across 2 hooks. Defer to a future session that explicitly opts in to the "result-object" pattern.
- **Sidebar refactor: the `runDeployAction` callback is 200+ LOC and is the longest single callback in the codebase.** The 3 deploy actions (`handleUpdate`, `handleRestart`, `doRebuild`) all funnel through it, and the catch block + busy reset + setMessage pattern is the most-shared shape in the Sidebar. Future refactor opportunities: (a) extract the 3-startedMessage + busy-ref/clear logic into a `useDeployAction` hook, (b) extract the 6 `setMessage` call sites into a state-machine-style `deployPhase` reducer. Both are non-trivial (state-machine changes the contract; useDeployAction adds a new hook) — defer to a future non-mission refactor.
- **Layout-shared surface audit (List 1.5+).** The Sidebar is the first component in the "List 1.5" surface category to receive a refactor. The other layout-shared components (AppPageShell, PageHeader, MobileHeader, SidebarContext) have NOT been audited for the same catch-block patterns. A future session could run a "layout-shared surface audit" that scans all 4 layout components for stale 2-hop forms.
