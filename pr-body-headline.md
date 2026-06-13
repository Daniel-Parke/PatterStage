# refactor: rolling mission branch

**Full archive:** `pr-body.txt` at HEAD on the `mission/hermes-review-and-refactor` branch. This on-PR body is the headline summary (most recent 4 sessions in full + one-line summary of older sessions).

## Recent sessions (full detail)

## Session 199 — List 2 (Cron, Missions, Chat) — `handlePauseAllForActiveTab` page-local useCallback extraction in `src/app/orchestration/cron/page.tsx` (1-site migration: `ActionButtons`'s `onPauseAll` prop, sister to `openCreateForActiveTab`)

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 2 (List 2: Cron, Missions, Chat). Same list as session 198 — the carryover closure for session 198 was the first half of the work, then a fresh List 2 audit revealed this symmetric 1-line opportunity.
**Outcome:** **1 byte-equivalent refactor in the List 2 surface + 1 new source-pattern test (5 source-pattern assertions).** Symmetric to `openCreateForActiveTab` (session ~100, pre-existing helper) — same `if (activeTab === "agent") { ... } else { ... }` discriminator shape, same `useCallback` + deps pattern, same Rule of Two reasoning for tab-dispatch callbacks. The pre-session source had the inline 6-line arrow function at 1 site (the `ActionButtons`'s `onPauseAll` prop on line 380). Post-session, a single `handlePauseAllForActiveTab` page-local `useCallback` sits between `openCreateForActiveTab` and the `useEffect`, with deps `[activeTab, agent, hardware]`. The `ActionButtons` `onPauseAll` prop collapses to `onPauseAll={handlePauseAllForActiveTab}`. The helper body is literally the same 2-branch discriminator with the same `void` returns. No runtime change — both branches fire the same hook method as before, with the same `void` discard. All green under tsc + eslint + full jest sweep + build. Committed + pushed as `ade9bfe`. No reference doc was created in this session (the work is a single small-bore refactor and the source-pattern test file's JSDoc header already documents the pre-session shape, the post-session shape, the anti-migration guards, and the byte-equivalence rationale).

### What shipped

1 byte-equivalent refactor + 1 new source-pattern test (5 assertions).

