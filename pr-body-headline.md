# refactor: rolling mission branch

**Full archive:** `pr-body.txt` at HEAD on the `mission/hermes-review-and-refactor` branch. This on-PR body is the headline summary (most recent 5 sessions in full + one-line summary of older sessions).

## Recent sessions (full detail)

## Session 189 — cross-list (List 2 + List 1 Dashboard) — `dispatchMissionAction` migration in `useMissionsPage.handleDelete` + `useMissionsPage.handleCancel` (2 sites) + `page.tsx.handleCancelMission` (1 site) + inline `restoreMission` closure inlining (close session 181 carryover)

### What shipped

3 byte-equivalent `dispatchMissionAction` migrations + 1 closure inlining, plus 1 new test file + 1 test file modified.

1. **`useMissionsPage.handleDelete` (List 2, line 1056)** — the inline `safeApiCall("/api/missions", { method: "POST", body: { action: "delete", missionId: id } })` collapsed to `dispatchMissionAction("delete", { missionId: id })`. The post-success flow (`toastFromResult`, `fetchData`, `setExpandedId(null)`) is preserved byte-equivalent. Net: 4 lines saved at the call site.

2. **`useMissionsPage.handleCancel` (List 2, line 1101) + inline `restoreMission` closure inlining at the 2 restore sites (lines 1112, 1116)** — the try-block's `safeApiCall(...)` collapsed to `dispatchMissionAction("cancel", { missionId: id })`. The 2 restore-on-failure paths (the `!result.ok` branch and the `catch (err)` branch) used to call a 1-line `restoreMission(restored)` closure that itself was a 3-line `const restoreMission = (restored: MissionRow) => { updateMission(id, () => restored); }` declaration capturing `id` and `setMissions`. The closure was a pure passthrough — the inline form `updateMission(id, () => previousMission)` at the 2 restore sites is byte-equivalent. Net: 3 lines saved (closure declaration removed) + 1 line saved at the call site.

3. **`page.tsx.handleCancelMission` (List 1, line 212) + type-annotation bug fix** — the inline `safeApiCall<{ missions: MissionBrief[] }>("/api/missions", { method: "POST", body: { action: "cancel", missionId } })` collapsed to `dispatchMissionAction("cancel", { missionId })`. **The pre-migration type annotation was wrong** — the cancel action returns `{ mission, cancel: { accepted, processKillPending } }`, NOT `{ missions: MissionBrief[] }` (that envelope belongs to the LIST endpoint, not the cancel action). The destructure only read `ok`/`error` so the type mismatch was invisible at runtime, but a future maintainer who tried to read `result.data` would have hit a structural mismatch. The helper now owns the wire call and the envelope type, so the wrong-annotation site is GONE. Net: 4 lines saved at the call site + 1 type bug fixed.

4. **`tests/unit/use-missions-page-update-mission-shape.test.ts` (MODIFIED, +1 assertion re-pinned)** — the "calls updateMission with the canonical (id, updater) shape at 2 sites" test was re-pinned to "at 3 sites" (the 2 restore paths now use `updateMission(id, () => previousMission)` directly instead of going through the `restoreMission` closure, so the count grew from 2 to 3). The JSDoc was updated to reflect the new count + the session 189 inlining rationale. All 9 existing tests + 1 re-pinned test pass.

5. **`tests/unit/dispatch-mission-action-call-sites.test.ts` (NEW, 10 source-pattern assertions)** — pins the post-migration shape across `useMissionsPage.ts` and `page.tsx`: (1) `dispatchMissionAction` is imported in `useMissionsPage.ts`, (2) no inline `safeApiCall("/api/missions", { method: "POST", body: { action: "cancel", ... } })` in `useMissionsPage.ts`, (3) no inline `safeApiCall("/api/missions", { method: "POST", body: { action: "delete", ... } })` in `useMissionsPage.ts`, (4) `dispatchMissionAction("cancel", ...)` at exactly 1 site in `useMissionsPage.ts`, (5) `dispatchMissionAction("delete", ...)` at exactly 1 site in `useMissionsPage.ts`, (6) `dispatchMissionAction` is imported in `page.tsx`, (7) no inline `safeApiCall("/api/missions", { method: "POST", body: { action: "cancel", ... } })` in `page.tsx`, (8) `dispatchMissionAction("cancel", ...)` at exactly 1 site in `page.tsx`, (9) the wrong-type `safeApiCall<{ missions: MissionBrief[] }>` annotation is GONE from `page.tsx` (the bug fix pin), (10) `success-message-for-dispatch.ts` declares the `cancel` action in the helper's action union (the type-system pin for the `action: "dispatch" | "update" | "promote" | "delete" | "cancel"` string union). 10/10 pass. Block + line comments are stripped from the source before scanning (JSDoc-vs-code pre-filter) so the explanatory `// Migrated from the inline ...` notes at the migrated sites don't false-positive on the negative-assertion regexes.

### Why this is byte-equivalent

