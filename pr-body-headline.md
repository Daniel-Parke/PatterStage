# refactor: rolling mission branch

**Full archive:** `pr-body.txt` at HEAD on the `mission/hermes-review-and-refactor` branch. This on-PR body is the headline summary (most recent 4 sessions in full + one-line summary of older sessions).

## Recent sessions (full detail)

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

## Session 194 — List 4 (Models, HERMES.md, Environment, All Settings) — `safeProfileSlug` file-local helper extraction in `src/app/api/agent/files/[key]/route.ts` (Rule of Two in-file Set/Map extraction — sister to session 193's `existingFallbackKeys` extraction)

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 4 (List 4: Models, HERMES.md, Environment, All Settings).
**Outcome:** **1 byte-equivalent refactor in the List 4 surface + 1 new source-pattern test (3 source-pattern assertions).** Sister to session 193's `existingFallbackKeys()` extraction — both follow the "Rule of Two for in-file Set/Map extraction" pattern. All green under tsc + eslint + jest + build. Committed + pushed as `fc62ad5`. **No docs commit was made in session 194 (the tool-call budget hit before the docs step).** This session (F.2-closure) adds the docs entry to keep the rolling PR's audit trail intact.

### What shipped

1 byte-equivalent refactor + 1 new source-pattern test (3 assertions).

1. **`safeProfileSlug()` file-local helper extraction in `src/app/api/agent/files/[key]/route.ts`** — the pre-session source had the 2-line pattern `const rawSlug = body.profile.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""); const profileSlug = rawSlug || "default";` repeated in 2 places in the same file: the `set_profile` action handler and the `save_as` action handler (both POST branches in the PUT handler). Post-session, a single `function safeProfileSlug(raw: string | undefined | null): string` helper sits above the PUT handler, applying the trim+lowercase+regex+empty-fallback chain in one place. The 2 call sites are both `const profileSlug = safeProfileSlug(body.profile);` — a 1-line, 1-token swap. The helper's JSDoc explains the slug normalisation + the "default" fallback. No runtime change — both call sites receive the EXACT same string.

2. **`tests/unit/safe-profile-slug-helper-extraction.test.ts` (NEW, 3 source-pattern assertions)** — pins the post-migration shape: (a) helper declaration exists (1 occurrence, with the exact `function safeProfileSlug(raw: string | undefined | null): string` signature), (b) the 2 call sites use the helper (2 occurrences of `safeProfileSlug(body.profile)`), (c) no inline `body.profile.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")` slug-normalisation chain outside the helper body. 3/3 pass.

### Why this is byte-equivalent

- **`safeProfileSlug()` extraction**: the helper body is literally the 3-line `trim().toLowerCase().replace().replace()` chain + the `|| "default"` fallback — the EXACT same 4 operations in the EXACT same order as the pre-session inline form. The 2 call sites pass `body.profile` (which is `string | undefined` from the request body type) and receive a `string` (the "default" fallback covers the undefined/empty case). No behavioural change for any of the 4 input shapes (normal string, whitespace, special chars, empty/undefined).

### New pitfall codified

**"Rule of Two for in-file Set/Map extraction" — sister to session 193.** The 2-line `body.profile.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "default"` pattern is a 2-place duplication that crosses the Rule of Two threshold for in-file extractions. The Rule of Three (commonly cited for cross-file duplication) does NOT apply to in-file duplication of 2+ lines — the visual signal of duplication is weaker for 2 lines than for 3+. **The fix:** extract the helper, even at 2 sites in the same file. **Detection recipe:** grep for `body.profile.trim()` or `body.name.trim()` or similar slug-normalisation chains in route files. **The trap:** the "unreachable-but-preserved defensive fallback" — the inline form had `const rawSlug = ...; const profileSlug = rawSlug || "default";` where `rawSlug` is a `string` (not `string | undefined`). The helper's signature `(raw: string | undefined | null): string` widens the parameter type to match the call site (`body.profile` is `string | undefined`), so the helper handles the undefined case explicitly while the inline form handled it implicitly via `|| "default"`. The "unreachable" part is the `null` case (the body schema doesn't allow null), but the type is widened for forward-compatibility with future body shapes that may allow null.