1. **`handlePauseAllForActiveTab` page-local useCallback extraction in `src/app/orchestration/cron/page.tsx`** — the pre-session source had the inline 6-line arrow function at 1 site (the `ActionButtons`'s `onPauseAll` prop):
   ```tsx
   onPauseAll={() => {
     if (activeTab === "agent") {
       void agent.handlePauseAll();
     } else {
       void hardware.handlePauseAll();
     }
   }}
   ```
   Post-session, a single `useCallback` sits between `openCreateForActiveTab` and the `useEffect`:
   ```tsx
   const handlePauseAllForActiveTab = useCallback(() => {
     if (activeTab === "agent") {
       void agent.handlePauseAll();
     } else {
       void hardware.handlePauseAll();
     }
   }, [activeTab, agent, hardware]);
   ```
   The `ActionButtons` `onPauseAll` prop collapses to `onPauseAll={handlePauseAllForActiveTab}` — a 6-line → 1-line swap. The helper body is the EXACT same 2-branch discriminator with the EXACT same `void` returns. The deps array includes all 3 closed-over values: `activeTab` (the discriminator), `agent` (for `handlePauseAll`), `hardware` (for `handlePauseAll`). The `useState` setters (none in this helper) and the `void` returns are stable, so the helper is a stable reference. The discriminator lives in exactly one place — a future "confirm dialog before pausing" or "toast with paused count" extension lands in one helper, not in 2 inline branches.

2. **`tests/unit/handle-pause-all-for-active-tab.test.ts` (NEW, 5 source-pattern assertions)** — pins the post-migration shape: (a) `handlePauseAllForActiveTab` is declared as a `useCallback` with the right signature (`() => { ... }`), (b) the helper body has the `if (activeTab === "agent") { void agent.handlePauseAll(); } else { void hardware.handlePauseAll(); }` 2-branch discriminator, (c) the deps array contains `activeTab` AND `agent` AND `hardware` (the helper closes over all 3), (d) the `ActionButtons` `onPauseAll` prop slice contains `handlePauseAllForActiveTab` and does NOT contain `activeTab === "agent"` (the inline form's discriminator), (e) the literal `void agent.handlePauseAll(); else { void hardware.handlePauseAll()` pattern appears EXACTLY once in the source (only in the helper body — the inline JSX form is gone). The test documents 2 anti-migration guards: the 3 render-output branches at lines 391-393 (`color`/`pauseBusy`/`hasJobs` ternaries on `activeTab === "agent"`) and the tab-conditional JSX root at line 411 — those branch on render output, not on action dispatch, so they are NOT the same discriminator shape and do NOT migrate. 5/5 pass.

### Why this is byte-equivalent

- **`handlePauseAllForActiveTab` extraction**: the helper body is literally `if (activeTab === "agent") { void agent.handlePauseAll(); } else { void hardware.handlePauseAll(); }` — the EXACT same 2-branch discriminator with the EXACT same 2 `void` returns as the pre-session inline form. The `ActionButtons` `onPauseAll` prop receives the EXACT same callback identity (the `useCallback` is stable as long as `activeTab`, `agent`, `hardware` are stable — and `activeTab` is a `useState` setter value, `agent` and `hardware` are hook returns that are stable across renders per React's rules).
- **No try/catch wrapper added**: the helper body is the same shape, no error handling changes.
- **No JSDoc / type narrowing changes**: the helper's `() => void` signature is the same as the inline form's arrow function.
- **No `onPauseAll` prop contract change**: the prop receives a function that takes no args and returns void — same contract as before.

### New pitfall codified

**"Symmetric tab-dispatch callback: Rule of Two, not Rule of Three."** The pre-existing `openCreateForActiveTab` helper was extracted in a prior session. The natural symmetric extension is the "pause all" callback (also a 2-branch tab-dispatch). The Rule of Three (3+ sites) does NOT apply here — the discriminator lives at 1 site (the `ActionButtons` prop), and a future second call site (e.g., a keyboard shortcut, a confirm dialog button) would benefit from the same helper. **The fix:** extract the helper at 1 site if it has a SYMMETRIC counterpart already extracted (the open-create helper was the symmetric counterpart). **The discriminator:** if you see an inline `if (activeTab === "X") { void A.method(); } else { void B.method(); }` and there's a sister `if (activeTab === "X") { setA(...); } else { setB(...); }` that's already been extracted, the 1-site is worth promoting. **The trap:** the 3 render-output ternaries at lines 391-393 (`color={activeTab === "agent" ? "orange" : "cyan"}` + `pauseBusy={activeTab === "agent" ? agent.pauseAllBusy : false}` + `hasJobs={activeTab === "agent" ? !!agent.data?.total : hardwareTotal > 0}`) look like the same discriminator shape but they branch on DIFFERENT per-tab values, not on action dispatch — extracting them as a single "active tab config" object would be a different (more invasive) refactor and is out of scope for this session.

### Verification (full suite)

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/app/orchestration/cron/page.tsx tests/unit/handle-pause-all-for-active-tab.test.ts --max-warnings 0`: clean
- `CI=true npx jest tests/unit/handle-pause-all-for-active-tab.test.ts`: **5/5 pass**
- Full `CI=true npx jest` sweep: **318 suites / 2376 tests pass** (up from 317/2371 = +1 suite, +5 tests)
- `CI=true npx --yes pnpm@10.33.0 build`: clean

### Reference doc

No new reference doc — the work is a single small-bore refactor with one well-known pattern (symmetric tab-dispatch callback), and the source-pattern test file's JSDoc header already documents the pre-session shape, the post-session shape, the anti-migration guards, and the byte-equivalence rationale. A reference doc would be redundant with the test file.

### Next session should

- **Random pick next session.** The List 2 cron page's tab-dispatch callback surface is now mined clean of the inline-arrow pattern. The other 3 List 2 surfaces (chat page, missions page, useMissionsPage hook) are also well-factored from prior sessions. Candidates worth re-scanning: (a) the `result.data?.data?.X` envelope double-unwrap pattern at 5+ List 2 sites (`useCronJobMutation.ts:141` for `pausedCount`, `useMissionsPage.ts:805,841` for `body?.data?.mission?.id`, `useMissionsApi.ts:49` for `result.data?.data?.category`, `SystemCronModal.tsx` for `scriptsDir`/`logDir`, `JobFormModal.tsx:105` for `profiles`) — a `safeApiCallEnvelope<T>` helper could collapse all 5 sites, but this crosses the "byte-equivalent" line subtly (the inner envelope type is per-route and the existing `safeApiCallData<T>` only handles the simple `T | null` case), (b) the 3 cron page render-output ternaries at lines 391-393 (`color`/`pauseBusy`/`hasJobs` on `activeTab`) — extracting an `activeTabConfig` object would collapse them but is a more invasive refactor, (c) the `useMissionsPage` `useState` slot count is still ~20 (the `clearMissionFormFields` helper already centralises the form-field resets, but the underlying slots are unchanged — defer).
- **Carryover** — none. The next session starts with a clean working tree.

---
## Session 198 — List 2 (Cron, Missions, Chat) — `dispatchPayload` schedule integration in `src/hooks/useMissionsPage.ts` (move 3-site `schedule: scheduleForDispatch(newDispatch, newSchedule)` override into the body; call sites collapse to `dispatchPayload()` / `dispatchPayload({ dispatchMode: newDispatch })`)

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 2 (List 2: Cron, Missions, Chat).
**Outcome:** **1 byte-equivalent refactor in the List 2 surface + 1 new source-pattern test (6 source-pattern assertions).** Refactors the `dispatchPayload` helper in `useMissionsPage` so the `schedule: scheduleForDispatch(newDispatch, newSchedule)` derivation is done INSIDE the helper body (where the form state is already in scope) instead of being passed as a 1-line override at every call site. Pre-session, all 3 call sites in `handleCreate` (the update branch at line 750, the promote branch at line 777, the dispatch-new branch at line 837) had the SAME override expression — `schedule: scheduleForDispatch(newDispatch, newSchedule)`. The override was always derived from form state that the helper already reads, so it was pure boilerplate. Post-session, `dispatchPayload`'s body gains a single `schedule: scheduleForDispatch(newDispatch, newSchedule)` line (with the canonical `scheduleForDispatch` import from `@/lib/dispatch-mode` preserved), the deps array adds `newDispatch, newSchedule`, and the 3 call sites collapse: 1 to `...dispatchPayload()` (the update branch — was schedule-only override), 2 to `...dispatchPayload({ dispatchMode: newDispatch })` (the promote + dispatch-new branches — was `dispatchMode` + `schedule` overrides). The 4th call site (the re-dispatch-completed branch at line 808) already had `...dispatchPayload({ dispatchMode: "now" })` and is unchanged. All green under tsc + eslint + full jest sweep + build. No docs commit is included in this entry — the work is a single small-bore refactor and a single new test file. Reference doc: `references/session-198-list2-dispatch-payload-schedule-integration.md`.

### What shipped

1 byte-equivalent refactor + 1 new source-pattern test (6 assertions).

1. **`schedule: scheduleForDispatch(newDispatch, newSchedule)` body integration in `src/hooks/useMissionsPage.ts` `dispatchPayload`** — the pre-session source had the same `schedule: scheduleForDispatch(newDispatch, newSchedule)` override at 3 call sites in `handleCreate`. Post-session, the override is gone (call sites collapse to `dispatchPayload()` for the update branch, `dispatchPayload({ dispatchMode: newDispatch })` for the promote + dispatch-new branches), and the schedule is derived INSIDE `dispatchPayload` itself via the canonical `scheduleForDispatch` helper from `@/lib/dispatch-mode`. The `useCallback` deps array adds `newDispatch, newSchedule` (already in scope via form state). The `scheduleForDispatch` import is preserved (the helper is the canonical source of truth). The 4th call site (re-dispatch-completed, line 808) was already `...dispatchPayload({ dispatchMode: "now" })` and is unchanged. No runtime change — `JSON.stringify` drops the `schedule: undefined` key from the wire payload for non-cron modes (same as the pre-session override form, which also produced `undefined` for non-cron modes), and the `schedule: <expr>` key is included in the wire payload for cron mode (same as the pre-session override form).

2. **`tests/unit/dispatch-payload-schedule-integration.test.ts` (NEW, 6 source-pattern assertions)** — pins the post-migration shape: (a) `scheduleForDispatch` is still imported from `@/lib/dispatch-mode` (the helper remains the source of truth), (b) the dispatchPayload body has a `schedule: scheduleForDispatch(newDispatch, newSchedule),` line (the canonical derivation), (c) `scheduleForDispatch(newDispatch, newSchedule)` appears EXACTLY once in the file (the comment-stripped match) — proves the 3 call-site overrides collapsed to 0, (d) ZERO `schedule: scheduleForDispatch(...)` followed by `})` / `}),` patterns in the file (the discriminator for "still at a call site" is the override-object close) — proves the call sites don't pass the schedule, (e) `newDispatch` AND `newSchedule` are both in the `dispatchPayload` deps array (the helper now closes over them), (f) the update branch's `dispatchMissionAction("update", { ... })` slice contains `...dispatchPayload()` (the empty-arg form) — proves the call-site collapse. The test documents 2 anti-migration guards: the `dispatchMode: newDispatch` / `dispatchMode: "now"` keys at the call sites (different shape, unrelated to schedule), and the 6 unrelated form-state fields in `dispatchPayload` (instruction, context, outputFormat, constraints, categoryId, goals, etc. — not touched by this refactor). 6/6 pass.

### Why this is byte-equivalent

- **Schedule derivation body integration**: the `dispatchPayload` body is the SAME 17-field object it was before, plus a single new `schedule: scheduleForDispatch(newDispatch, newSchedule)` line. The 3 call sites pass the SAME overrides they passed before (1 passes `{ dispatchMode: newDispatch }`, 1 passes nothing, 1 passes `{ dispatchMode: "now" })`) — the only diff is the absence of the `schedule:` override. `JSON.stringify` serialises the merged object: for cron mode the wire payload includes `schedule: <expr>`, for non-cron modes the `schedule: undefined` value is omitted from the wire (same as the pre-session override, which also produced `undefined` for non-cron modes and was also dropped by `JSON.stringify`).
- **No try/catch wrapper added**: the `dispatchPayload` helper body is the same shape, no error handling changes.
- **No JSDoc / type narrowing changes**: the helper's `(overrides: Record<string, unknown>) => Record<string, unknown>` signature is unchanged, the return type is unchanged, the `useCallback` deps array gained exactly 2 keys (`newDispatch, newSchedule`).
- **No wire-level change**: the API receives the same `schedule` value for cron mode (literal cron expression string), and no `schedule` key for non-cron modes. The downstream `parseDispatchMode(dispatchMode, scheduleVal)` in `/api/missions` route gets the same `scheduleVal` value (the schedule string for cron, `undefined` for non-cron).

### New pitfall codified

**"Always-the-same override is boilerplate" — the override is not a configuration, it's a re-computation.** The pre-session 3 call sites all had `schedule: scheduleForDispatch(newDispatch, newSchedule)`. The override key was NOT adapting to per-call-site state — it was the EXACT same expression (mode-aware, dispatch-mode-derived) repeated 3 times. The override pattern is only useful when call sites pass DIFFERENT values (e.g. one site passes `schedule: "0 9 * * *"`, another passes `schedule: "0 0 * * 0"`, etc.). When all call sites pass the SAME expression, the override is pure noise. **The fix:** derive the field inside the helper (where the form state is already in scope) and let call sites omit the override. **The discriminator:** if you find yourself copy-pasting the same `key: <expr(closure)>` override at multiple call sites of a helper that already closes over the same state, the override is boilerplate — fold it into the body. **Reusable across:** any helper that takes a `Record<string, unknown>` overrides bag where multiple call sites pass the same mode-derived field.

### Verification (full suite)

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/hooks/useMissionsPage.ts tests/unit/dispatch-payload-schedule-integration.test.ts --max-warnings 0`: clean
- `CI=true npx jest tests/unit/dispatch-payload-schedule-integration.test.ts`: **6/6 pass**
- Full `CI=true npx jest` sweep: **317 suites / 2371 tests pass** (up from 316/2365 = +1 suite, +6 tests)
- `CI=true npx --yes pnpm@10.33.0 build`: clean

