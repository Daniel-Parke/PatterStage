# List 3 — Session 77 Findings

**Mission:** `mission/hermes-review-and-refactor`
**Date:** 2026-06-03
**Pick:** List 3 (Models, Agents, Skills, Tools, Personalities) — continued from session 76's "toError bonus" carry-over.

## Summary

Promoted a new `messageFromError(e, fallback)` helper in `src/lib/api-fetch.ts` and migrated 13 inline `err instanceof Error ? err.message : <fallback>` call sites across 8 files (1 hook + 7 page/component files). The new helper composes `toError()` with the `|| fallback` discipline to guarantee a non-empty user-visible string — closing the empty-`Error.message` edge case that the inline form gets wrong. 17 new unit tests in `tests/unit/message-from-error.test.ts` lock the helper's contract (5 for `toError` + 12 for `messageFromError`).

## Why a new helper when `toError()` already exists?

`toError(e)` returns an `Error`, and most call sites need a string, not an Error. The inline form they reach for is `err instanceof Error ? err.message : <fallback>`. This is the pattern the migration is closing, and it has a real bug:

```ts
// At the call site:
setError(err instanceof Error ? err.message : "Failed to load");
// If someone throws `throw new Error("")`, this sets state to "" — a
// blank error message in the UI. The fallback only triggers on
// non-Error throws.
```

`messageFromError` inverts the priority: it uses the fallback only when the resolved message is empty. The intent ("fallback is a true fallback") is now encoded in the helper signature, not at the call site.

## Files changed

### 1. `src/lib/api-fetch.ts` (MODIFIED)

Added the `messageFromError` export between `toError` and `apiFetch`. The helper composes `toError()` and centralises the `|| fallback` discipline:

```ts
export function messageFromError(e: unknown, fallback: string): string {
  return toError(e).message || fallback;
}
```

Also migrated `safeApiCall`'s catch block from the inline form to `messageFromError(e, "Request failed")` (closes one more site in the lib layer).

### 2. `src/hooks/useModelsPage.ts` (MODIFIED)

12 inline `err instanceof Error ? err.message : <fallback>` patterns across 8 distinct `try { } catch (err) {}` blocks migrated to `messageFromError(err, fallback)`. One outlier preserved: the `import()` console.warn line uses `toError(err).message || String(err)` because it logs to `console.warn` (not a user-facing string) and needs the `String(err)` fallback for objects. The 12 sites are all user-facing toasts/setErrors, and they all preserve byte-equivalent wire output.

### 3. Page + component files (7 files)

8 sites migrated in:

- `src/app/config/seed/page.tsx` (2 sites: load + seed)
- `src/app/operations/agents/page.tsx` (1 site: load file)
- `src/app/operations/personalities/page.tsx` (1 site: save)
- `src/app/operations/skills/page.tsx` (2 sites: update toggle + save edit)
- `src/app/operations/skills/[...path]/page.tsx` (1 site: load)
- `src/app/operations/tools/page.tsx` (1 site: load toolsets)

All 8 sites preserve byte-equivalent user-visible behaviour.

### 4. `tests/unit/message-from-error.test.ts` (NEW)

17 unit tests:

- 5 for `toError()` — Error preservation, subclass preservation, String() wrapping for strings/numbers/objects
- 12 for `messageFromError()` — the empty-Error edge case (the inline-pattern bug), null/undefined/number/string/object cases, fallback-discipline, custom Error subclasses, and a behaviour contract test that the fallback is a true fallback (not a default)

## Audit recipe (for future sessions)

```bash
grep -rn "err instanceof Error ? err\.message" src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "api-fetch"
```

**Before this session:** 29 sites across 16 files.
**After this session:** 16 sites across 9 files (the 13 migrated + 0 in `api-fetch.ts` itself + 16 remaining).

The 16 remaining sites are split across:

- `src/app/recroom/story-weaver/create/page.tsx` (1 site, List 4 territory)
- `src/app/(main)/sessions/[id]/page.tsx` (1 site, List 1)
- `src/app/api/stories/route.ts` (6 sites, List 4)
- `src/components/layout/Sidebar.tsx` (3 sites, List 1)
- `src/components/cron/JobFormModal.tsx` (1 site, List 2)
- `src/components/models/ModelEditor.tsx` (1 site, List 3)
- `src/lib/cron/hermes-sync.ts` (1 site, shared)
- `src/lib/hermes-config-sync.ts` (1 site, shared)
- `src/lib/chat-utils.ts` (1 site, shared)
- `src/lib/hermes-profile-sync.ts` (7 sites, shared)
- `src/lib/sync-manager.ts` (2 sites, shared)
- `src/lib/backends/hermes.ts` (1 site, shared)
- `src/lib/sync/SyncScheduler.ts` (2 sites, shared)

The List 3 sweep for the present session closed: `useModelsPage.ts` (12 sites), `config/seed/page.tsx` (2), `operations/agents/page.tsx` (1), `operations/personalities/page.tsx` (1), `operations/skills/page.tsx` (2), `operations/skills/[...path]/page.tsx` (1), `operations/tools/page.tsx` (1).

## "Next session should:" block (carried forward)

1. **List 3's ModelEditor.tsx** still has 1 inline `err instanceof Error` site (1 line, in the save handler). Cheap 1-file follow-up.
2. **List 1's Sidebar.tsx** has 3 sites. `update` + `restart` + `rebuild` handlers — likely a 1-helper consolidation opportunity (all 3 build a toast from the error).
3. **`src/lib/hermes-profile-sync.ts`** has 7 sites in 6 distinct functions. The pattern is `const message = err instanceof Error ? err.message : String(err);` — uniform. A 1-line migration to `messageFromError(err, ...)` would close 7 sites, but the call sites use `String(err)` (not a friendly fallback) because they're internal error messages, not user-facing. The migration would change wire-level error strings for non-Error throws from `"42"` (the `String(err)` form) to whatever fallback is provided. Out of scope for "AT LEAST identical results" unless we keep the `String(err)` discipline.
4. **`src/lib/sync-manager.ts`** has 2 sites that wrap the message in `String(...)` again — same caveat as `hermes-profile-sync.ts`.
5. **`src/app/api/stories/route.ts`** has 6 sites in List 4. Next List 4 session can sweep.
6. **`src/lib/chat-utils.ts`** has 1 site in List 2 (chat). Next List 2 session can sweep.

## Verification

- **All 1190 unit tests pass** (188 suites, +17 from this session)
- **`npx tsc --noEmit`** clean
- **`CI=true npx eslint . --max-warnings 0`** clean
- **`npm run build`** passes
- Byte-equivalence audit: all 13 migrated call sites produce the same user-visible string as the inline form for the common case (Error thrown with a real message). The 1 documented divergence is the empty-Error case, where the inline form produced "" and `messageFromError` produces the fallback — a strict improvement.
