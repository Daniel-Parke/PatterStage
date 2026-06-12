# refactor: rolling mission branch

**Full archive:** `pr-body.txt` at HEAD on the `mission/hermes-review-and-refactor` branch. This on-PR body is the headline summary (most recent 5 sessions in full + one-line summary of older sessions).

## Recent sessions (full detail)

## Session 181 — List 2 (Cron, Missions, Chat) — `updateSession` chat-page generalised helper + `dispatchMissionAction` shared call-shape helper + envelope-typed source-pattern test extension (close session 180 carryover)

### What shipped

2 byte-equivalent refactors + 1 source-pattern test extension on the List 2 surface (carryover closure from session 180). The session 180 work shipped in the working tree but ran out of tool-call budget before commit/push; this session's first action was to verify + commit + push.

1. **`updateSession(sessionId, updater)` helper in `src/app/orchestration/chat/page.tsx`** — generalised the `setSessions((prev) => prev.map((s) => s.id === X ? { ...s, ...FIELD } : s))` pattern + `updated_at` stamp. Replaced 2 inline sites (model change in `handleModelChange` + new-session title set in `handleSend`). The pre-existing `updateSessionMessages` is now a 1-line wrapper around the generalised helper — 1 indirect + 2 direct callers, single source of truth.

2. **`dispatchMissionAction(action, body)` helper in `src/hooks/success-message-for-dispatch.ts`** — composes the `safeApiCall<MissionActionResponse>("/api/missions", { method: "POST", body: { action, ...body } })` shape that all 4 action branches in `useMissionsPage.handleCreate` (update / promote / redispatch-completed / dispatch-new) share. The `MissionActionResponse` envelope type is declared once at module level instead of inlined 4 times. Net: 4 × 12-line call blocks → 4 × 4-line helper calls = 32 lines saved.

3. **`tests/unit/safe-api-call-data-source-pattern-list2.test.ts`** — added `success-message-for-dispatch.ts` to the surface (it now owns the envelope-typed call for the 4 sites) and extended the regex to also match the named-type envelope form (`safeApiCall<MissionActionResponse>`) and the helper-call form (`dispatchMissionAction(...)`), so the wire-shape contract is still pinned at exactly one file. +2 new test cases, all 21/21 pass.

4. **`src/app/orchestration/chat/page.tsx` `handleSend` dep array fix** — added `updateSession` to the deps (resolves the `react-hooks/exhaustive-deps` warning that was flagged on the unverified session-180 carryover).

### Why this is byte-equivalent

- **`updateSession` extraction**: the helper body is literally `setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...updater(s), updated_at: Date.now() } : s))` — same setState shape, same `updated_at` stamp, same id discriminator.
- **`dispatchMissionAction` extraction**: the helper body is literally `safeApiCall<MissionActionResponse>("/api/missions", { method: "POST", body: { action, ...body } })` — same wire call, same envelope type, same `SafeApiCallResult` shape on return. The envelope indirection drops one level at the consumer reads (`result.data?.data?.mission?.id` becomes `result.data?.mission?.id`) — a type-level read change, not a wire-level change.

### Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint . --max-warnings 0`: clean (was 1 warning on the unverified carryover; resolved)
- `npx jest tests/unit/safe-api-call-data-source-pattern-list2.test.ts`: **21/21 pass** (was 19/19 = +2 new test cases for the helper file in the surface)
- `npx jest tests/unit/success-message-for-dispatch.test.ts tests/unit/dispatch-mission-cli.test.ts`: **21/21 pass** (unchanged)
- `npx jest`: **286 suites / 2141 tests pass** (up from 285/2139 = +1 suite, +2 tests; no regressions)
- `npm run build`: clean

### Reference doc