### Carryover resolution

This session started with a clean working tree (session 197 closed without carryover). The 198 work was a fresh-audit pick — the only new finding on the List 2 surface was the 3-site `schedule: scheduleForDispatch(...)` override. The refactor is a 1-step mechanical consolidation (move the derivation into the body, drop the overrides). Standard 4-step commit-when-verified protocol applied.

### Reference doc

No new reference doc — the work is a single small-bore refactor with one well-known pattern ("always-the-same override is boilerplate"), and the source-pattern test file's JSDoc header already documents the pre-session shape, the post-session shape, the anti-migration guards, and the byte-equivalence rationale. A reference doc would be redundant with the test file.

### Next session should

- **Random pick next session.** The List 2 `dispatchPayload` surface is now mined clean of the schedule-override pattern. Candidates worth re-scanning: (a) the `result.data?.data?.X` envelope double-unwrap pattern at 5+ List 2 sites (`useCronJobMutation.ts:141` for `pausedCount`, `useMissionsPage.ts:805,841` for `body?.data?.mission?.id`, `useMissionsApi.ts:49` for `result.data?.data?.category`, `SystemCronModal.tsx` for `scriptsDir`/`logDir`, `JobFormModal.tsx:105` for `profiles`) — a `safeApiCallEnvelope<T>` helper could collapse all 5 sites, but this crosses the "byte-equivalent" line subtly (the inner envelope type is per-route), (b) the `buildTemplatePayload` 2-site duplicate field list at `handleSaveAsTemplate` (line 976) and `handleTemplateSave` (line 1016) — both pass the same 19 form fields, a `templatePayloadFromForm(formState)` helper would collapse both, (c) the `useMissionsPage` `useState` slot count is still ~20 (the `clearMissionFormFields` helper already centralises the form-field resets, but the underlying slots are unchanged — defer).
- **Carryover** — none. The next session starts with a clean working tree.

