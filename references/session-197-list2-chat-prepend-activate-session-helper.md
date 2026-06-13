# Session 197 — List 2 (Cron, Missions, Chat) — `prependAndActivateSession` 2-setter helper extraction in `src/app/orchestration/chat/page.tsx`

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 2 (List 2: Cron, Missions, Chat).
**Outcome:** **1 byte-equivalent refactor in the List 2 surface + 1 new source-pattern test (5 assertions).** All green under tsc + eslint + full jest sweep + build.

## What shipped

1 byte-equivalent refactor + 1 new source-pattern test (5 assertions).

### 1. `prependAndActivateSession()` page-local useCallback extraction in `src/app/orchestration/chat/page.tsx`

The pre-session source had the 2-line pattern
```
setSessions((prev) => [newSession, ...prev]);
setActiveSessionId(newSession.id);
```
at exactly 2 sites:
- `handleNewChat` (the "New Chat" button — line 193–194 in the pre-session file)
- `handleSend`'s `if (newSession)` branch (line 275–276 — the first-message path that lazily creates a session when there is no active one yet)

Post-session, a single
```
const prependAndActivateSession = useCallback((newSession: ChatSession) => {
  setSessions((prev) => [newSession, ...prev]);
  setActiveSessionId(newSession.id);
}, []);
```
helper sits between `updateSessionMessages` and the load effect. The 2 call sites collapse to `prependAndActivateSession(newSession);` — a 1-line, 1-token swap. The useCallback deps arrays for `handleNewChat` and `handleSend` are extended to include `prependAndActivateSession` (the helper itself is stable via `[]` deps, so the runtime identity is unchanged).

The helper body is literally the 2-line sequence with NO logic change, NO new error handling, NO try/catch wrapper. The `useState` setters are stable, so the empty deps array preserves the byte-equivalent reference stability of the original inline form.

### 2. `tests/unit/chat-page-prepend-activate-session.test.ts` (NEW, 5 source-pattern assertions)

Pins the post-migration shape:
- (a) Helper declaration exists with the exact `useCallback((newSession: ChatSession) => { ... }, [])` signature
- (b) Empty deps array invariant (sister to session 196's close-callback empty-deps tests)
- (c) Both inline 2-line sites migrated (the discriminator: literal `[newSession, ...prev]` form appears EXACTLY once — only in the helper body)
- (d) `handleNewChat` slice contains the helper call + lacks the inline 2-line form
- (e) `handleSend` slice (first 1500 chars) contains the helper call + lacks the inline 2-line form

The test file documents the anti-migration guards: the `onClick={() => setActiveSessionId(s.id)}` JSX site at line ~454 (selecting an existing session from the sidebar — 1-setter activate-by-id, DIFFERENT shape from the 2-setter prepend-then-activate), the `setActiveSessionId(null)` clear-active site in `handleDeleteSession` (1-setter, different shape), and the `setActiveSessionId(saved[0].id)` initial-load site (1-setter, no `setSessions` to accompany it, different shape).

## Why this is byte-equivalent

- The helper body is literally `setSessions((prev) => [newSession, ...prev]); setActiveSessionId(newSession.id);` — the EXACT same 2 operations in the EXACT same order as the pre-session inline form.
- Both call sites call the helper with the EXACT same argument (`newSession`).
- No try/catch wrapper is added (the inline form never had one).
- The 2-setter sequence has no interleaved state mutations in either pre-session call site (verified by the migration — both `setSessions` and `setActiveSessionId` calls were on consecutive lines with no other code between them).

## Sister to session 196 close-callback extractions

Session 196 promoted 4 close-callbacks in the List 4 surface (1- and 2-setter close forms). Session 197 promotes a 2-setter **open** form in the List 2 surface — same `useCallback` + `[]` deps + page-local shape, same Rule of Two reasoning, same source-pattern test pattern. The List 4 close-callbacks reset state to "closed"; the List 2 prepend-and-activate callback sets state to "newly opened and selected".

## Verification (full suite)

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/app/orchestration/chat/page.tsx tests/unit/chat-page-prepend-activate-session.test.ts --max-warnings 0`: clean
- `CI=true npx jest tests/unit/chat-page-prepend-activate-session.test.ts`: **5/5 pass**
- Full `CI=true npx jest` sweep: **316 suites / 2365 tests pass** (up from 315/2360 = +1 suite, +5 tests)
- `npm run build`: clean

## What this session did NOT touch (and why)

- **The `onClick={() => setActiveSessionId(s.id)}` JSX site at line ~454** — different shape (1-setter activate-by-id, not 2-setter prepend-then-activate). Anti-migration guard documented in the test.
- **The `setActiveSessionId(null)` clear-active site in `handleDeleteSession`** — different shape (1-setter clear, no `setSessions` companion). Anti-migration guard documented in the test.
- **The `setActiveSessionId(saved[0].id)` initial-load site** — different shape (1-setter initial-load, no `setSessions` companion because the load just _reads_ `saved`, not prepends). Anti-migration guard documented in the test.
- **The `setInput("")` 2-site pair in `handleNewChat` (line 195) + `handleSend` (line 296)** — different shape (1-setter literal-empty, not a 2-setter pair). Already cleanly factored.
- **The MissionsList `onClick={() => setX(id)}` 6-site pair (setCategoryFilter, setMissionCategoryFilter, setFilter, setSearch)** — these are 1-arg parameter-passing setters, not close-callbacks. Different shape from the 2-setter pattern that motivated this refactor.

## Next session should

- **Random pick next session.** The List 2 chat-page setter-pair surface is now mined clean of the prepend-and-activate pattern. The cron page (`/orchestration/cron/page.tsx`) is already heavily refactored (8 named callbacks for open/close variants). The missions page (`/orchestration/missions/page.tsx`) is also heavily refactored.
- Candidates worth re-scanning for the next List 2 pick: (a) the 4 useState setters in `useGatewayHealth.ts` (one for online status, one for agent-default-set, one for registry model IDs, one for gateway model IDs — these are all single-state setters, NOT a duplication target), (b) the `chat-utils.ts` `escapeHtml` function (single helper, not a duplication target), (c) the `MissionCreateForm.tsx` 648-line monolith (would benefit from a sub-component split, but that crosses the "byte-equivalent" line).
- **Carryover** — none. The next session starts with a clean working tree.