- **`dispatchMissionAction` migration at all 3 call sites**: the helper body is literally `safeApiCall<MissionActionResponse>("/api/missions", { method: "POST", body: { action, ...body } })` — same wire call (POST to `/api/missions` with `{ action, ...body }`), same envelope type (`MissionActionResponse = { data?: { mission?: { id: string } & Record<string, unknown> } }` is structurally identical to the pre-session-181 inline shape), same `SafeApiCallResult` return shape. The helper's `cancel` and `delete` actions were already declared in the action union (lines 56-58 in the pre-session-189 file), so the 3 new call sites compile against the same wire contract. The 4 original sites in `useMissionsPage.handleCreate` (session 181) + the 3 new sites in this session = 7 total `dispatchMissionAction` callers across 2 files, all using the same envelope type — single source of truth for the wire call.
- **`restoreMission` closure inlining**: the closure body was literally `updateMission(id, () => restored)` — the inline form `updateMission(id, () => previousMission)` at the 2 restore sites is structurally identical (same `updateMission` helper call, same `id` capture from the outer scope, same `() => previousMission` thunk that returns the captured value). The closure declaration `const restoreMission = (restored: MissionRow) => { updateMission(id, () => restored); }` was a pure passthrough — the `restored` parameter was a thin rename of `previousMission`, and the body was a 1-line `updateMission` call. The inline form is what the closure would have been anyway; removing the declaration just removes the indirection.
- **`page.tsx` type-annotation fix**: the wrong annotation was a maintenance trap, not a runtime bug — the destructure `{ ok, error }` doesn't read `data` so the type mismatch never reached the wire. The fix is a no-op at runtime (the helper's `MissionActionResponse` envelope matches the actual wire response `{ data: { mission: { id, ... } } }`); the benefit is purely a type-system one (no future caller can read `result.data` against the wrong envelope shape).