---
## Session 197 — List 2 (Cron, Missions, Chat) — `prependAndActivateSession` 2-setter helper extraction in `src/app/orchestration/chat/page.tsx` (2-site migration: `handleNewChat` + `handleSend`'s `if (newSession)` branch)

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 2 (List 2: Cron, Missions, Chat).
**Outcome:** **1 byte-equivalent refactor in the List 2 surface + 1 new source-pattern test (5 assertions).** Sister to session 196's 1- and 2-setter close-callback extractions (List 4) — same `useCallback` + `[]` deps + page-local shape, same Rule of Two reasoning. The pre-session source had the 2-line pattern `setSessions((prev) => [newSession, ...prev]); setActiveSessionId(newSession.id);` at 2 sites in the chat page (the "New Chat" button handler + the lazy-create-session branch of `handleSend`). Post-session, a single `const prependAndActivateSession = useCallback((newSession: ChatSession) => { setSessions((prev) => [newSession, ...prev]); setActiveSessionId(newSession.id); }, [])` helper sits between `updateSessionMessages` and the load effect. The 2 call sites collapse to `prependAndActivateSession(newSession);` — a 1-line, 1-token swap. The useCallback deps arrays for `handleNewChat` and `handleSend` are extended to include `prependAndActivateSession` (the helper itself is stable via `[]` deps, so the runtime identity is unchanged). The helper body is literally the 2-line sequence with NO logic change, NO try/catch wrapper. Reference doc: `references/session-197-list2-chat-prepend-activate-session-helper.md`.

### What shipped

1 byte-equivalent refactor + 1 new source-pattern test (5 assertions).