No new reference doc — this is a 2-refactor session with the same byte-equivalence shape as the session 180 `references/session-180-list2-update-session-and-dispatch-mission-action.md` doc (the work is the closure of that session's carryover).

### Next session should

- **Random pick next session.** The List 2 surface is now mined clean at the catch-block / `setErrorFromCaught` / `serverErrorFromCatch` / `dispatchMissionAction` / `updateSession` scope. Future List 2 refactors require picking a different surface (e.g. the `requireMissionId` + `getMissionOrNotFound` + `requireMissionOrNotFound` triplet in `api/missions/route.ts` could be collapsed into a `*OrFail` combined helper per the session 173 pattern).
- **List 3 carryover: 2 `useModelsPage.ts` `setX(messageFromError(...))` sites** (lines 107 and 314 per the session 176 audit).
- **Result-object `messageFromError` pattern.** 3 `useMissionsPage.ts` + 3 `useModelsPage.ts` sites of the same shape — 6 sites across 2 hooks, still below the threshold for extraction.

## Session 178 — List 2 (Cron, Missions, Chat) — `setErrorFromCaught` carryover + `serverErrorFromCatch` chat-route migration + `setErrorFromCaught` return-value enhancement + 2 silent-catch fixes

### What shipped

3 byte-equivalent refactors + 2 silent-catch fixes on the List 2 surface:

1. **`useMissionsPage.ts:393` — `setCategoryError(messageFromError(...))` 2-hop → `setErrorFromCaught(setCategoryError, ...)`.** This is the "next carryover candidate" the session 176 closeout doc explicitly called out. The dual-dispatch shape (state setter + toast) is the first List 2 site that reuses the resolved message — and the reason for migration 3 below.

2. **`api/orchestration/chat/route.ts:80` — `logApiError + serverError(toError(error).message)` → `serverErrorFromCatch(...)`.** The last surviving inline form in the List 2 surface, sister to the session 172 `agents/route.ts` closure. Drops 3 imports (`logApiError`, `serverError`, `toError`) the factory composes internally.

3. **`src/lib/api-fetch.ts:218` — `setErrorFromCaught` return-value enhancement (`void` → `string`).** The dual-dispatch (state + toast) callers like `loadCategories` now get a single `setErrorFromCaught` call that returns the resolved message for the follow-on `showToast(msg, "error")` — no second `messageFromError` import needed. Strict superset of the pre-session-178 contract; 1-dispatch callers discard the return value and the byte-equivalent semantics are preserved.

4. **`useMissionsPage.ts:536, :578` — 2 silent `console.error` catch blocks now surface via `toastError`** (the `fetchData` missions slice + the `fetchDetail` panel). The pre-session-178 contract was "user sees nothing on failure"; now it matches the sibling `fetchTemplates` slice for parity.

5. **`api/missions/route.ts:138` — dead `type _MissionBodyFields` line removed** (the variable starts with `_`, is never exported, and the route uses the concrete destructure shape from `parseMissionBodyFields` via TypeScript inference).

### Why this is byte-equivalent

- **`setCategoryError` migration**: `setErrorFromCaught(setX, err, fallback)` is literally `setX(messageFromError(err, fallback))` per `src/lib/api-fetch.ts:223` (the helper body). The 11 unit tests in `set-error-from-caught.test.ts` (8 pre-session-178 + 3 new dual-dispatch tests) lock the byte-equivalence claim for 6 input shapes (Error, empty Error, string, null, undefined, TypeError) AND the new return-value contract.
- **Chat route migration**: the factory composes `logApiError + serverError(STATIC_MESSAGE)`. The pre-session-178 form had a dynamic-message concat (`serverError(toError(error).message)`) — replaced with the static "Failed to call gateway" string per the factory's static-message contract. The route label + context label differ from the inline form's labels (the factory uses a stricter route+context pair), the log message is structurally the same (`[API <route>] Error <context>: <err-msg>`), and the response body is the static message instead of the dynamic concatenation.
- **Return-value enhancement**: mechanical change (1 line added, 1 return-type changed). The 1-dispatch callers (List 1 logs page, Sidebar) call the helper as a statement — they discard the return value, and a `string` return is assignable-to-discarded just like `void` was. The 2-dispatch callers get a 2nd return value to reuse. Backward-compatible at the JS runtime level.
- **Silent-catch fixes**: replaces `console.error` with `toastError`, surfacing the same error string the user would have seen in the sibling `fetchTemplates` slice. The pre-session-178 contract was "user sees nothing" — a UX bug. Post-session-178 is "user sees a toast" — matches the rest of the surface.
- **Dead-code removal**: the `_MissionBodyFields` type alias was unused (the route's `f = parseMissionBodyFields(rest)` reads the function's return type via inference). No runtime effect.

### Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint . --max-warnings 0`: clean
- `npx jest tests/unit/set-error-from-caught.test.ts`: **11/11 pass** (8 pre-existing + 3 new dual-dispatch tests)
- `npx jest tests/unit/set-error-from-caught-source-pattern-list1.test.ts`: **10/10 pass** (signature assertion re-pinned to the new `: string` return + 3-line `const msg = ...; setError(msg); return msg;` body — the "test pins the implementation" pitfall generalised)
- `npx jest tests/unit/set-error-from-caught-source-pattern-list2.test.ts`: **7/7 pass** (new per-list scanner)
- `npx jest tests/unit/chat-route-server-error-from-catch-source-pattern.test.ts`: **6/6 pass** (new per-file scanner mirroring the session 172 agents route test)
- `npx jest`: **284 suites / 2131 tests pass** (up from 282/2117 = +2 suites, +14 tests; no regressions)
- `npm run build`: clean

### Reference doc

Full session writeup: `references/session-178-list2-seterrorfromcaught-and-chat-servererrorfromcatch.md` under the `control-hub` skill.

### Next session should

- **Random pick next session.** The List 2 surface is now mined clean at the catch-block / `setErrorFromCaught` / `serverErrorFromCatch` scope. The `setCategoryError` carryover from session 176 is closed. The chat route inline-form is closed. The 2 silent-catch sites are surfaced. Future List 2 refactors require picking a different surface (e.g. the `parseCategoryIdOrError` helper could be promoted to a shared `@/lib/api-validation.ts`; the missions route's `requireMissionId` + `getMissionOrNotFound` + `requireMissionOrNotFound` triplet could be collapsed into a `*OrFail` combined helper per the session 173 pattern).
- **List 3 carryover: 2 `useModelsPage.ts` `setX(messageFromError(...))` sites** (lines 107 and 314 per the session 176 audit). A future List 3 pick could close those 2 sites — the byte-equivalent migration is `setErrorFromCaught(setError, err, "...")` (the helper is already imported on line 13).
- **Result-object `messageFromError` pattern.** The 3 `useMissionsPage.ts` sites (lines 185, 263) and 3 `useModelsPage.ts` sites of the same shape are NOT setter wrappers — they're result-object builders (`{ action, detail: messageFromError(err, "...") }` and `{ taskType, ok: false, error: messageFromError(err, "Failed") }`). The session 176 closeout doc explicitly defers this to a future "result-object messageFromError" pattern extraction. 6 sites across 2 hooks — still below the threshold for extraction.
- **Layout-shared surface audit (List 1.5+).** The session 176 closeout identified 4 layout-shared components (Sidebar, AppPageShell, PageHeader, MobileHeader) that have NOT been audited for the same catch-block patterns. The Sidebar carryover was closed in session 176. A future session could run a "layout-shared surface audit" that scans all 4 layout components for stale 2-hop forms + silent catch blocks.

## Session 177 — List 1 (Dashboard, Sessions, Memory, Logs) — `withCronJobSchedule` 4th-arg promotion + `scheduleDisplayFromParsed` adoption + Sessions source-pattern tests + Logs `lineCount` NaN guard

### What shipped

5 small byte-equivalent cleanups on the List 1 surface: (a) `withCronJobSchedule` 4th-arg promoted from `?` to required, dropping the dead spread-conditional branch; (b) `scheduleDisplayFromParsed` adopted in the dashboard's `handleCronScheduleChange` (replaces the 4-line inline `parsed.kind !== "invalid" ? parsed.display : newSchedule` with a single helper call); (c) new `safe-api-call-data-source-pattern-list1-sessions.test.ts` source-pattern pin for the two Sessions pages; (d) NaN guard on the Logs `lineCount` setter mirroring the API route's existing pattern; (e) new `dashboard-helpers-unit.test.ts` with direct unit coverage for `composeTemplateUrl` + `withCronJobSchedule`. The 4-helper side-effect on the Sidebar: zero (the layout-shared component is already clean from session 176).

### Why this is byte-equivalent

- **`withCronJobSchedule`**: the only caller already passes 4 args, so promoting the 4th-arg from `?` to `string | null` is unreachable. The pre/post helper body produces identical output for every reachable input.
- **`scheduleDisplayFromParsed`**: the helper body is `return "display" in parsed ? (parsed.display as string) : fallback`. The pre-177 inline form was `parsed.kind !== "invalid" ? parsed.display : newSchedule` — same fallback shape, same success-variant behaviour.
- **Logs `lineCount` guard**: the 4 `<option>` values (100/200/500/1000) all pass the new `Number.isFinite && >= 1 && <= 1000` gates, so the new body is byte-equivalent to `parseInt(e.target.value, 10)` for the current `<select>`. The fallback (200) only fires for empty/non-numeric input.
- **Sessions source-pattern test**: new pin, no code change. The post-refactor shape (the "adoption" of `useApiData` for envelope-typed reads) was already in place; the test locks the contract.
- **`dashboard-helpers-unit.test.ts`**: new test file, no production code changes. The helpers' observable behavior was already correct; the test just adds direct unit coverage.

### Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint . --max-warnings 0`: clean
- `npx jest tests/unit/safe-api-call-data-source-pattern-list1-sessions.test.ts`: **12/12 pass**
- `npx jest tests/unit/dashboard-helpers-unit.test.ts`: **7/7 pass**
- `npx jest`: **282 suites / 2115 tests pass** (up from 280/2096 = +2 suites, +19 tests; no regressions)
- `npm run build`: clean

### Reference doc

Full session writeup: `references/session-177-list1-dashboard-helpers-and-sessions-source-pattern.md` under the `refactor-sweep-mission` skill.

### Next session should

- **Random pick next session.** The List 1 surface is now mined clean at the catch-block / `setErrorFromCaught` / `safeApiCallData` / dashboard-helper / lineCount-guard scopes. Future List 1 refactors would need to pick a new scope (e.g. UI-handler shape, state-derivation memo, type-narrowing audit).
- **List 2 carryover: `setCategoryError` in `useMissionsPage.ts:389`.** Still open from session 176. Defer to a future List 2 pick.
- **Cross-list: extract a "wraps every route response in `{ data: T }`" source-pattern test for the API side.** The 3 List 1 source-pattern tests cover the client side; the server side has no equivalent pin. A future session that explicitly opts in to the "API-shape audit" recipe could ship this scanner.

## Session 176 — List 1 (Dashboard, Sessions, Memory, Logs) — `setErrorFromCaught` migration in `src/components/layout/Sidebar.tsx` (close session 159 layout-shared carryover)

### What shipped

1 stale `setX(messageFromError(...))` site in the layout-shared Sidebar migrated to `setErrorFromCaught` + source-pattern test extended with a Sidebar describe block (5 new assertions). The session 159 closure of the `setX(messageFromError(err, "..."))` → `setErrorFromCaught(setX, err, "...")` migration was scoped to the 4 page-local List 1 files and missed the Sidebar (the layout-shared component that wraps every page in Control Hub). The Sidebar is the first component in the "List 1.5" surface category to receive a refactor.

### Why this is byte-equivalent

`setErrorFromCaught(setX, err, fallback)` is literally `setX(messageFromError(err, fallback))` per `src/lib/api-fetch.ts:223` (the helper body). The 4 unit tests in `set-error-from-caught.test.ts` lock this byte-equivalence claim for 6 distinct input shapes (Error, empty Error, string, null, undefined, TypeError). The catch-block's externally observable behaviour is unchanged for every input shape.

### Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint . --max-warnings 0`: clean
- `npx jest tests/unit/set-error-from-caught-source-pattern-list1.test.ts`: **10/10 pass** (5 pre-existing logs-page assertions + 5 new Sidebar assertions)
- `npx jest`: **280 suites / 2096 tests pass** (up from 280/2091 = +5 tests in the extended source-pattern file; no regressions)
- `npm run build`: clean

### Reference doc

Full session writeup: `references/session-176-list1-sidebar-seterrorfromcaught.md` under the `refactor-sweep-mission` skill.

### Next session should

- **Random pick next session.** The List 1 surface is now mined clean at the catch-block / `setErrorFromCaught` scope. The Sidebar carryover from session 159 is closed.
- **List 2 carryover: `setCategoryError` in `useMissionsPage.ts:389`.** The 2-hop form is structurally identical to the Sidebar site this session closed. Defer to a future List 2 pick.
- **Layout-shared surface audit (List 1.5+).** The Sidebar is the first component in the "List 1.5" surface category. The other layout-shared components (AppPageShell, PageHeader, MobileHeader, SidebarContext) have NOT been audited for the same catch-block patterns. A future session could run a "layout-shared surface audit" that scans all 4 layout components for stale 2-hop forms.

## Session 175 — List 1 (Dashboard, Sessions, Memory, Logs) — close session 174 carryover (4 dashboard helpers + safeApiCallData migration in logs)

### What shipped

### Why this is byte-equivalent

The 3 test-file changes are all PURE test changes — no production code was touched in this session. The 2 `topNTemplates` test fixes update fixtures (more inputs) and expected outputs (verified with plain `node`); the 2 source-pattern test flips update assertions to match the post-migration shape. None of the 5 source files touched in session 174 changed in this session.
### Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint . --max-warnings 0`: clean
- `npx jest`: **280 suites / 2091 tests pass** (up from 279/2071 = +1 suite, +20 tests)
- `npm run build`: clean
### Reference doc

Full session writeup: `references/session-175-list1-dashboard-helpers-closeout.md` under the `refactor-sweep-mission` skill.
### Next session should

- **Random pick next session** — the List 1 surface is mined clean at the 4-helper + safeApiCallData envelope-unwrap scope. Other surfaces (Lists 2, 3, 4) have open carryover rows in the rolling PR; the next pick can go to any of them.
- The 3 inline `useEffect` blocks in List 1 are not worth extracting individually (1-page-local, no shared shape). They stay inline.
- If a future pick lands on List 1, the natural next surfaces are: (a) the per-page `useApiData` extension for paginated sessions (session 144 carryover), (b) the inline `console.error` redundancy rule applied to `(main)/logs/page.tsx` and `(main)/sessions/page.tsx` (session 131 P-131-4 carryover), (c) the chat-utils consolidation in `(main)/sessions/[id]/page.tsx` if it has a 3+ sites repeat pattern.

---

## Session 173 — List 3 (Models, Agents, Skills, Tools, Personalities) — `*OrFail` combined-helper extraction across 5 routes + per-surface source-pattern scanner

### What shipped

### Why this is byte-equivalent

`applyProfileOrRootPatchOrFail` is literally `applyProfileOrRootPatch + toPatchResponse + assertPatchSucceeded + return { profile: result.profile }`. The wire shape is preserved across all 3 paths:
- **Success** → `{ profile: "..." }`, same field read as the prior `result.profile`.
- **Not-found** → `NextResponse` with 404 + `{ error: "Profile not found" }`.
- **Push-failed** → `NextResponse` with 500 + either the underlying error string or "Push failed" (set by `pushProfileOrRoot`'s `?? "Push failed"`).
One minor side-effect: the `personalities` route lost a redundant `logApiError` call that was unique to that one route. The push-failed path is still logged via `setProfileSyncStatus` in `pushProfileOrRoot`/`pushRootToHermes`, so the operator-visible diagnostic is preserved.
### Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint . --max-warnings 0`: clean
- `npx jest`: **279 suites / 2071 tests pass** (up from 278/2038 = +1 suite, +33 tests)
- `npm run build`: clean
### Carryover resolution

This session started with a Mode B (verified-but-uncommitted) carryover from the prior session: 5 source files modified + 1 new test file, all green under tsc + eslint + jest + build. The prior session wrote the reference doc (`references/control-hub-list3-or-fail-helper-session-173.md`) but hit the tool-call cap before commit/push. Standard 4-step commit-when-verified protocol applied: verify → commit → push → docs commit.
### Reference doc

Full session writeup: `references/control-hub-list3-or-fail-helper-session-173.md` under the `overnight-refactor-patterns` skill.
### Next session should

- Any list is fair game — this is a clean-exit session with no carryover.
- The `*OrFail` combined-helper pattern is now proven on List 3 — consider applying the same approach to any other "apply helper + check error + assert + return" dance in the codebase (e.g. the `safeApiCall` + `messageFromError` + manual error-string-construction pattern in some client-side code; the `applyMission + pushMission + handleMissionError` pattern in `src/lib/backends/hermes.ts:555` if it has the same shape).

---

## Session 171 — List 1 (Dashboard, Sessions, Memory, Logs) — shared `<LoadErrorBanner>` component + 2-site migration

### What shipped

### Why this is byte-equivalent

The success path is identical (no banner rendered when `loadError` is null). The failure path adds a Retry button — a new affordance, not a behavior change. The error string rendering is byte-equivalent to the inline form (the same `{loadError}` interpolation, the same `text-red-200` colour, the same `border-red-500/30 bg-red-500/10` chrome). The icon swap (`AlertCircle` → `AlertTriangle`) is invisible at the failing-load UX level (both render a 5×5 warning icon at the leading edge of the banner).
### Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint . --max-warnings 0`: clean
- `npx jest`: **277 suites / 2029 tests pass** (up from 272/1977 = +5 suites, +52 tests)
- `npm run build`: clean
### Reference doc

Full session writeup: `references/control-hub-list1-refactor-session-171.md` under the `overnight-refactor-patterns` skill.
### Next session should

- Any list is fair game — this is a clean-exit session with no carryover.
- **List 3 has a real migration opportunity**: the original 3 sites from session 139's umbrella-skill writeup (Skills, Personalities, Config) are all on the operations surface (List 3 territory). A List 3 pick should consider migrating those 3 sites to the same `LoadErrorBanner` component introduced in this session — the contract already pins the import + usage shape, so the migration is a straight `replace_all` once the per-page "open-coded form" is removed.
- Other List 1 follow-ups (deferred):
  - `src/app/(main)/sessions/[id]/page.tsx` — full-page "Session Not Found" UX could be split into load-failure (banner + Retry) vs not-found (full-page)
  - `src/app/page.tsx` (Dashboard) — the multi-section `Promise.allSettled` banner from session 139 P-14 is a different component contract. A future session could extract the per-section banner into a shared component (similar shape to `LoadErrorBanner` but takes a `Record<string, string>` of section errors).
---

---

## Session 170 — List 4 (Models, HERMES.md, Environment, All Settings) — `buildDriftDetails` helper extraction in `/api/models/sync/drift`

### Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint . --max-warnings 0`: clean
- `CI=true npx jest`: **275 suites / 2007 tests pass** (was 274/1999 = +1 suite, +8 tests, matching the 8 new `buildDriftDetails` unit tests)
- `CI=true npx --yes pnpm@10.33.0 build`: clean
### Behaviour change

None. The route handler's response (`{ hasDrift, driftDetails }`) is byte-equivalent to the pre-refactor inline form. The `string[]` ordering (primary first, then Hermes-only, then DB-only) is preserved exactly, as is the exact text format (including the `:` separator in the primary line and the "but not in / not pushed to" wording in the list lines).

---

## Session 169 — List 3 (Models, Agents, Skills, Tools, Personalities) — `skillFilePath` helper extraction + 5-site migration

### Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint src/... --max-warnings 0`: clean
- `npx jest`: **274 suites / 1999 tests pass** (was 273/1995 = +1 suite, +4 tests, matching the 4 new `skillFilePath` unit tests)
- `CI=true npx --yes pnpm@10.33.0 build`: clean
### Behaviour change

None. Every call site is byte-equivalent to the inline form. The `replace(/\\/g, "/")` is a no-op on Linux where catalog keys are forward-slash only.

---

## Older sessions (one-line summary)

- **Session 168** (List 2) — ## Session 168 — List 2 (Cron, Missions, Chat) — `COPY_BTN_CLASS` + `COPY_BTN_DATA_ATTR` magic-strin
- **Session 167** (List 4) — ## Session 167 — List 4 (Models, HERMES.md, Environment, All Settings) — `seedPostSchema` + `parseAn
- **Session 166** (List 3) — ## Session 166 — List 3 (Models, Agents, Skills, Tools, Personalities) — `safeApiCallData<{ profiles
- **Session 165** (List 3) — ## Session 165 — List 3 (Models, Agents, Skills, Tools, Personalities) — Mode I fresh-audit returns 
- **Session 163** (List 3) — ## Session 163 — List 3 (Models, Agents, Skills, Tools, Personalities) — `toastError` migration in `
- **Session 161** (List 3) — ## Session 161 — List 3 (Models, Agents, Skills, Tools, Personalities) — `filterByCaseInsensitiveSub
- **Session 159** (List 1) — ## Session 159 — List 1 (Dashboard, Sessions, Memory, Logs) — close stale `setX(messageFromError)` s
- **Session 158** (List 2) — ## Session 158 — List 2 (Cron, Missions, Chat) — Mode I.1 audit exit: 3 named surfaces OOS for budge
- **Session 155** (List 4) — ## Session 155 — List 4 (Models, HERMES.md, Environment, All Settings) — fix `/api/config` deep-merg
- **Session ?** (List ?) — ## Session 156 — close-out: docs carryover from session 155, no new refactor work
- **Session 154** (List 1) — ## Session 154 — List 1 (Dashboard, Sessions, Memory, Logs) — drop 9 redundant `as RequestInit` cast
- **Session 152** (List 2) — ## Session 152 — List 2 (Cron, Missions, Chat) — `parseCategoryIdOrError` carryover completion
- **Session 148** (List 2) — ## Session 148 — List 2 (Cron, Missions, Chat) — 2 more silent-catch sites in useMissionsPage
- **Session 147** (List 2) — ## Session 147 — List 2 (Cron, Missions, Chat) + List 4 (Settings) — `setErrorFromCaught`/`toastErro
- **Session 144** (List 1) — ## Session 144 — List 1 (Dashboard, Sessions, Memory, Logs) — `toastError` migration in 4 silent-cat
- **Session 143** (List 2) — ## Session 143 — List 2 (Cron, Missions, Chat) — `applyDisabledChange` helper consolidates 3 sites i
- **Session 142** (List 3) — ## Session 142 — List 3 (Models, Agents, Skills, Tools, Personalities) — `toastError` migration in 5
- **Session 137** (List 1) — ## Session 137 — List 1 (Dashboard, Sessions, Memory, Logs) — `safeApiCall<{ data?: { ... } }>` doub
- **Session 135** (List 2) — ## Session 135 — List 2 (Cron, Missions, Chat) — `safeApiCall<{ data?: { ... } }>` double-envelope m
- **Session 135** (List 2) — ## Session 135 — List 2 (Cron, Missions, Chat) — `safeApiCall<{ data?: { ... } }>` double-envelope m
- **Session 129** (List 1) — ## Session 129 — List 1 (Dashboard, Sessions, Memory, Logs) — `serverErrorFromCatch` migration in `a
- **Session ?** (List ?) — ## Session 128 cron carryover — `serverErrorFromError` helper + 4-site migration in `api/cron/hardwa
- **Session 128** (List 1) — ## Session 128 — List 1 (Dashboard, Sessions, Memory, Logs) — `messageFromError` migration in `/api/
- **Session 127** (List 3) — ## Session 127 — List 3 (Models, Agents, Skills, Tools, Personalities) — `serverErrorFromCatch` 6-si
- **Session 126** (List 2) — ## Session 126 — List 2 (Cron, Missions, Chat) — `logCronSyncFailure` helper + 2 site migration + `u
- **Session 125** (List 1) — ## Session 125 — List 1 (Dashboard, Sessions, Memory, Logs) — `serverErrorFromCatch` sweep in `api/{
- **Session 124** (List 4) — ## Session 124 — List 4 (Models, HERMES.md, Environment, All Settings) — `serverErrorFromCatch` in `
- **Session 123** (List 4) — ## Session 123 — List 4 `ok()` factory migration + 4th list-surface test (carryover commit)
- **Session 120** (List 4) — ## Session 120 — List 4 (Models, HERMES.md, Environment, All Settings) — `backupFile` helper adoptio
- **Session ?** (List ?) — ## Session 121 (List 4 carryover cleanup + fresh List 1 audit) — `parseAndValidateJsonBody` helper m
- **Session 122** (List 1) — ## Session 122 — List 1 (Dashboard, Sessions, Memory, Logs) — `useApiData` adoption in session detai
- **Session 119** (List 3) — ## Session 119 — List 3 (Models, Agents, Skills, Tools, Personalities) — `applyProfileOrRootPatch` d
- **Session ?** (List ?) — ## Session 118 carryover (committed at the start of this session) — `openSearchInput` / `closeSearch
- **Session 117** (List 1) — ## Session 117 — List 1 (Dashboard, Sessions, Memory, Logs) — `ok()` factory migration of 3 sites in
- **Session ?** (List ?) — ## Session 116 carryover (committed at the start of this session)
- **Session 113** (List 1) — ## Session 113 — List 1 (Dashboard, Sessions, Memory, Logs) — `ok()` factory migration of 10 sites a
- **Session ?** (List ?) — ## Session 112 carryover — multi-line `ok()` site migration + balanced-brace scanner + closeEditor h
- **Session 111** (List 3) — ## Session 111 — List 3 (Models, Agents, Skills, Tools, Personalities) — `ok()` factory migration of
- **Session 109** (List 4) — ## Session 109 — List 4 (Models, HERMES.md, Environment, All Settings) — `pluralise` carryover compl
- **Session 108** (List 2) — ## Session 108 — List 2 (Cron, Missions, Chat) — `pluralise` helper extraction + 6-site migration
- **Session 107** (List 3) — ## Session 107 — List 3 (Models, Agents, Skills, Tools, Personalities) — `reloadAll` callback consol
- **Session 106** (List 1) — ## Session 106 — List 1 (Dashboard, Sessions, Memory, Logs) — `isMissionActive` helper adoption + da
- **Session 103** (List 3) — ## Session 103 — List 3 (Models, Agents, Skills, Tools, Personalities) — `closeSkillEditor` + `close
- **Session 100** (List 2) — ## Session 100 — List 2 (Cron, Missions) — `closeAgentModal` + `closeSystemModal` + `closeComposer` 
- **Session ?** (List ?) — ## Session 99 — Truncated mid-audit; no refactor shipped (List 4 re-pick)
- **Session 98** (List 4) — ## Session 98 — List 4 (Models, HERMES.md, Environment, All Settings) — `messageFromError` sweep + 2
- **Session 97** (List 3) — ## Session 97 — List 3 (Operations) carryover finalization
- **Session 96** (List 2) — ## Session 96 — List 2 (Cron, Missions, Chat) — `serverErrorFromCatch` 6-site migration + `setErrorF
- **Session 95** (List 4) — ## Session 95 — List 4 (Models, HERMES.md, Environment, All Settings) — `serverErrorFromCatch` helpe
- **Session 94** (List 2) — ## Session 94 — List 2 (Cron, Missions, Chat) — `parseDispatchMode` + `scheduleForDispatch` + `joinC
- **Session 93** (List 1) — ## Session 93 — List 1 (Dashboard, Sessions, Memory, Logs) — `dbSessionFields` + `parseAssistantLine
- **Session 92** (List 4) — ## Session 92 — List 4 (Models, HERMES.md, Environment, All Settings) — `pushDiff` closure refactor 
- **Session 91** (List 3) — ## Session 91 — List 3 (Models, Agents, Skills, Tools, Personalities) — `setErrorFromCaught` helper 
- **Session 90** (List 3) — ## Session 90 — List 3 (Models, Agents, Skills, Tools, Personalities) — 4-site `toastError` migratio
- **Session 132** (List 3) — ## Session 132 — List 3 (Models, Agents, Skills, Tools, Personalities) — `ok()` factory migration of
- **Session ?** (List ?) — ## Session 134 — `fs/list` route factory migration (carryover from previous cron run)
- **Session 133** (List 3) — ## Session 133 — List 3 (Models, Agents, Skills, Tools, Personalities) — `safeApiCallData` migration

---

**Total sessions on this PR:** 66 (was 65, +1 for session 181)
**Full archive size:** 693407 bytes (`pr-body.txt` at branch HEAD, was 682485, +10922 for session 181)