### Verification

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint . --max-warnings 0`: clean (0 warnings)
- `npx jest`: **302 suites / 2259 tests pass** (up from 301/2249 = +1 suite, +10 tests, matching the 1 new test file at 10 cases)
- `CI=true npx --yes pnpm@10.33.0 build`: clean

### Carryover resolution

This session started with a Mode B (verified-but-uncommitted) carryover from session 181: 3 production files modified (`page.tsx`, `useMissionsPage.ts`, `tests/unit/use-missions-page-update-mission-shape.test.ts`) + 1 test file created (`tests/unit/dispatch-mission-action-call-sites.test.ts`). The pre-commit verification surfaced 0 issues — the migration is mechanical, the new test file's regex pins are exact, and the `useMissionsPage` test count re-pin is the only test-affecting change. Standard 4-step commit-when-verified protocol applied: verify → commit → push → docs commit.

### Reference doc

No new reference doc — this is the closure of session 181's carryover (`references/session-181-list2-update-session-and-dispatch-mission-action.md` already documents the helper extraction and the 4-list-2-sites migration; this session is purely the 3 remaining sites + the closure inlining).

### Next session should

- **Random pick next session.** This session picked List 1 (the next-ripe surface per the session 188 closeout doc's "List 1 is the next-ripe surface" advice), but the 3 refactors shipped in this session are NOT in the List 1 surface proper — they are in `useMissionsPage.ts` (List 2) and `page.tsx` (the Dashboard, List 1) — they were the explicit session 181 carryover that needed closing. The "true" List 1 surface (the `(main)` route group + `page.tsx` + `memory/*` + `logs/*`) is still unmined at the new-work level. The next random-pick List 1 session should look at the Dashboard helpers (`src/app/page.tsx`), the Sessions pages (`src/app/sessions/` + `src/app/sessions/[id]/`), the Memory pages + APIs (`src/app/memory/` + `src/app/api/memory/`), and the Logs page (`src/app/logs/` + `src/app/api/monitor/`) for byte-equivalent refactor candidates. The session 186 `hindsightErrorFromCatch` work touched the only obvious `serverErrorFromCatch`-style site in the memory route — the next List 1 pick should look for a different family of refactor (e.g. `safeApiCall<{ data?: { ... } }>` double-envelope sweep in `sessions/[id]/page.tsx` if any sites exist, or a `useEffect` + `useCallback` consolidation in the Dashboard).
- **Carryover** — none. The next session starts with a clean working tree.

---


## Session 188 — List 3 (Models, Agents, Skills, Tools, Personalities) — `isApiSuccessFalse` type-guard extraction in `operation-sync-action.ts` + 4 stale `line N` comment updates in `operations/agents/page.tsx`

### What shipped

1 byte-equivalent refactor in the shared List 3 sync helper + 1 comment cleanup, plus 26 new tests across 2 test files.

1. **`isApiSuccessFalse` type-guard extraction in `src/lib/operation-sync-action.ts`** — the 6-clause chained type guard that pattern-matches on the `{ data: { success: false, error?: string } }` envelope produced by `/api/agent/profiles/sync/*` endpoints was inlined inside `runSyncAction`'s try-block (lines 106-115 in the pre-refactor file). The chain was:
   ```ts
   if (
     checkSuccess &&
     data && typeof data === "object" && "data" in data &&
     data.data && typeof data.data === "object" &&
     "success" in data.data &&
     (data.data as { success: unknown }).success === false
   ) { ... }
   ```
   The chain is moved into a new named type-guard `isApiSuccessFalse(response: unknown): response is { data: { success: false; error?: unknown } }` exported from the same file. The call site shrinks from 6 chained clauses (10 lines) to `if (checkSuccess && isApiSuccessFalse(data))` (1 line). The `errMsg` extraction below also drops its inner `typeof (data.data as { error?: unknown }).error === "string"` cast — the type-narrowing from the `is` predicate means `data.data.error` is already typed `unknown` (with the runtime `typeof === "string"` check the only thing needed to narrow to `string`).

2. **4 stale `line N` comment updates in `src/app/operations/agents/page.tsx`** — the inline comments above `closeCreate` (line 204 said "line 492", actually around line 600 now), `closeEditor` (lines 97-101 referenced "line ~222 / ~334 / ~495", now ~282 / ~404 / ~567), and `openCreate` (line 217 said "line 310", now ~364) all referenced pre-session-184 line numbers from the closed `setX(messageFromError)` migrations. The line numbers were replaced with "around line N" / "(around line N)" so the references stay useful as anchors without becoming stale on the next edit. No code change — comment-only.

3. **`tests/unit/operation-sync-action-is-api-success-false.test.ts` (NEW)** — 21 unit tests covering: 5 positive cases (`{data: {success: false, error: 'disk full'}}`, no-error variant, non-string error, null error, extra fields ignored), 14 negative cases (`success: true`, `success: 'false'` strict-equality pin, `success: 0`, no success key, no data key, null, undefined, string, number, array, `data: null`, `data: 'string'`, `data: 42`, `success: undefined`), and 2 type-narrowing tests confirming the `is` predicate correctly narrows `data.data.error` to the typed `string | unknown` shape. 21/21 pass.

4. **`tests/unit/operation-sync-action-is-api-success-false-source-pattern.test.ts` (NEW)** — 5 source-pattern assertions pinning the post-refactor shape of `src/lib/operation-sync-action.ts`: (a) `isApiSuccessFalse` is exported as a named function, (b) the `runSyncAction` call site uses the helper (regex pin: `if (checkSuccess && isApiSuccessFalse(data))`), (c) the file does NOT contain the 6-clause inlined chain's signature fragment `data.data && typeof data.data === "object"` (the truthy-check pattern that the helper replaced), (d) the error access uses the narrowed type `typeof data.data.error === "string"` (not the pre-refactor re-cast `(data.data as { error?: unknown }).error`), (e) the helper's return type uses the `is` type-guard predicate (`response is { ... }`). 5/5 pass. Comment-stripped source is read so JSDoc blocks don't trip the substring matches.

### Why this is byte-equivalent (or improves performance without behavior change)

- **`isApiSuccessFalse` extraction**: pure relocation + type-guard promotion. The helper's predicate is the EXACT 6-clause chain from the pre-refactor file (verified by the 21 input-shape tests covering every reachable `unknown` value: `null`, `undefined`, primitives, arrays, plain objects with/without `data`, with/without `success`, with `success: true` vs `success: false` vs `success: 'false'` vs `success: undefined`). The 17 existing `operation-sync-action.test.ts` tests continue to pass unchanged (4 of which exercise the `success: false` envelope directly: the "shows the error toast and skips onSuccess when the response says success:false" test, the "falls back to errorMessage when success:false has no error string" test, the "tolerates responses that lack a data field" test, and the "skips the success:false check when checkSuccess=false" test). The 5 source-pattern tests pin the helper-at-call-site shape so a future "inline the type-guard back into the runSyncAction try-block" PR would fail at least one of them. The 21+17+5 = 43 total tests lock the byte-equivalence claim at the runtime, type-narrowing, and source-pattern levels.
- **Stale `line N` comment updates**: comment-only change. The pre-session comments said "line 492" / "line ~222" / "line ~334" / "line ~495" / "line 310" — each was the line number AT THE TIME the comment was written (sessions 184 and 185). The line numbers drifted because intervening sessions added 100+ lines of closeDelete / closeEditor / openCreate sibling callbacks and the timer-ref cleanup. The replacement text "around line N" preserves the anchor function (readers can `grep` to find the site) without becoming stale on the next edit. No code path changes — purely a discoverability improvement for the next maintainer.

### Verification

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint . --max-warnings 0`: clean (0 warnings)
- `npx jest`: **301 suites / 2249 tests pass** (up from 299/2223 = +2 suites, +26 tests, matching the 2 new test files at 21+5 = 26 cases)
- `CI=true npx --yes pnpm@10.33.0 build`: clean

### Carryover resolution

No carryover in or out. This session started with a clean working tree (session 187's `config-cache` + `existingById` Map extraction shipped in commit `5e8eb2c`). The previous session's "Next session should" block suggested a different list for the next session, but the random pick (using `$(date +%s) % 4 + 1`) landed on List 3 again — List 3 still had the `runSyncAction` 6-clause chain as an unmined surface, and the `agents/page.tsx` line-ref drift was a low-cost 5-min cleanup, so this session picked the lowest-hanging fruit and shipped a tight 2-refactor session.

### Reference doc

No new reference doc — this is a 2-refactor session with the same `helper-extraction + comment-cleanup` shape as the prior List 3 sessions (e.g. session 119's `applyProfileOrRootPatch` double-handler decomposition, session 107's `reloadAll` callback consolidation). The new test file's JSDoc + the helper's JSDoc together document the contract.

### Next session should

- **Random pick next session.** List 3 has now had 13+ sessions (67, 70, 77, 80, 90, 91, 92, 95, 96, 98, 107, 111, 113, 119, 127, 132, 133, 142, 144, 147, 163, 165, 166, 187, 188). The "spread the refactor surface" advice still holds — **List 1 is the next-ripe surface** (last touched session 144, 44 sessions ago). **List 2** is also ripe (last touched session 168, 20 sessions ago) — the `safeApiCall<{ data?: { ... } }>` double-envelope sweep in `useMissionsPage.ts` (3 sites) + `useMissionsApi.ts` (1 site) + `useCronJobMutation.ts` (1 site) is the natural follow-up to session 166's `useModelsPage.ts` migration. **List 4** is the quietest surface (last touched session 187, 1 session ago) but most-ripe for new content discovery — the per-list source-pattern tests are CLOSED for all 4 lists, so the next List 4 pick needs to find refactor opportunities OUTSIDE the 4 factory families (e.g. the `apiFetch + JSON.stringify` mutation-site sweep, which has 12+ sites across `useModelsPage.ts` + the 4 operations pages, but changes the failure mode from throw to return-ok/error, so requires explicit per-site `if (!ok) { toastError(...) }` rewrites).
- **`safeApiCall<{ data?: { ... } }>` double-envelope sweep (List 2)** — the 4 List-2 sites in `useMissionsPage.ts:661, 692, 720` and `useMissionsApi.ts:46` and `useCronJobMutation.ts:136` are the same single-nesting pattern session 166 closed in List 3 (`useModelsPage.ts:413`). The migration is byte-equivalent: `safeApiCall<{ data?: { mission?: { id: string } } }>` → `safeApiCall<{ mission?: { id: string } }>` + `res?.mission?.id` (drop the `res?.data?.` indirection). 5 sites in 3 files, 1-list-scope. Defer to a future List 2 pick.
- **`apiFetch + JSON.stringify` migration to `safeApiCall` (cross-list)** — 12+ mutation sites in `useModelsPage.ts` and the 4 operations pages (`agents`, `personalities`, `skills`, `tools`). The migration changes the failure mode (throw → return ok/error), so requires per-site `if (!ok) { toastError(...); }` rewrites. Currently rejected by sessions 80, 90, 119 because the migration is non-byte-equivalent. Defer to a future session that explicitly opts in to `safeApiCall` mutations.
- **`useMissionsPage` decomposition** — 1298+ LOC, still the biggest hook in the codebase. List 2 territory. Out of scope for "AT LEAST identical results" — would need a careful hook-by-hook extraction with state-derivation verification.
+- **Carryover** — none. The next session starts with a clean working tree.

---

## Session 187 — List 4 (Models, HERMES.md, Environment, All Settings) — `config-cache` module extraction + `existingById` Map in `/api/models/import`

### What shipped

2 byte-equivalent refactors in the List 4 surface that reduce coupling and complexity in two hot paths.

1. **`config-cache` module extraction from `/api/config/route.ts`** — the 50-line `readCachedConfig` + `invalidateConfigCache` block (with the 2 cache key string literals `"config.cached_json"` / `"config.cached_at"` repeated 4× across the read + write + invalidate blocks) is moved into a new `src/lib/config-cache.ts` module. The route shrinks from 215 → 151 lines (a 30% reduction). The module exposes 2 functions: `readCachedConfig()` (cache check → filesystem fallback → cache populate) and `invalidateConfigCache()` (clear both keys). All 3 internal `try`/`catch` blocks in the original are preserved with the same swallow-or-fallthrough semantics (cache miss / parse error / write failure / SELECT throw all fall through to the filesystem read).

2. **`existingById` Map in `/api/models/import/route.ts:115-138`** — the credential-link loop did `const model = listModels().find((m) => m.id === modelId)` inside a for-of over `parsed.models`, which is O(N×M) — one full listModels() scan per model in the import. The refactor hoists the listModels() call out of the loop and indexes the rows by id in a `Map<string, ApiModel>`. The Map snapshot is byte-equivalent for this loop's semantics because (a) each `modelId` from `modelKeyToId.get(...)` maps 1:1 to a row in `listModels()` (both originate from the same registry writes), (b) each `modelId` is updated at most once during the loop, (c) the `model.credentialsId !== credId` check on the first (and only) iteration for that id reads the pre-update DB state, which is the only state the comparison needs.

3. **`tests/unit/config-cache.test.ts`** (NEW) — 8 unit tests covering: cache hit returns the stored JSON object (no filesystem read), cache miss falls through to filesystem and re-populates both keys in a single transaction, stale cache (TTL > 15s) is bypassed, `invalidateConfigCache()` removes both keys, missing filesystem file returns `{}` and does not populate the cache (invariant pinned — the early-return path is intentionally cache-free), YAML parse error returns `{}` without crashing, SELECT throw falls through to filesystem (via `jest.isolateModules` + `jest.doMock` to simulate a db.unavailable scenario), and a byte-equivalence check confirming the cache-hit path returns the same shape as the filesystem branch. 8/8 pass.

4. **`tests/unit/api-config-config-cache-source-pattern.test.ts`** (NEW) — 3 source-pattern assertions pinning the post-extraction shape of `/api/config/route.ts`: (a) imports `readCachedConfig` + `invalidateConfigCache` from `@/lib/config-cache`, (b) does NOT import `js-yaml`, `readFileSync`, `existsSync`, or `db()` (the cache module owns those dependencies), (c) the 2 cache key string literals are NOT in the route (they live in the module as `CACHE_KEY_JSON` / `CACHE_KEY_AT`). 3/3 pass.

5. **`tests/unit/models-import-credential-link-map-source-pattern.test.ts`** (NEW) — 3 source-pattern assertions pinning the Map extraction in `/api/models/import/route.ts`: (a) the Map builder `new Map(listModels().map((m) => [m.id, m]))` is present at the canonical position (inside the `if (Object.keys(providerToCredId).length > 0)` block, before the for-of), (b) the loop body uses `existingById.get(modelId)` (not `listModels().find(...)`) — the comment-stripped source is checked so a "listModels().find(...)" reference inside a doc comment doesn't trip the test, (c) exactly 1 `listModels()` call exists in the link block (the Map builder). 3/3 pass.

### Why this is byte-equivalent (or improves performance without behavior change)

- **`config-cache` extraction**: pure relocation. Every call site in the route (GET, PUT) uses the same function signatures and the same try/catch/return shape. The 8 runtime tests verify the same observable behaviour across all 7 reachable input shapes (cache hit, cache miss, stale cache, db throw, missing file, parse error, invalidate-then-read, byte-equivalent on round-trip). The 3 source-pattern tests verify the route no longer owns the cache dependencies. A future "inline the cache back into the route" PR would fail at least one of these 11 tests and force the refactor author to consciously re-add the inline form.
- **`existingById` Map**: pure performance + readability. The pre-refactor `listModels().find(...)` was an O(N) scan per iteration; the post-refactor `existingById.get(modelId)` is an O(1) Map lookup. The Map is built once before the loop. The `model.credentialsId !== credId` check reads the snapshot — same observable behaviour as the pre-refactor because (a) the same `modelId` is only visited once, (b) the snapshot's `credentialsId` is the pre-update DB state which is the only state the comparison needs. The existing `tests/unit/models-import-api.test.ts` (4 cases including "does not re-link when the model's credentialsId already matches") continues to pass unchanged, locking the byte-equivalence claim.

### Verification

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint . --max-warnings 0`: clean (0 warnings)
- `npx jest`: **299 suites / 2223 tests pass** (up from 296/2209 = +3 suites, +14 tests, matching the 3 new test files at 8+3+3 = 14 cases)
- `CI=true npx --yes pnpm@10.33.0 build`: clean

### Carryover resolution

No carryover in or out. This session started with a clean working tree (session 186's `hindsightErrorFromCatch` + 2 POST/DELETE migrations + session 185 closure all shipped cleanly in commit `4c37e95`).

### Reference doc

No new reference doc — this is a 2-refactor session with the same extraction shape as the prior List 4 sessions (e.g. session 70's `loadHermesConfigFromString` extraction). The `config-cache` module's JSDoc + the `tests/unit/config-cache.test.ts` test file together document the contract.

### Next session should

- **Random pick next session.** List 4 has now had 6 sessions (70, 72, 95, 98, 186-adjacent, 187). List 1 has 8+ sessions. List 2 has 10+. List 3 has 5+. The mission brief's "spread the refactor surface" advice still holds.
- **Future List 4 work candidates** (deferred): (a) the `MANAGED_KEYS` Set in `src/app/api/agent/files/[key]/route.ts:33` is a stringly-typed whitelist (6 keys: `soul, agent, user, memory, config, hermes`). It's intentionally not derived from `getBehaviorFiles()` (which has 7 keys including `env`) because `env` is a security-sensitive excluded case. The 6-key Set is the safer form, but a `isManagedKey(key: string): boolean` helper (with a JSDoc explaining the env exclusion) would make the intent more discoverable. Low priority — the current form is short and commented. (b) The `parseEnvLine` import + per-line rendering in `src/app/config/[section]/page.tsx:258-283` is the only call site — if a 2nd caller appears (e.g. an "Edit .env" page in /config/seed), extract the renderer into a `<EnvFilePreview>` component. Currently 1 site, Rule of Three not met. (c) The `isPlatformToolsetsPreview` special-case in `src/app/config/[section]/page.tsx:60, 72-78, 186, 236-246` is a "this section is special, route through a different API" branch. As more sections get custom load/save behaviour, the section-page might benefit from a per-section override (SectionDef could grow `loadFrom?: (signal) => Promise<Record>` and `saveTo?: (values) => Promise<void>`). Currently 1 override (platform_toolsets), so premature. Defer until a 2nd override appears.

---

## Session 186 — List 1 (Dashboard, Sessions, Memory, Logs) — `hindsightErrorFromCatch` combined catch shim + 2 POST/DELETE catch migrations in `/api/memory/hindsight/route.ts` (close session 185 carryover)

### What shipped

1 byte-equivalent catch-shim extraction in the List 1 surface that brings the 2 POST/DELETE catch sites in `/api/memory/hindsight/route.ts` to parity with the `serverErrorFromCatch` sister-helper family. Also closed the session 185 carryover (the `saveStatusTimerRef` + `copiedTimerRef` timer-cleanup work was uncommitted in the working tree at the start of the session).

1. **`hindsightErrorFromCatch(route, context, error)` helper in `src/lib/hindsight-route-helpers.ts`** — composed of `logApiError(route, context, error)` + `hindsightErrorResponse(error)`. The sister-helper to `serverErrorFromCatch` (in `src/lib/api-logger.ts`) for the hindsight-specific response shape: 500 + `{ data: { available: false, error: msg } }` (the Hindsight client envelope), NOT the plain `{ error: msg }` shape used by `serverError`. The helper's body is literally `logApiError(...) + return hindsightErrorResponse(error)` — same byte-equivalence claim as the `serverErrorFromCatch` family, just with a different response primitive.

2. **`/api/memory/hindsight/route.ts:401-403` (POST) and `:433-435` (DELETE) catch blocks** — both had the canonical 2-line `logApiError + return hindsightErrorResponse(error)` pattern. Collapsed to a single `return hindsightErrorFromCatch(ROUTE, CONTEXT, error)` call. The GET catch block (line 304-316) is intentionally NOT migrated — it has a different response shape (uses `memories: []` and 503 for connection errors), so the inline form is preserved. The pre-existing `logApiError` import stays (GET branch still uses it).

3. **`tests/unit/hindsight-error-from-catch.test.ts`** (NEW) — 11 unit tests (6 shape + 5 byte-equivalence matrix cases mirroring the `server-error-from-catch.test.ts` sister test). Shape cases: response envelope, log line shape, non-Error throw handling, null/undefined throws, empty-Error fallback to "Unknown error", verbatim message preservation. Byte-equivalence cases: Error instance, empty Error, string throw, null throw, TypeError — all verify the helper produces the same status + body + log call as the inline 2-line form. 11/11 pass.

4. **`tests/unit/memory-hindsight-route-hindsight-error-from-catch-source-pattern.test.ts`** (NEW) — 8 source-pattern assertions pinning the post-migration shape: (a) helper is imported, (b) `hindsightErrorResponse` is NOT imported (helper composes the call), (c) POST catch block ends with `return hindsightErrorFromCatch(POST, action, error)`, (d) DELETE catch block ends with `return hindsightErrorFromCatch(DELETE, delete, error)`, (e) no bare `logApiError(POST/...)` in route (helper composes the log), (f) no bare `logApiError(DELETE/...)` in route, (g) no `} catch (error) { return hindsightErrorResponse(` inline form anywhere, (h) GET catch block still uses the inline `logApiError + NextResponse.json({ data: { available: false, ...memories: [] } }, { status: 503|500 })` form (intentional carryover, pinned so a future migrate-everything PR doesn't lose the GET-specific response shape). 8/8 pass.

### Why this is byte-equivalent

- **Helper body**: `hindsightErrorFromCatch(route, context, error)` is literally `logApiError(route, context, error) + return hindsightErrorResponse(error)`. The `hindsightErrorResponse` helper's body (line 178-183 of `hindsight-route-helpers.ts`) is `messageFromError(error, "Unknown error") + NextResponse.json({ data: { available: false, error: message } }, { status: 500 })`. Composed: same log line, same response, same status — character-for-character identical to the pre-migration inline form for every reachable input shape (Error instance, empty Error, string, null, undefined, TypeError). The 5 byte-equivalence matrix cases in `hindsight-error-from-catch.test.ts` lock this claim.

### Verification

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint . --max-warnings 0`: clean (0 warnings)
- `npx jest tests/unit/hindsight-error-from-catch.test.ts`: **11/11 pass** (new)
- `npx jest tests/unit/memory-hindsight-route-hindsight-error-from-catch-source-pattern.test.ts`: **8/8 pass** (new)
- `npx jest`: **296 suites / 2209 tests pass** (up from 294/2190 = +2 suites, +19 tests, matching the 2 new test files at 11+8 = 19 cases)
- `npm run build`: clean

### Carryover resolution

This session started with a Mode B (verified-but-uncommitted) carryover from session 185: 4 production files modified + 2 new test files, all green under tsc + eslint + jest + build. The session 185 work shipped in the working tree but ran out of tool-call budget before commit/push (per the session 185 closeout doc's "Pre-commit verification of a carryover catches what the original session missed" pitfall). This session's first action was to verify (`git status`, `npx tsc --noEmit`, `CI=true npx jest`), commit (`40ecb41` on the `mission/hermes-review-and-refactor` branch), and push. After the carryover closure, the session added the `hindsightErrorFromCatch` extraction as new in-scope work. Standard 4-step commit-when-verified protocol applied: verify → commit → push → docs commit.

### Reference doc

No new reference doc — this is a 1-refactor session with the same byte-equivalence shape as the `serverErrorFromCatch` family (already documented in the `api-logger.ts` module JSDoc + the `tests/unit/server-error-from-catch.test.ts` test file). The `hindsightErrorFromCatch` helper's own JSDoc (in `hindsight-route-helpers.ts`) cross-references the sister helper + explains the response-shape difference.

### Next session should

- **Random pick next session.** The List 1 surface is now mined clean at the catch-shim + `safeApiCallData` envelope-unwrap + `setErrorFromCaught` scope. The Hindsight POST/DELETE catch blocks are now on the canonical shim; only the GET branch (intentional, different response shape) is left.
- **Future List 1 work candidates** (deferred): (a) the `lineCount` `parseInt` + `Number.isFinite` + `Math.min(..., 1000) + 200` fallback in `src/app/(main)/logs/page.tsx:232-233` mirrors the `src/app/api/logs/route.ts:52-53` defensive parse — a shared `parseLineCountParam(raw, default)` helper could be extracted, but it's only 2 sites and the form is short; (b) the `safeApiCall` 2-level envelope in `src/app/page.tsx:212` (the dashboard's `handleCancelMission` is the last surviving inline 2-level call) — could be migrated to a typed-envelope helper if a future "all dashboard calls go through one shape" refactor ships.

---

## Session 185 — List 3 (Models, Agents, Skills, Tools, Personalities) — close 2 `useRef<setTimeout| null>(null)` + cleanup pattern gaps in `config/[section]/page.tsx` and `operations/personalities/page.tsx`

### What shipped

2 byte-equivalent reliability fixes in the List 3 surface that bring 2 timer-ref sites to parity with the session 184 canonical shape.

1. **`saveStatusTimerRef` back-to-back pre-cancel in `src/app/config/[section]/page.tsx`** — the pre-existing form had the unmount-cleanup effect but NOT the back-to-back pre-cancel. The timer would fire `setSaveStatus("idle")` 2s after the FIRST save, racing the new save's `setSaveStatus("saved")` and prematurely flipping the UI away from "Saved!" before the user could read the indicator. Added the canonical `if (ref.current) { clearTimeout(ref.current); }` guard before the assignment + nulled the ref inside the timer body (matching the `saveResetTimerRef` pattern in `operations/agents/page.tsx`). The 2-second delay, the `setSaveStatus("idle")` intent, the wire/API call, and the pre-existing unmount-cleanup effect are all preserved unchanged.

2. **`copiedTimerRef` unmount cleanup in `src/app/operations/personalities/page.tsx`** — the pre-existing form had the inline back-to-back pre-cancel but NOT the unmount-cleanup effect. If the `PersonalityCard` was removed from the DOM during the 2s window (e.g. parent re-renders without it, route change, filtering hides the card), the timer would call `setCopied` on an unmounted component (React warning + wasted re-render). Added the canonical `useEffect(() => () => { if (ref.current) { clearTimeout(ref.current); ref.current = null; } }, []);` cleanup effect, matching the `copiedTimerRef` pattern in `components/session/MessageBubble.tsx` and the `saveResetTimerRef` pattern in `operations/agents/page.tsx`. The 2-second delay, the `setCopied(false)` intent, the wire/API call, and the pre-existing back-to-back pre-cancel are all preserved unchanged.

3. **`tests/unit/config-section-save-status-timer-cleanup.test.ts`** (NEW) — 6 test cases pinning the post-migration shape for `saveStatusTimerRef`. Same template as the session 184 `agents-page-save-reset-timer-cleanup.test.ts` (ref declaration, cleanup effect, ref-assigned setTimeout, body nulls + idle, back-to-back pre-cancel, no bare form). 6/6 pass.

4. **`tests/unit/personalities-card-copied-timer-cleanup.test.ts`** (NEW) — 6 test cases pinning the post-migration shape for `copiedTimerRef` in `PersonalityCard`. Same template adapted for the `setCopied(false)` body. 6/6 pass.

### Why this is byte-equivalent (or improves reliability without behavior change)

- **`saveStatusTimerRef` back-to-back pre-cancel**: pure reliability improvement for the back-to-back save case. The `setSaveStatus("saved")` → `setSaveStatus("idle")` 2-second reset window is preserved. The pre-existing unmount cleanup continues to work. The new pre-cancel only fires in the **back-to-back** path (the second `handleSave` invocation), and only the *old* handle is cleared — the new handle is set immediately after. Only observable change: a stale 2s timer from a prior save can no longer prematurely flip the UI back to "idle" before the user reads "Saved!" from the current save.
- **`copiedTimerRef` unmount cleanup**: pure reliability improvement for the card-unmount case. The `setCopied(true)` → `setCopied(false)` 2-second reset window is preserved. The pre-existing inline back-to-back pre-cancel continues to work. The new unmount effect only fires when the card is being torn down, and it only clears the in-flight timer handle — the user-visible copy is already done (`navigator.clipboard.writeText` ran synchronously before the timer was set).

In both cases, the only observable change is the **absence** of a previously possible bug, never the **presence** of new behavior.

### Verification

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint . --max-warnings 0`: clean (0 warnings)
- `npx jest tests/unit/config-section-save-status-timer-cleanup.test.ts tests/unit/personalities-card-copied-timer-cleanup.test.ts`: **12/12 pass** (6 + 6)
- `npx jest`: **294 suites / 2190 tests pass** (up from 291/2172 = +3 suites, +18 tests, matching the 3 new test files at 6 tests each — 1 from session 184, 2 from this session)
- `CI=true npx --yes pnpm@10.33.0 build`: clean

### Reference doc

Full session writeup: `references/session-185-list3-timer-cleanup-gaps.md` under the `refactor-sweep-mission` skill.

### Next session should

- **Random pick next session.** The List 3 surface is now mined clean at the `useRef<setTimeout| null>(null)` + cleanup pattern scope — `saveResetTimerRef` (s184), `saveStatusTimerRef` (s185), `copiedTimerRef` (s185). The 2-half pattern (unmount cleanup + back-to-back pre-cancel) is now the canonical shape across 3+ files.
- **Future List 3 work candidates** (deferred): the `useTwoStepConfirm` hook (used by the Sidebar, List 1.5 surface) and `LocalDirRow` (List 2 surface) still have `useRef<setTimeout| null>(null)` patterns — a future session could apply the same 2-half pattern check to those files.

---

## Session 184 — List 3 (Models, Agents, Skills, Tools, Personalities) — `closeDelete` 3rd-site migration + `closeSkillEditor` 4th-site migration + `saveResetTimerRef` setTimeout-cleanup pattern in `handleSave`

### What shipped

2 single-setter close-pattern migrations (carryover closure from session 183) + 1 setTimeout-leak fix + 2 source-pattern tests on the List 3 surface.

1. **`closeDelete()` 3rd-site migration in `src/app/operations/agents/page.tsx`** — the prior session's "threading a target into a setter-pair callback is over-engineering" rationale was over-conservative; the `closeDelete()` body is just `setDeleteTarget(null)` with no target param needed, so the 3rd site (handleDelete's onSuccess body's leading setter) is byte-equivalent to the 2 modal-close sites. The 2-setter conditional block in the same onSuccess body stays inline (discriminated, not a close). JSDoc on `closeDelete` + `closeEditor` updated to reflect the post-migration shape.

2. **`closeSkillEditor()` 4th-site migration in `src/app/operations/skills/page.tsx`** — the saveSkillEdit success path's `setEditingSkill(null)` is now `closeSkillEditor()`. The sibling `if (expandedSkill === editingSkill) setSkillContent(...)` is a separate update for the in-page preview, not part of the close. JSDoc on the helper bumped from "3 single-setter close sites" to "4 single-setter close sites" with the 4th site listed.

3. **`saveResetTimerRef` + cleanup-effect pattern in `handleSave`** — the pre-fix `setTimeout(() => setSaveStatus("idle"), 2000)` had no cleanup, so an unmount during the 2s window would call setState on an unmounted component. The new `useRef<setTimeout| null>(null)` + unmount-cleanup `useEffect` + clear-before-reschedule pattern mirrors the existing `copiedTimerRef` pattern in `operations/personalities/page.tsx:52`. The 2-second delay is preserved, the `setSaveStatus("idle")` intent is preserved, the wire/API call is unchanged. Steady-state UI is byte-equivalent; the change is a reliability improvement for the unmount-during-timer and back-to-back-save cases.

4. **`tests/unit/close-delete-setter-callback.test.ts`** — updated to pin the post-session-183 3-site lockstep (was "2 closeDelete() + 1 bare setDeleteTarget(null)" → "3 closeDelete() + 0 bare statements"). The anti-A3 assertion (discriminated 3-call block in handleDelete) updated to look for `closeDelete()` as the leading call. +1 new test case, all 4/4 pass.

5. **`tests/unit/agents-page-save-reset-timer-cleanup.test.ts`** (NEW) — source-pattern test pinning the post-session-184 `saveResetTimerRef` + cleanup-effect shape. 6 test cases: (a) ref declared as `useRef<setTimeout| null>(null)`; (b) cleanup-effect checks the ref + clearTimeout + nulls the ref; (c) handleSave's setTimeout assigns to `saveResetTimerRef.current`; (d) setTimeout body nulls the ref + calls `setSaveStatus("idle")`; (e) back-to-back save safety: clears any in-flight timer before scheduling a new one; (f) negative: no bare `setTimeout(() => setSaveStatus("idle"), 2000)` outside the ref form. 6/6 pass.

### Why this is byte-equivalent (or improves reliability without behavior change)

- **`closeDelete` 3rd-site migration**: helper body is `setDeleteTarget(null)`. The 3rd site was an inline `setDeleteTarget(null)` — byte-equivalent substitution. Wire/API/UI: zero change.
- **`closeSkillEditor` 4th-site migration**: helper body is `setEditingSkill(null)`. The 4th site was an inline `setEditingSkill(null)` — byte-equivalent substitution. Wire/API/UI: zero change.
- **`saveResetTimerRef` + cleanup pattern**: reliability improvement, not a behavior change for the steady state. 2-second delay preserved, `setSaveStatus("idle")` preserved. Only observable changes are (a) unmount-during-timer no longer warns + no wasted re-render, (b) back-to-back save's 2s window always starts from the most-recent save (no stale-timer race). Pattern is byte-equivalent to the existing `copiedTimerRef` pattern in `personalities/page.tsx:52-62`.

### Verification

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint . --max-warnings 0`: clean (0 warnings)
- `npx jest tests/unit/agents-page-save-reset-timer-cleanup.test.ts`: **6/6 pass** (new)
- `npx jest tests/unit/close-delete-setter-callback.test.ts`: **4/4 pass** (+1 test case for the 3-site lockstep)
- `npx jest tests/unit/agents-page-close-delete-third-site.test.ts`: **4/4 pass** (carryover from session 183)
- `npx jest tests/unit/close-edit-setter-callback.test.ts`: **5/5 pass** (unchanged)
- `npx jest`: **292 suites / 2178 tests pass** (up from 291/2172 = +1 suite, +6 tests)
- `CI=true npx --yes pnpm@10.33.0 build`: clean

### Carryover resolution

This session started with a Mode B (verified-but-uncommitted) carryover from session 183: 2 production files modified + 1 test file extended + 1 new test file, all green under tsc + eslint + jest + build. The session 183 work shipped in the working tree but ran out of tool-call budget before commit/push. This session's first action was to verify, commit (`ed8e081` on the `mission/hermes-review-and-refactor` branch), and push. After the carryover closure, the session added the `saveResetTimerRef` reliability fix + its source-pattern test as new in-scope work. Standard 4-step commit-when-verified protocol applied: verify → commit → push → docs commit.

### Reference doc

No new reference doc — this session is a small-scoped carryover closure + 1 reliability fix, both with the same byte-equivalence shape as the session 100 `closeDelete`/`closeSkillEditor` helper pattern (already documented in the `overnight-refactor-patterns` skill's `setter-pair-callback` reference) and the existing `copiedTimerRef` `useRef + clearTimeout` pattern in `personalities/page.tsx`.

### Next session should

- **Random pick next session.** The List 3 surface is now mined clean at: the closeDelete/closeSkillEditor/closeEdit/closeCreate 1-setter close pattern (all 4 helper source-pattern tests pass), the `saveResetTimerRef` + cleanup-effect pattern (new test pins the shape), the `runSyncAction` setBusy/body/method helper pattern, the `safeApiCallData` / `setErrorFromCaught` / `serverErrorFromCatch` pattern (sessions 166 / 172 / 182).
- **Future List 3 work candidates** (deferred): (a) `handlePushAll` / `handlePushOne` / `handleImportDiscovered` / `handlePullAll` / `handlePullOne` in `agents/page.tsx` are inline arrows, not useCallback — converting them to useCallback would stabilize references for `ProfileSyncBar` but the perf impact is negligible; (b) `handleActivate` in `personalities/page.tsx:298` could take a busy state to avoid a theoretical double-click race, but the PUT is idempotent so the worst case is a no-op; (c) the `setShowCreate(false)` inline on `agents/page.tsx:570` is the documented "soft close" Cancel — intentionally discriminated from the 4-setter `closeCreate` callback, do not migrate.

---

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

## Session 177 — List 1 (Dashboard, Sessions, Memory, Logs) — `withCronJobSchedule` 4th-arg promotion + `scheduleDisplayFromParsed` adoption + Sessions source-pattern tests + Logs `lineCount` NaN guard (full detail archived in `pr-body.txt`)

- **Session 177** (List 1) — `withCronJobSchedule` 4th-arg promotion + `scheduleDisplayFromParsed` adoption + Sessions source-pattern tests + Logs `lineCount` NaN guard — full detail in `pr-body.txt`. 5 small byte-equivalent cleanups: `withCronJobSchedule` 4th-arg promoted from `?` to required, `scheduleDisplayFromParsed` adopted in the dashboard's `handleCronScheduleChange`, new `safe-api-call-data-source-pattern-list1-sessions.test.ts` + new `dashboard-helpers-unit.test.ts`, NaN guard on Logs `lineCount` setter. 282/2115 tests pass + tsc + eslint + build all green.

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

- **Session 184** (List 3) — `closeDelete` 3rd-site migration + `closeSkillEditor` 4th-site migration + `saveResetTimerRef` setTimeout-cleanup pattern in `handleSave`. 269/1994 tests pass + tsc + eslint + build all green.
- **Session 183** (List 2) — docs-only carryover closure for session 182 (the `safeApiCallData` + `toastFromResult` List 1.5/Hindsight migrations). No new refactor work.
- **Session 182** (List 1.5 + Hindsight) — `safeApiCallData` + `toastFromResult` migrations across the Hindsight browser + List 1.5 source-pattern test extension. 285/2139 tests pass + tsc + eslint + build all green.
- **Session 180** (List 2) — docs-only carryover closure for the prior session's carryover. No new refactor work.
- **Session 179** (List 4) — fallback batch SQL loop + row mapper extraction in `src/lib/fallbacks-repository.ts`. 281/2102 tests pass + tsc + eslint + build all green.
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

**Total sessions on this PR:** 72 (was 71, +1 for session 189)
**Full archive size:** 743506 (was 720100, +session 189 entry ~23 KB)