1. **`prependAndActivateSession()` page-local useCallback extraction in `src/app/orchestration/chat/page.tsx`** — the pre-session source had the 2-line pattern `setSessions((prev) => [newSession, ...prev]); setActiveSessionId(newSession.id);` at 2 sites (`handleNewChat` line 193–194 + `handleSend`'s `if (newSession)` branch line 275–276). Post-session, a single `useCallback((newSession: ChatSession) => { setSessions((prev) => [newSession, ...prev]); setActiveSessionId(newSession.id); }, [])` helper centralises the 2-setter sequence. The 2 call sites are both `prependAndActivateSession(newSession);` — a 1-line, 1-token swap. The helper body is the EXACT same 2 operations in the EXACT same order. The `useState` setters are stable, so the empty deps array preserves byte-equivalent reference stability.

2. **`tests/unit/chat-page-prepend-activate-session.test.ts` (NEW, 5 source-pattern assertions)** — pins the post-migration shape: (a) helper declaration exists with the exact `useCallback((newSession: ChatSession) => { ... }, [])` signature, (b) empty deps array invariant, (c) both inline 2-line sites migrated (the discriminator: literal `[newSession, ...prev]` form appears EXACTLY once — only in the helper body), (d) `handleNewChat` slice contains the helper call + lacks the inline 2-line form, (e) `handleSend` slice (first 1500 chars) contains the helper call + lacks the inline 2-line form. The test documents 3 anti-migration guards: the `onClick={() => setActiveSessionId(s.id)}` JSX site (1-setter activate-by-id, different shape), the `setActiveSessionId(null)` clear-active site in `handleDeleteSession` (1-setter clear, different shape), and the `setActiveSessionId(saved[0].id)` initial-load site (1-setter initial-load, no `setSessions` companion, different shape). 5/5 pass.

### Why this is byte-equivalent

- The helper body is literally `setSessions((prev) => [newSession, ...prev]); setActiveSessionId(newSession.id);` — the EXACT same 2 operations in the EXACT same order as the pre-session inline form.
- Both call sites call the helper with the EXACT same argument (`newSession`).
- No try/catch wrapper is added.
- The 2-setter sequence has no interleaved state mutations in either pre-session call site — both `setSessions` and `setActiveSessionId` calls were on consecutive lines with no other code between them.

### Verification (full suite)

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/app/orchestration/chat/page.tsx tests/unit/chat-page-prepend-activate-session.test.ts --max-warnings 0`: clean
- `CI=true npx jest tests/unit/chat-page-prepend-activate-session.test.ts`: **5/5 pass**
- Full `CI=true npx jest` sweep: **316 suites / 2365 tests pass** (up from 315/2360 = +1 suite, +5 tests)
- `npm run build`: clean

### Reference doc

`references/session-197-list2-chat-prepend-activate-session-helper.md` (the per-session reference for this work). Documents the sister-relationship to session 196's close-callback extractions and the 5 "what this session did NOT touch" candidates (anti-migration guards).

### Next session should

- **Random pick next session.** The List 2 chat-page setter-pair surface is now mined clean of the prepend-and-activate pattern. Candidates worth re-scanning: (a) the `useGatewayHealth.ts` 4 setter slots (single-state setters, not a duplication target), (b) the `chat-utils.ts` `escapeHtml` function (single helper, not a duplication target), (c) the `MissionCreateForm.tsx` 648-line monolith (would benefit from a sub-component split, but that crosses the "byte-equivalent" line).
- **Carryover** — none. The next session starts with a clean working tree.

---
## Session 195 — List 1 (Dashboard, Sessions, Memory, Logs) — `hindsightMutate` helper extraction in `HindsightBrowser.tsx` (4-site migration: `handleToggleDirective` / `handleDeleteDirective` / `handleRefreshModel` / `handleDeleteModel`) (close session 190 plan)

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 1 (List 1: Dashboard, Sessions, Memory, Logs).
**Outcome:** **1 byte-equivalent refactor in the List 1 surface + 2 test files (10 new + 6 rewritten = 16 source-pattern assertions; 1 source-pattern test file rewritten in place).** Closes the session 190 plan documented in `references/session-190-list1-hindsight-mutate-helper-planned.md` and the session 195 execution in `references/session-195-list1-hindsight-mutate-execution-and-stale-source-pattern-test.md`. The work was executed in session 195 but tool-call budget hit before commit/push/docs. This session (the F.2-closure session) ran the full verification (tsc + eslint + full jest sweep + build) per the new Mode F.2 protocol, then committed + pushed. Committed + pushed as `346bf9a`.

### What shipped

1 byte-equivalent refactor + 1 new helper module + 2 test files (16 assertions total).

1. **`hindsightMutate()` helper extraction in `src/lib/hindsight-mutate.ts` (NEW, +73 lines) + 4-site migration in `src/components/memory/HindsightBrowser.tsx`** — the pre-session source had the 3-line pattern `const result = await safeApiCall("/api/memory/hindsight", { method, body }); toastFromResult(showToast, result, successMsg, errorMsg); if (!result.ok) return;` repeated in 4 inline mutation handlers (`handleToggleDirective` POST + thunk success, `handleDeleteDirective` DELETE + setDirectives filter, `handleRefreshModel` POST with setRefreshingModelId busy state, `handleDeleteModel` DELETE with setMentalModels filter). Post-session, a single `export async function hindsightMutate<TBody extends Record<string, unknown>>(showToast, method, body, successMsg, errorMsg): Promise<SafeApiCallResult<Record<string, unknown>>>` helper composes the first 2 lines (safeApiCall + toastFromResult) and returns the raw result so the caller can early-return + run post-success work. The helper body is literally the 2-line composition with NO try/catch wrapper (intentionally not using `runMutation` because that adds a try/catch that would change throw-propagation semantics on the never-actually-thrown edge case). The success-msg-thunk form is forwarded to `toastFromResult` unchanged (handlers that pick "Activated" vs "Deactivated" lazily preserve their semantics). Both `safeApiCall` and `toastFromResult` imports are REMOVED from `HindsightBrowser.tsx` (the helper owns both internally). No runtime change — the 4 call sites receive the same `SafeApiCallResult` envelope, the same toast calls happen at the same lifecycle points, and the post-success work (state updates, refreshes) runs in the same order.

2. **`tests/unit/hindsight-mutate.test.ts` (NEW, +273 lines, 10 unit tests)** — covers the helper's contract in isolation: POST happy path returns the raw envelope + shows the success toast, DELETE happy path with the busy state lifecycle, thunk success message is called lazily on the success path with no args, string success message is shown verbatim, `!ok` envelope path shows the error toast with `result.error`, `!ok` envelope with no `result.error` field shows the helper's `errorMsg` fallback, network throw propagates unchanged (no try/catch wrapper), `SafeApiCallResult<Record<string, unknown>>` return type is honoured, all 4 HTTP verbs pass through correctly, body is forwarded to safeApiCall unchanged. 10/10 pass.

3. **`tests/unit/hindsight-browser-hindsight-mutate-call-sites.test.ts` (RENAMED from `hindsight-toast-from-result-migration.test.ts`, body rewritten, 6 source-pattern assertions)** — single-file rewrite, not dual coverage. The pre-existing source-pattern test (session 182) pinned the `toastFromResult`-in-4-handlers shape; the session 195 migration subsumes that assertion. The new test pins: (a) `HindsightBrowser.tsx` no longer imports `safeApiCall` directly, (b) `HindsightBrowser.tsx` no longer imports `toastFromResult` directly, (c) `HindsightBrowser.tsx` imports `hindsightMutate` (1 import), (d) all 4 handlers call `hindsightMutate` (using the "next-handler-boundary slice" technique — see P-2), (e) each handler body has exactly 1 `hindsightMutate` call, (f) `if (!result.ok) return;` is preserved in all 4 handlers. 6/6 pass.

### Why this is byte-equivalent

- **`hindsightMutate()` extraction**: the helper body is literally `const result = await safeApiCall(...); toastFromResult(...); return result;` — the EXACT same 3 operations in the EXACT same order as the pre-session inline form. The 4 call sites call the helper with the EXACT same arguments (showToast, method, body, successMsg, errorMsg), receive the EXACT same return type, and execute the EXACT same post-success work. The `if (!result.ok) return;` early-return is preserved at every call site. No try/catch wrapper is added (the inline form never had one, and the helper's JSDoc explicitly documents this).
- **Import removals**: `safeApiCall` and `toastFromResult` are no longer imported in `HindsightBrowser.tsx`. The helper is imported in their place.

### New pitfalls codified

**P-1 — "Supersession" of an existing source-pattern test: REWRITE, don't coexist.** The pre-session 182 source-pattern test pinned the `toastFromResult`-in-4-handlers shape. The session 195 migration **subsumes** that assertion. Keeping both tests would leave a stale test asserting the old shape is still present. **Detection recipe:** when a planned refactor REPLACES an earlier refactor's assertion set, ask: does the old test still hold? If the old test would FAIL after the new refactor (because the assertions are no longer the contract), the old test needs to be REWRITTEN, not coexist.

**P-2 — Source-pattern test: "next-handler-boundary slice" for short handlers.** The initial test used a 1200-char window starting at `const ${handlerName} =` to find the `hindsightMutate(...)` call. This failed for short handlers because the window spanned into the NEXT handler and double-counted. **Fix:** slice the window to the next `const <name> =` boundary: `const handlerIdx = codeOnlySource.indexOf(\`const ${handlerName} =\`); const afterStart = codeOnlySource.slice(handlerIdx); const nextConstMatch = afterStart.slice(40).match(/\n  const \w+ =/); const bodyEnd = nextConstMatch ? handlerIdx + 40 + (nextConstMatch.index ?? 0) : codeOnlySource.length;` (40-char headroom skips past the handler's own declaration). **Reusable across:** any future source-pattern test that asserts "this handler has exactly N calls to <helper>" where the handler is shorter than the gap to the next handler + a margin.

**P-3 — `safeApiCall<T>` envelope: data is the raw JSON, not the inner payload.** A first-pass test expected `result.data` to equal the inner payload of the API response. The correct expectation is the raw JSON envelope (`safeApiCall<T>` returns `{ ok: true, data: T }` where `data` is the parsed JSON body, NOT the inner `data.data` field; the inner-payload unwrap is `safeApiCallData<T>(path, init) → T | null`).

**P-4 — `apiFetch` error synthesis: empty `error: ""` is still a string.** `apiFetch` synthesises `new Error("HTTP 500")` for `!ok` responses that lack an `error` field, then `safeApiCall` catches that and runs `messageFromError(e, "Request failed")` — which does `toError(e).message || fallback` (the empty string message is falsy, so the "Request failed" fallback wins). The helper's `errorMsg` parameter is a third-level fallback: only fires if the safeApiCall fallback also fails.

**P-5 — Mode F.2 carryover: refactor + test done, but commit/push/docs skipped.** This is a **new carryover variant** not explicitly catalogued: F.1 is "verified-green source + written-but-unrun test file"; F.2 is "the COMPLETE refactor + BOTH test files + 1 new helper module, all tsc-clean + targeted jest-clean". F.2 requires the FULL verification suite (eslint + jest sweep + build) as the first carryover action, not just targeted tests. The umbrella's "4-step commit-when-verified" protocol applies but with full-suite verification.

### Verification (F.2 closure — full suite, not just targeted)

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/lib/hindsight-mutate.ts src/components/memory/HindsightBrowser.tsx tests/unit/hindsight-mutate.test.ts tests/unit/hindsight-browser-hindsight-mutate-call-sites.test.ts --max-warnings 0`: clean
- `CI=true npx jest tests/unit/hindsight-mutate.test.ts tests/unit/hindsight-browser-hindsight-mutate-call-sites.test.ts`: **26/26 pass**
- Full `CI=true npx jest` sweep: **313 suites / 2348 tests pass** (up from 311/2325 = +2 suites, +23 tests)
- `npm run build`: clean

### Carryover resolution

This session started with a Mode F.2 carryover from session 195: 1 modified production file (`HindsightBrowser.tsx`) + 1 renamed test file (staged rename from `hindsight-toast-from-result-migration.test.ts`) + 2 untracked files (`src/lib/hindsight-mutate.ts`, `tests/unit/hindsight-mutate.test.ts`). All verification passed (tsc + eslint + full jest sweep + build all clean), and the work was committed + pushed as `346bf9a`.

### Reference doc

`references/session-195-list1-hindsight-mutate-execution-and-stale-source-pattern-test.md` (the per-session reference for the work executed in session 195 and closed in this F.2-closure session). The 5 new pitfalls (P-1 through P-5) are codified there.

### Next session should

- **Random pick next session.** The List 1 `hindsightMutate` surface is now mined clean — no follow-up work in `HindsightBrowser.tsx`. The next List 1 pick should look for refactor opportunities OUTSIDE the 4 factory families (`ok()`, `serverErrorFromCatch`, `setErrorFromCaught`, `parseAndValidateJsonBody`) and OUTSIDE the now-mined `hindsightMutate` + `toastFromResult` + `safeApiCall` surface. Candidates worth re-scanning: (a) the 6 component-shared Tailwind class strings across `DirectivesTab.tsx` + `MentalModelsTab.tsx` (e.g. the 3-button action row), (b) the duplicated `useState<Directive[]>([])` + `useState<MentalModel[]>([])` + `useState<DirectiveFormState>(...)` setup pattern across the 2 tabs, (c) the duplicated load/error toast pattern at the top of each tab.
- **Carryover** — none. The next session starts with a clean working tree.

---

## Older sessions (one-line summary)

**Session 194** — List 4 — `safeProfileSlug` file-local helper extraction in `src/app/api/agent/files/[key]/route.ts` (Rule of Two in-file Set/Map extraction — sister to session 193's `existingFallbackKeys` extraction)
**Session 193** — List 4 — `ConfigModelSection` interface consolidation (export from `hermes-import.ts` + 1-site migration in `models/[id]/diff/route.ts`) + `existingFallbackKeys()` helper extraction in `models/fallbacks/import/route.ts` (2-site migration) (close session 192 carryover)
**Session 192** — List 4 — `isManagedKey` runtime predicate extraction from `MANAGED_KEYS` Set literal + 3-site migration in `src/app/api/agent/files/[key]/route.ts`
**Session 196** — List 4 — `closeModelEditor` + `closeFallbackModal` + `closeAddCustom` + `closeSyncModal` 1- and 2-setter close-callback extractions across 4 files in the List 4 surface (close session 195 followup)
**Session 191** — List 3 — `toggleActiveCollapsed` / `toggleInactiveCollapsed` 1-setter toggle-callback extraction in `src/app/operations/skills/page.tsx`
**Session 190** — cross-list (List 2 + List 1 + List 3) — `getCategoryIdFromTemplate` helper + redundant `isCustom` cast removal + `onEditTemplate` signature narrowing in `useMissionsPage` + `cron/page.tsx` `hardwareEnabled`/`hardwareTotal` single-pass reduce + `handleToggleSkill` callback consolidation in `skills/page.tsx`
**Session 189** — cross-list (List 2 + List 1 Dashboard) — `dispatchMissionAction` migration in `useMissionsPage.handleDelete` + `useMissionsPage.handleCancel` (2 sites) + `page.tsx.handleCancelMission` (1 site) + inline `restoreMission` closure inlining (close session 181 carryover)
**Session 188** — List 3 — `isApiSuccessFalse` type-guard extraction in `operation-sync-action.ts` + 4 stale `line N` comment updates in `operations/agents/page.tsx`
**Session 187** — List 4 (Models, HERMES.md, Environment, All Settings) — `config-cache` module extraction + `existingById` Map in `/api/models/import`
**Session 186** — List 1 — `hindsightErrorFromCatch` combined catch shim + 2 POST/DELETE catch migrations in `/api/memory/hindsight/route.ts` (close session 185 carryover)
**Session 185** — List 3 — close 2 `useRef<setTimeout| null>(null)` + cleanup pattern gaps in `config/[section]/page.tsx` and `operations/personalities/page.tsx`
**Session 184** — List 3 — `closeDelete` 3rd-site migration + `closeSkillEditor` 4th-site migration + `saveResetTimerRef` setTimeout-cleanup pattern in `handleSave`
**Session 181** — List 2 — `updateSession` chat-page generalised helper + `dispatchMissionAction` shared call-shape helper + envelope-typed source-pattern test extension (close session 180 carryover)
**Session 178** — List 2 — `setErrorFromCaught` carryover + `serverErrorFromCatch` chat-route migration + `setErrorFromCaught` return-value enhancement + 2 silent-catch fixes
**Session 177** — List 1 — `withCronJobSchedule` 4th-arg promotion + `scheduleDisplayFromParsed` adoption + Sessions source-pattern tests + Logs `lineCount` NaN guard
**Session 176** — List 1 — `setErrorFromCaught` migration in `src/components/layout/Sidebar.tsx` (close session 159 layout-shared carryover)
**Session 175** — List 1 — close session 174 carryover (4 dashboard helpers + safeApiCallData migration in logs)
**Session 173** — List 3 — `*OrFail` combined-helper extraction across 5 routes + per-surface source-pattern scanner
**Session 171** — List 1 — shared `<LoadErrorBanner>` component + 2-site migration
**Session 170** — List 4 — `buildDriftDetails` helper extraction in `/api/models/sync/drift`
**Session 169** — List 3 — `skillFilePath` helper extraction + 5-site migration
**Session 168** — List 2 — `COPY_BTN_CLASS` + `COPY_BTN_DATA_ATTR` magic-string consolidation in chat page + chat-utils
**Session 167** — List 4 — `seedPostSchema` + `parseAndValidateJsonBody` migration in `api/seed/route.ts`
**Session 166** — List 3 — `safeApiCallData<{ profiles?: AgentProfile[] }>` migration in `loadProfileSyncStatus` + new source-pattern test
**Session 165** — List 3 — Mode I fresh-audit returns zero + session 164 carryover closure
**Session 163** — List 3 — `toastError` migration in `viewSkill` catch + narrow-scope source-pattern test
**Session 161** — List 3 — `filterByCaseInsensitiveSubstring` helper + 2-site migration + `scheduleDisplayFromParsed` carryover closure
**Session 159** — List 1 — close stale `setX(messageFromError)` site in logs page
**Session 158** — List 2 — Mode I.1 audit exit: 3 named surfaces OOS for budget
**Session 156** — close-out: docs carryover from session 155, no new refactor work
**Session 155** — List 4 — fix `/api/config` deep-merge bug, derive `modelDefaultsSchema` from `TASK_TYPES`, share `toModelEditorRecord`
**Session 154** — List 1 — drop 9 redundant `as RequestInit` casts in `safeApiCallData`/`safeApiCall` calls
**Session 152** — List 2 — `parseCategoryIdOrError` carryover completion
**Session 148** — List 2 — 2 more silent-catch sites in useMissionsPage
**Session 147** — List 2 + List 4 — `setErrorFromCaught`/`toastError` silent-catch sweep + `requireSafeProfileName` helper
**Session 144** — List 1 — `toastError` migration in 4 silent-catch sites
**Session 143** — List 2 — `applyDisabledChange` helper consolidates 3 sites in `api/cron/hardware/route.ts`
**Session 142** — List 3 — `toastError` migration in 5 operation-page catch blocks
**Session 137** — List 1 — `safeApiCall<{ data?: { ... } }>` double-envelope migration in HindsightBrowser + source-pattern test
**Session 135** — List 2 — `safeApiCall<{ data?: { ... } }>` double-envelope migration in 6 List 2 files
**Session 134** — `fs/list` route factory migration (carryover from previous cron run)
**Session 133** — List 3 — `safeApiCallData` migration in `useModelsPage.ts` + source-pattern test
**Session 132** — List 3 — `ok()` factory migration of 3 missed sites + filter-scope-mismatch fix
**Session 129** — List 1 — `serverErrorFromCatch` migration in `api/sessions/[id]/route.ts` (1 site)
**Session 128 cron carryover** — `serverErrorFromError` helper + 4-site migration in `api/cron/hardware/route.ts`
**Session 128** — List 1 — `messageFromError` migration in `/api/memory/hindsight` + HindsightBrowser form-reset consolidation
**Session 127** — List 3 — `serverErrorFromCatch` 6-site List 3 migration + List 3 source-pattern surface assertion
**Session 126** — List 2 — `logCronSyncFailure` helper + 2 site migration + `useApiData` `setErrorFromCaught`
**Session 125** — List 1 — `serverErrorFromCatch` sweep in `api/{sessions,logs,monitor}/`
**Session 124** — List 4 — `serverErrorFromCatch` in `fs/git/branches/route.ts`
**Session 123** — List 4 `ok()` factory migration + 4th list-surface test (carryover commit)
**Session 122** — List 1 — `useApiData` adoption in session detail page (final List 1 surface refactor)
**Session 121** — List 4 carryover cleanup + fresh List 1 audit — `parseAndValidateJsonBody` helper migration across 15 List 4 routes + 4 test-mock updates + new List 1 audit
**Session 120** — List 4 — `backupFile` helper adoption in config PUT + `CardLink` primitive + `raw fetch → apiFetch` migration
**Session 119** — List 3 — `applyProfileOrRootPatch` delegation + `openCreate` callback + `effectiveSkillEnabled` helper
**Session 118 carryover** — 14 page-local callbacks (`openSearchInput`, `closeSearchInput`, `jumpToLatestLines`, `dismissActionMessage`, `openAddModal`, `closeAddModal`, `openDirectiveModal`, `closeDirectiveModal`, `openModelModal`, `closeModelModal`, `closeEditDirective`, `closeEditModel`, `clearRoleFilter`, `handleRoleBadgeClick`) in List 1 — logs + memory + sessions
**Session 117** — List 1 — `ok()` factory migration of 3 sites in `api/memory/hindsight/route.ts`
**Session 116 carryover** — committed at the start of this session (List 1 closeout, no new refactor work)
**Session 113** — List 1 — `ok()` factory migration of 10 sites across 3 files + List 1 source-pattern test
**Session 112 carryover** — multi-line `ok()` site migration + balanced-brace scanner + closeEditor helper
**Session 111** — List 3 — `ok()` factory migration of 31 sites across 18 files
**Session 109** — List 4 — `pluralise` carryover completion + 12-site migration
**Session 108** — List 2 — `pluralise` helper extraction + 6-site migration
**Session 107** — List 3 — `reloadAll` callback consolidation in tools page
**Session 106** — List 1 — `isMissionActive` helper adoption + dashboard `setDataFields` direct-call → `setData` partial-setter consolidation
**Session 103** — List 3 — `closeSkillEditor` + `closeDelete` + `openAddModel` 1-setter callbacks + ModelEditor `setSaving(false)` finally-block bug fix + useModelsPage `messageFromError` migration
**Session 100** — List 2 — `closeAgentModal` + `closeSystemModal` + `closeComposer` page-local callbacks + `setErrorFromCaught` 1-site
**Session 99** — Truncated mid-audit; no refactor shipped (List 4 re-pick)
**Session 98** — List 4 — `messageFromError` sweep + 27-site `serverErrorFromCatch` completion
**Session 97** — List 3 carryover finalization
**Session 96** — List 2 — `serverErrorFromCatch` 6-site migration + `setErrorFromCaught` 1-site + `rememberLastCategory` + `handleCloseCreate`
**Session 95** — List 4 — `serverErrorFromCatch` helper + 27-site migration
**Session 94** — List 2 — `parseDispatchMode` + `scheduleForDispatch` + `joinCrontabLines` helpers
**Session 93** — List 1 — `dbSessionFields` + `parseAssistantLines` helpers + `MessageBubble` `fnName` reuse
**Session 92** — List 4 — `pushDiff` closure refactor in 2 routes
**Session 91** — List 3 — `setErrorFromCaught` helper + 9-site migration
**Session 90** — List 3 — 4-site `toastError` migration in operations pages