### Verification

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/app/api/agent/files/[key]/route.ts tests/unit/safe-profile-slug-helper-extraction.test.ts --max-warnings 0`: clean
- `CI=true npx jest tests/unit/safe-profile-slug-helper-extraction.test.ts`: **3/3 pass**
- Full `CI=true npx jest` sweep: **311 suites / 2325 tests pass** (up from 310/2322 = +1 suite, +3 tests)
- `npm run build`: clean

### Reference doc

`references/session-194-list4-safe-profile-slug-helper-extraction.md` (the per-session reference documenting the Rule of Two in-file extraction pattern, sister to session 193's `existingFallbackKeys` work).

### Next session should

- **Random pick next session.** The List 4 `safeProfileSlug` + `existingFallbackKeys` + `ConfigModelSection` + `isManagedKey` surface is now mined clean. The next List 4 pick should look for refactor opportunities OUTSIDE the 4 factory families and OUTSIDE the now-mined slug-normalisation + Set-construction + canonical-interface-export + runtime-predicate surface. Candidates worth re-scanning: the `getBundlePathMap` helper in `agent/files/[key]/route.ts:80-91` (hand-rolls a `Record<string, string>` that maps the same 8 keys to bundle paths that `getBehaviorFiles()` already publishes), the `appendAuditLine` calls across 12+ routes (could benefit from a `routeAuditSuccess(route, resource)` shorthand), the per-route `requireAuth(request)` + early-return pattern (could be a `withAuth` route wrapper — but 12+ sites means a HOC, not a helper; defer).
- **Carryover** — resolved. The next session starts with a clean working tree.

---

## Session 193 — List 4 (Models, HERMES.md, Environment, All Settings) — `ConfigModelSection` interface consolidation (export from `hermes-import.ts` + 1-site migration in `models/[id]/diff/route.ts`) + `existingFallbackKeys()` helper extraction in `models/fallbacks/import/route.ts` (2-site migration) (close session 192 carryover)

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 3 (List 3: Models, Agents, Skills, Tools, Personalities).
**Outcome:** **2 byte-equivalent refactors in the List 4 surface + 2 new test files (6 + 7 = 13 source-pattern assertions).** Both refactors close the prior session's deferred carryover — the carryover was left in a Mode B (verified-but-uncommitted) state at the end of the prior session with `git status` showing 3 modified production files + 2 untracked test files. All green under tsc + eslint + jest + build. Committed + pushed as `34a8489`.

### What shipped

2 byte-equivalent refactors + 2 new test files (13 source-pattern assertions total).

1. **`ConfigModelSection` interface consolidation across `src/lib/hermes-import.ts` (canonical source) + `src/app/api/models/[id]/diff/route.ts` (consumer)** — the pre-session source had the same 4-field interface `ConfigModelSection { default?, provider?, base_url?, context_length? }` declared in BOTH files. The canonical declaration in `hermes-import.ts` was a local interface (not exported) used internally as the `HermesYamlConfig.model?` field type. The diff route's `readHermesModelSection()` helper had its own identical-shape 7-line `interface ConfigModelSection { ... }` block. Post-session, the canonical declaration is `export interface ConfigModelSection` (with a JSDoc explaining the snake_case stability + 4-field canonical projection), and the diff route has a single `import type { ConfigModelSection } from "@/lib/hermes-import"` line. The local interface block in the diff route is REMOVED (the source-pattern test pins the absence). No runtime change — the `readHermesModelSection()` return type is byte-equivalent (same shape, same name, same field set). The internal usage in `hermes-import.ts` (the `HermesYamlConfig.model?: ConfigModelSection` reference) is unchanged — only the export keyword was added.

2. **`existingFallbackKeys()` helper extraction in `src/app/api/models/fallbacks/import/route.ts`** — the pre-session source had the 3-line pattern `const existingChain = listFallbackChain(); const existingKeys = new Set(existingChain.map((e) => fallbackKey(e.provider, e.modelIdString)));` duplicated in TWO places in the same file: the GET branch (preview) at lines 43-46 and the POST branch (skip-already-imported) at lines 99-102. Post-session, a single `function existingFallbackKeys(): Set<string>` helper sits above the GET handler, returning `new Set(listFallbackChain().map((e) => fallbackKey(e.provider, e.modelIdString)))`. The 2 call sites are both `const existingKeys = existingFallbackKeys();` — a 1-line, 1-token swap. The helper's JSDoc explains the O(1) membership guarantee + the `(provider::modelId)` key shape + the `fallbackKey()` contract reference. No runtime change — both call sites receive the same Set with the same entries; the loop bodies in both branches are byte-equivalent.

3. **`tests/unit/config-model-section-consolidation.test.ts` (NEW, 6 source-pattern assertions)** — pins the post-migration shape across the 2 affected files: (a) `hermes-import.ts` exports the interface (1 export site), (b) `hermes-import.ts` preserves the 4-field shape (default, provider, base_url, context_length), (c) `hermes-import.ts` still uses `ConfigModelSection` as the type of `HermesYamlConfig.model?` (the internal-usage preservation pin), (d) `models/[id]/diff/route.ts` imports the type (1 import site), (e) `models/[id]/diff/route.ts` no longer declares the interface locally (0 `interface ConfigModelSection` blocks), (f) `models/[id]/diff/route.ts` still uses `ConfigModelSection` as the return type of `readHermesModelSection` (the consumer-usage preservation pin). 6/6 pass.

4. **`tests/unit/fallbacks-import-route-existing-fallback-keys-migration.test.ts` (NEW, 7 source-pattern assertions)** — pins the post-migration shape of the route file: (a) helper declaration exists (1 occurrence), (b) JSDoc block on the helper mentions "O(1)" + "provider" + "modelId", (c) GET branch uses the helper (1 call), (d) POST branch uses the helper (1 call), (e) no inline `existingChain = listFallbackChain()` declaration (0 occurrences), (f) no inline `new Set(existingChain.map(` construction (0 occurrences), (g) no inline `fallbackKey(e.provider, e.modelIdString)` outside the helper body (the test splits the source at the helper declaration and asserts the inline form is absent from the rest of the file). 7/7 pass.

### Why this is byte-equivalent

- **`ConfigModelSection` consolidation**: the imported `type` alias is structurally identical to the local interface — same name, same 4 field names, same 4 field types (`string | undefined` for default/provider/base_url, `number | undefined` for context_length), same field order. The diff route's `readHermesModelSection(): ConfigModelSection | null` return type is unchanged (the helper just references the imported alias instead of the local declaration).
- **`existingFallbackKeys()` extraction**: the helper body is literally `new Set(listFallbackChain().map((e) => fallbackKey(e.provider, e.modelIdString)))` — the EXACT same construction as the pre-session inline form. The 2 call sites receive a Set with the EXACT same entries (the helper invokes `listFallbackChain()` and `fallbackKey()` with the same arguments). The downstream loops are unchanged — they read `existingKeys` as a `Set<string>` and use `.has()` for membership.

### New pitfalls codified

**"An un-exported canonical interface is a 2-place duplication waiting to be added to."** The `ConfigModelSection` interface in `hermes-import.ts` was the canonical source of truth for the `model:` section of `~/.hermes/config.yaml`, but it was `interface ConfigModelSection` (not `export interface ConfigModelSection`). The diff route's `readHermesModelSection` helper needed the same shape for its return type, so it redeclared the interface locally. The 2 declarations were byte-equivalent at session 193 start, but a future PR that adds a 5th field to the canonical would need to update BOTH declarations. **The fix:** export the canonical interface and have all consumers import the type alias. The type system then enforces single-source-of-truth. **Detection recipe:** grep the codebase for non-exported `interface \\w+ {` declarations in `src/lib/*.ts` files. **The trap:** a "type alias" (`type Foo = { ... }`) is a STRUCTURAL form, not a nominal form, so the type system would let `type Foo = { ... }` in file A and `interface Foo { ... }` in file B coexist without conflict.

**"An O(N) `.find()` per iteration is a 2-place duplication of an O(1) Set construction."** The `existingFallbackKeys` helper replaces the pattern `existingKeys.has(key)` (O(1) Set membership) with the pattern `existingChain.find(...)` (O(N) linear scan). The pre-session code already used the O(1) Set form — the refactor is purely about the Set CONSTRUCTION (3 lines) being duplicated at 2 sites. **The fix:** extract the Set construction into a single helper, even when the O(1) form is already in use.

### Verification

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/app/api/models/[id]/diff/route.ts src/app/api/models/fallbacks/import/route.ts src/lib/hermes-import.ts tests/unit/config-model-section-consolidation.test.ts tests/unit/fallbacks-import-route-existing-fallback-keys-migration.test.ts --max-warnings 0`: clean
- `CI=true npx jest tests/unit/config-model-section-consolidation.test.ts tests/unit/fallbacks-import-route-existing-fallback-keys-migration.test.ts tests/unit/fallbacks-import-api.test.ts`: **15/15 pass**
- Full `CI=true npx jest` sweep: **311 suites / 2325 tests pass** (up from 309/2312 = +2 suites, +13 tests)
- `CI=true npx --yes pnpm@10.33.0 build`: clean

### Carryover resolution

This session started with a Mode B (verified-but-uncommitted) carryover from the prior session: 3 production files modified + 2 test files created. The pre-commit verification surfaced 0 issues — both refactors are mechanical consolidations. Standard 4-step commit-when-verified protocol applied.

### Reference doc

No new reference doc — this is a 2-refactor session with the same `interface-export-consolidation` + `helper-extraction` shape as the prior List 4 sessions.

### Next session should

- **Random pick next session.** The session 192 + 193 carryovers are now BOTH closed. The other 2 deferred items from session 187 are still open: (a) the `parseEnvLine` + per-line rendering in `src/app/config/[section]/page.tsx:258-283` is still 1 call site — Rule of Three not met, defer; (b) the `isPlatformToolsetsPreview` special-case is still 1 override — premature to add `loadFrom`/`saveTo` to `SectionDef`, defer.
- **Carryover** — none. The next session starts with a clean working tree.

---

## Session 192 — List 4 (Models, HERMES.md, Environment, All Settings) — `isManagedKey` runtime predicate extraction from `MANAGED_KEYS` Set literal + 3-site migration in `src/app/api/agent/files/[key]/route.ts`

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 4 (List 4: Models, HERMES.md, Environment, All Settings).
**Outcome:** **1 byte-equivalent refactor in the List 4 surface + 1 new test file (4 source-pattern assertions).** The pre-session source had a stringly-typed `MANAGED_KEYS` Set literal (`new Set(["soul", "agent", "user", "memory", "config", "hermes"])`) inlined at 3 sites in the `agent/files/[key]/route.ts` PUT handler (the 3 write-file actions: `set_profile`, `append`, `save_as`). Post-session, a single `function isManagedKey(key: string): boolean` helper sits above the PUT handler, returning `MANAGED_KEYS.has(key)`. The 3 call sites are all `if (isManagedKey(reqKey)) { ... }` — a 1-line, 1-token swap. The helper's JSDoc explains the `env` exclusion (intentionally not in the set because it's a security-sensitive excluded case). The 4th test file `tests/unit/session-192-is-managed-key-helper-migration.test.ts` (4 source-pattern assertions) pins: (a) helper declaration exists (1 occurrence), (b) the 3 call sites use the helper (3 occurrences), (c) no inline `MANAGED_KEYS.has(` outside the helper body, (d) `MANAGED_KEYS` Set literal is preserved at the module level (the data is unchanged). 4/4 pass. Committed + pushed as `ce91ad5`.

---

## Older sessions (one-line summary)

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
