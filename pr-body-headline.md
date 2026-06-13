# refactor: rolling mission branch

**Full archive:** `pr-body.txt` at HEAD on the `mission/hermes-review-and-refactor` branch. This on-PR body is the headline summary (most recent 5 sessions in full + one-line summary of older sessions).

## Recent sessions (full detail)

## Session 193 — List 4 (Models, HERMES.md, Environment, All Settings) — `ConfigModelSection` interface consolidation (export from `hermes-import.ts` + 1-site migration in `models/[id]/diff/route.ts`) + `existingFallbackKeys()` helper extraction in `models/fallbacks/import/route.ts` (2-site migration) (close session 192 carryover)

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 3 (List 3: Models, Agents, Skills, Tools, Personalities).
**Outcome:** **2 byte-equivalent refactors in the List 4 surface + 2 new test files (6 + 7 = 13 source-pattern assertions).** Both refactors close the prior session's deferred carryover — the carryover was left in a Mode B (verified-but-uncommitted) state at the end of the prior session with `git status` showing 3 modified production files + 2 untracked test files. Per the refactor-sweep-mission skill, the carryover must be closed BEFORE any new work, so this session's "Random pick" is illustrative only — the actual work is the 2 carryover refactors + their 2 test files. All green under tsc + eslint + jest + build. Committed + pushed as `34a8489`.

### What shipped

2 byte-equivalent refactors + 2 new test files (13 source-pattern assertions total).

1. **`ConfigModelSection` interface consolidation across `src/lib/hermes-import.ts` (canonical source) + `src/app/api/models/[id]/diff/route.ts` (consumer)** — the pre-session source had the same 4-field interface `ConfigModelSection { default?, provider?, base_url?, context_length? }` declared in BOTH files. The canonical declaration in `hermes-import.ts` was a local interface (not exported) used internally as the `HermesYamlConfig.model?` field type. The diff route's `readHermesModelSection()` helper had its own identical-shape 7-line `interface ConfigModelSection { ... }` block. Post-session, the canonical declaration is `export interface ConfigModelSection` (with a JSDoc explaining the snake_case stability + 4-field canonical projection), and the diff route has a single `import type { ConfigModelSection } from "@/lib/hermes-import"` line. The local interface block in the diff route is REMOVED (the source-pattern test pins the absence). No runtime change — the `readHermesModelSection()` return type is byte-equivalent (same shape, same name, same field set). The internal usage in `hermes-import.ts` (the `HermesYamlConfig.model?: ConfigModelSection` reference) is unchanged — only the export keyword was added.

2. **`existingFallbackKeys()` helper extraction in `src/app/api/models/fallbacks/import/route.ts`** — the pre-session source had the 3-line pattern `const existingChain = listFallbackChain(); const existingKeys = new Set(existingChain.map((e) => fallbackKey(e.provider, e.modelIdString)));` duplicated in TWO places in the same file: the GET branch (preview) at lines 43-46 and the POST branch (skip-already-imported) at lines 99-102. Post-session, a single `function existingFallbackKeys(): Set<string>` helper sits above the GET handler, returning `new Set(listFallbackChain().map((e) => fallbackKey(e.provider, e.modelIdString)))`. The 2 call sites are both `const existingKeys = existingFallbackKeys();` — a 1-line, 1-token swap. The helper's JSDoc explains the O(1) membership guarantee + the `(provider::modelId)` key shape + the `fallbackKey()` contract reference. No runtime change — both call sites receive the same Set with the same entries; the loop bodies in both branches are byte-equivalent.

3. **`tests/unit/config-model-section-consolidation.test.ts` (NEW, 6 source-pattern assertions)** — pins the post-migration shape across the 2 affected files: (a) `hermes-import.ts` exports the interface (1 export site), (b) `hermes-import.ts` preserves the 4-field shape (default, provider, base_url, context_length), (c) `hermes-import.ts` still uses `ConfigModelSection` as the type of `HermesYamlConfig.model?` (the internal-usage preservation pin), (d) `models/[id]/diff/route.ts` imports the type (1 import site), (e) `models/[id]/diff/route.ts` no longer declares the interface locally (0 `interface ConfigModelSection` blocks), (f) `models/[id]/diff/route.ts` still uses `ConfigModelSection` as the return type of `readHermesModelSection` (the consumer-usage preservation pin). 6/6 pass.

4. **`tests/unit/fallbacks-import-route-existing-fallback-keys-migration.test.ts` (NEW, 7 source-pattern assertions)** — pins the post-migration shape of the route file: (a) helper declaration exists (1 occurrence), (b) JSDoc block on the helper mentions "O(1)" + "provider" + "modelId", (c) GET branch uses the helper (1 call), (d) POST branch uses the helper (1 call), (e) no inline `existingChain = listFallbackChain()` declaration (0 occurrences), (f) no inline `new Set(existingChain.map(` construction (0 occurrences), (g) no inline `fallbackKey(e.provider, e.modelIdString)` outside the helper body (the test splits the source at the helper declaration and asserts the inline form is absent from the rest of the file). 7/7 pass.

### Why this is byte-equivalent

- **`ConfigModelSection` consolidation**: the imported `type` alias is structurally identical to the local interface — same name, same 4 field names, same 4 field types (`string | undefined` for default/provider/base_url, `number | undefined` for context_length), same field order. The diff route's `readHermesModelSection(): ConfigModelSection | null` return type is unchanged (the helper just references the imported alias instead of the local declaration). The `readHermesYamlConfig<Record<string, unknown>>()` call at the top of `readHermesModelSection` is unchanged, the `(config?.model as ConfigModelSection) ?? null` body is unchanged, the call sites of `readHermesModelSection` are unchanged. The 6 source-pattern tests pin all 6 cross-file references (export in source, import in consumer, 4-field shape preservation, internal usage preservation, no local redeclaration, return-type preservation), so a future "rename the type" or "widen the fields" PR would need to update BOTH the source's exported interface and the consumer's import — single source of truth.
- **`existingFallbackKeys()` extraction**: the helper body is literally `new Set(listFallbackChain().map((e) => fallbackKey(e.provider, e.modelIdString)))` — the EXACT same construction as the pre-session inline form. The 2 call sites receive a Set with the EXACT same entries (the helper invokes `listFallbackChain()` and `fallbackKey()` with the same arguments). The downstream loops (the `for (const entry of config?.fallback_providers ?? [])` in GET, the `for (let i = 0; i < chain.length; i++)` in POST) are unchanged — they read `existingKeys` as a `Set<string>` and use `.has()` for membership, which is the same access pattern as the pre-session code. The 7 source-pattern tests pin the helper-at-call-sites shape, the helper-declaration shape, the JSDoc shape, and the absence of the 3 inline forms (the variable declaration, the Set constructor, the `fallbackKey` call), so a future "inline the helper back into the 2 sites" PR would fail at least one of them.

### New pitfall codified

**"An un-exported canonical interface is a 2-place duplication waiting to be added to."** The `ConfigModelSection` interface in `hermes-import.ts` was the canonical source of truth for the `model:` section of `~/.hermes/config.yaml`, but it was `interface ConfigModelSection` (not `export interface ConfigModelSection`). The diff route's `readHermesModelSection` helper needed the same shape for its return type, so it redeclared the interface locally. The 2 declarations were byte-equivalent at session 193 start, but a future PR that adds a 5th field (e.g. `temperature?: number`) to the canonical would need to update BOTH declarations — and the diff route's local redeclaration is the easy one to forget (the `readHermesModelSection` consumer just needs the same shape as the writer, so the local redeclaration is "in sync by convention" not "in sync by type"). **The fix:** export the canonical interface (`export interface ConfigModelSection`) and have all consumers import the type alias. The type system then enforces single-source-of-truth — a future field addition is propagated to consumers automatically. **Detection recipe:** grep the codebase for non-exported `interface \w+ {` declarations in `src/lib/*.ts` files. For each, check if any other file in `src/app/` declares the same interface name with the same field set (use ripgrep `rg -B1 "interface \w+" src/lib/ src/app/` to find candidate redeclarations). If yes, the canonical is a 2-place duplication — export it and migrate the consumer. **The trap:** a "type alias" (`type Foo = { ... }`) is a STRUCTURAL form, not a nominal form, so the type system would let `type Foo = { ... }` in file A and `interface Foo { ... }` in file B coexist without conflict (they're "the same" only by name, not by identity). Exporting the canonical + migrating the consumer is the only durable fix.

**"An O(N) `.find()` per iteration is a 2-place duplication of an O(1) Set construction."** The `existingFallbackKeys` helper replaces the pattern `existingKeys.has(key)` (O(1) Set membership) with the pattern `existingChain.find(e => fallbackKey(e.provider, e.modelIdString) === key)` (O(N) linear scan per membership check). The pre-session code already used the O(1) Set form — the refactor is purely about the Set CONSTRUCTION (3 lines) being duplicated at 2 sites, not about the lookup itself being slow. **The fix:** extract the Set construction into a single helper, even when the O(1) form is already in use — the helper centralises the data flow (read the chain, project to keys, build the Set) so a future "change the key shape from `provider::modelId` to `provider/modelId`" PR is a 1-line helper body change instead of a 2-site change. **Detection recipe:** grep for `new Set\\(\\.+\\.map\\(` patterns in API route files (each is a candidate for a `xxxKeys()` helper). For each, check if the same construction appears at 2+ sites in the same file (use ripgrep `rg -c "new Set\\(\\.+\\.map\\(" src/app/api/**/*.ts` to find candidate files). If yes, extract. **The trap:** the `new Set(arr.map(...))` pattern is sometimes justified as a "1-time conversion" (e.g. for an immutable snapshot) — the extraction is only worth it when the construction is duplicated at 2+ sites AND the source data is fetched multiple times (e.g. once per route handler in the same file).

### Verification

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/app/api/models/[id]/diff/route.ts src/app/api/models/fallbacks/import/route.ts src/lib/hermes-import.ts tests/unit/config-model-section-consolidation.test.ts tests/unit/fallbacks-import-route-existing-fallback-keys-migration.test.ts --max-warnings 0`: clean
- `CI=true npx jest tests/unit/config-model-section-consolidation.test.ts tests/unit/fallbacks-import-route-existing-fallback-keys-migration.test.ts tests/unit/fallbacks-import-api.test.ts`: **15/15 pass** (6 + 7 new + 2 carryover from fallbacks-import-api)
- Full `CI=true npx jest` sweep: **311 suites / 2325 tests pass** (up from 309/2312 = +2 suites, +13 tests, matching the 2 new test files at 6+7 = 13 cases)
- `CI=true npx --yes pnpm@10.33.0 build`: clean

### Carryover resolution

This session started with a Mode B (verified-but-uncommitted) carryover from the prior session: 3 production files modified (`src/app/api/models/[id]/diff/route.ts`, `src/app/api/models/fallbacks/import/route.ts`, `src/lib/hermes-import.ts`) + 2 test files created (`tests/unit/config-model-section-consolidation.test.ts`, `tests/unit/fallbacks-import-route-existing-fallback-keys-migration.test.ts`). The carryover protocol per the refactor-sweep-mission skill is: (1) detect the carryover via `git status` (3 modified + 2 untracked files), (2) run the new test files in isolation FIRST (per pre-flight #6 — also catches Mode J), (3) run the full verification (tsc + eslint + jest + build), (4) commit + push + docs commit atomically. The pre-commit verification surfaced 0 issues — both refactors are mechanical consolidations (interface re-export + helper extraction), the new test files' regex pins are exact, and the carryover was already in a verified-green state when this session started. Standard 4-step commit-when-verified protocol applied: verify → commit → push → docs commit.

### Reference doc

No new reference doc — this is a 2-refactor session with the same `interface-export-consolidation` + `helper-extraction` shape as the prior List 4 sessions (e.g. session 192's `isManagedKey` predicate extraction, session 187's `config-cache` module extraction, session 170's `buildDriftDetails` helper extraction). The new test files' JSDoc + the helper's JSDoc + the exported interface's JSDoc together document the contracts. The 2 pitfall-cofication JSDoc blocks (above) are the "what would trip a future auditor" guides for the 2 refactor families (canonical-interface-export + Set-construction-helper).

### Next session should

- **Random pick next session.** The List 4 surface has now had 8 sessions (70, 72, 95, 98, 121-adjacent, 170, 187, 192, 193). The session 192 + 193 carryovers are now BOTH closed. The other 2 deferred items from session 187 are still open: (a) the `parseEnvLine` + per-line rendering in `src/app/config/[section]/page.tsx:258-283` is still 1 call site — Rule of Three not met, defer; (b) the `isPlatformToolsetsPreview` special-case is still 1 override — premature to add `loadFrom`/`saveTo` to `SectionDef`, defer. The next List 4 pick should look for new refactor opportunities OUTSIDE the 4 factory families (`ok()`, `serverErrorFromCatch`, `setErrorFromCaught`, `parseAndValidateJsonBody`) and outside the now-mined `MANAGED_KEYS` / `config-cache` / `existingById` Map / `ConfigModelSection` / `existingFallbackKeys` surface. Candidates worth re-scanning on a future List 4 pick: the `getBundlePathMap` helper in `agent/files/[key]/route.ts:80-91` (hand-rolls a `Record<string, string>` that maps the same 8 keys to bundle paths that `getBehaviorFiles()` already publishes; could share data with the existing `getBehaviorFiles()` map), the `appendAuditLine` calls across 12+ routes (could benefit from a `routeAuditSuccess(route, resource)` shorthand), the per-route `requireAuth(request)` + early-return pattern (could be a `withAuth` route wrapper — but 12+ sites means a HOC, not a helper, and the codebase has no HOC convention for route handlers; defer). The next List 4 pick is also a good opportunity to scan the per-list source-pattern tests for staleness — the tests were written across sessions 100-150 and the regex pins may need refresh.
- **Carryover** — none. The next session starts with a clean working tree.

---
## Session 192 — List 4 (Models, HERMES.md, Environment, All Settings) — `isManagedKey` runtime predicate extraction from `MANAGED_KEYS` Set literal + 3-site migration in `src/app/api/agent/files/[key]/route.ts`

**Random pick:** `echo $((RANDOM % 4 + 1))` = 4 (List 4: Models, HERMES.md, Environment, All Settings).

**Date:** 2026-06-13

**Outcome:** **1 byte-equivalent runtime-predicate extraction in the List 4 surface + 2 new test files (13 unit + 7 source-pattern assertions).** All green under tsc + eslint + jest + build. Committed as `ce91ad5` (refactor + tests).

### What shipped

**1. `isManagedKey(key: string): key is ManagedFileKey` runtime predicate extracted from `src/app/api/agent/files/[key]/route.ts:33`'s local `MANAGED_KEYS = new Set<string>([...])` literal into a new exported helper in `src/lib/agent-file-store.ts`.** The pre-session route had a 6-string `MANAGED_KEYS` Set that duplicated the `ManagedFileKey` union already declared in `agent-file-store.ts:6-13`. The set was hand-rolled inline (6 literal strings in declaration order) — easy to drift from the union if a future PR adds a 7th member. The new helper is a discriminated OR-check (`key === "soul" || ...`) with a `key is ManagedFileKey` type-guard return type, so the downstream `as ManagedFileKey` casts at `readManagedFileContent` / `writeManagedFileContent` call sites are preserved byte-equivalent. The 3 call sites (GET branch's "managed-file hit" check at line 139, PUT's pre-write "profile not found" guard at line 217, PUT's write-branch dispatch at line 237) are all `MANAGED_KEYS.has(key)` → `isManagedKey(key)` — a 1-token swap, no other changes. The `MANAGED_KEYS` Set is removed from the route file (the negative assertion in the source-pattern test pins the absence). The env-exclusion rationale (the reason the helper is NOT derived from `getBehaviorFiles()`) moves into the helper's JSDoc, preserving the discoverability of the security-sensitive design choice that the original line-33 inline comment was guarding.

### Why this is byte-equivalent

- **Helper body**: `isManagedKey(key)` returns `true` for exactly the 6 strings in the `ManagedFileKey` union (`"soul"`, `"agent"`, `"user"`, `"memory"`, `"config"`, `"hermes"`) and `false` for everything else. The 3 migrated call sites see the exact same boolean outcome as the pre-session `MANAGED_KEYS.has(key)` — the Set had those same 6 strings, no more, no less. The 13 unit tests (6 positive + 6 negative + 1 type-guard sanity) exercise every reachable input shape, including the security-sensitive `env` + `auth` exclusions, the case-sensitivity invariant, the prefix-match no-surprise invariant (`"agentx"` is not `"agent"`), and the exhaustive-union coverage check.
- **Type-guard return type**: `key is ManagedFileKey` is structurally identical to the pre-session `Set<string>.has(key)` return — both are runtime boolean checks. The narrow is the SAME narrow that the pre-session `as ManagedFileKey` cast at the `readManagedFileContent(profileSlug, key as ManagedFileKey)` call site was already performing. The cast stays; the type-guard makes the narrow visible at the `if` branch (good — future readers can see exactly which keys the `if` admits), but the downstream call sites are byte-equivalent.
- **No call-site logic change**: the 3 `if` branches that consumed `MANAGED_KEYS.has(key)` consumed the same boolean; the bodies of the branches (`readManagedFileContent(...)` for the managed hit, `notFound("Profile not found")` for the pre-write guard, `configYamlToColumnValues(...)` + `applyProfileOrRootPatchOrFail(...)` for the write branch) are byte-equivalent — only the `if` predicate changed. The `MANAGED_KEYS` Set's import-block-only presence is removed; no other imports changed.
- **JSDoc moved, not lost**: the pre-session `route.ts:33` had a 0-line inline comment explaining the env exclusion (the design rationale lived only in the PR #120 commit message that introduced the Set). The post-session JSDoc on `isManagedKey` reproduces the same rationale in a discoverable form — a future maintainer reading the helper can see why the helper is NOT derived from `getBehaviorFiles()` and which keys are excluded. The content moved, the security guarantee preserved.

### New pitfall codified

**"The `MANAGED_KEYS` Set literal is a 2-place duplication: the type AND the runtime check both encode the same 6-string list."** The `ManagedFileKey` union in `agent-file-store.ts:6-13` is the canonical TYPE (compile-time), and the `MANAGED_KEYS` Set in the route was a parallel RUNTIME representation (hand-rolled 6-string array → `Set`). A future PR that adds a 7th member (e.g. a new behaviour file like `skills: SkillFileKey` for an in-database skills section) would need to update BOTH — the union AND the Set — and the Set is the easy one to forget (it's an `as Set<string>` annotation, not a type-checked constraint). **The fix:** extract the runtime check into a single exported helper co-located with the type, so the union and the runtime predicate are siblings in the same module, and a future "add a 7th key" PR naturally updates both. **Detection recipe:** grep the codebase for `new Set<string>\(\[\s*["']` patterns — each is a candidate for a typed-runtime-predicate extraction. If the Set's elements are also a TypeScript union declared elsewhere, the duplication is 2-place. The "byte-equivalent" claim is the easy part — a Set.has() and a `key === "x" || key === "y" || ...` chain both produce the same boolean for the same inputs; the harder part is preserving the type-guard return type so the downstream call sites don't need new casts. **The trap:** the union IS the source of truth, so a "smart" runtime check like `Array.from(managedKeys as Set<ManagedFileKey>)` would create a circular import or require a third file. The discriminated OR-check is the right form — it's a literal transcription of the union, and the type-guard return type `key is ManagedFileKey` is the static guarantee that the transcribed check is correct.

### Verification

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint . --max-warnings 0`: clean (0 warnings)
- `CI=true npx jest tests/unit/agent-file-store-is-managed-key.test.ts`: **13/13 pass** (new)
- `CI=true npx jest tests/unit/agent-files-route-is-managed-key-migration.test.ts`: **7/7 pass** (new)
- Full `CI=true npx jest` sweep: **309 suites / 2312 tests pass** (up from 307/2292 = +2 suites, +20 tests, matching the 2 new test files at 13+7 = 20 cases)
- `npm run build`: clean

### Carryover resolution

None (clean session; refactor + tests + verification + commit all completed in-session; the previous session's working tree was clean at the start).

### Reference doc

No new reference doc — this is a 1-refactor session with the same extraction shape as the prior List 4 sessions (e.g. session 187's `config-cache` module extraction, session 167's `seedPostSchema` + `parseAndValidateJsonBody` migration, session 121's `parseAndValidateJsonBody` migration across 15 routes). The new helper's JSDoc + the 2 new test files' JSDoc together document the contract. The pitfall-cofication JSDoc (above) is the "what would trip a future auditor" guide.

### Next session should

- **Random pick next session.** The List 4 surface has now had 7 sessions (70, 72, 95, 98, 121-adjacent, 187, 192). The session 192 deferred work (from session 187's closeout) is now DONE: the `MANAGED_KEYS` Set → `isManagedKey` predicate extraction is shipped, and the env-exclusion rationale is in the helper's JSDoc. The other 2 deferred items from session 187 are still open: (a) the `parseEnvLine` + per-line rendering in `src/app/config/[section]/page.tsx:258-283` is still 1 call site — Rule of Three not met, defer; (b) the `isPlatformToolsetsPreview` special-case is still 1 override — premature to add `loadFrom`/`saveTo` to `SectionDef`, defer. The next List 4 pick should look for new refactor opportunities OUTSIDE the 4 factory families (`ok()`, `serverErrorFromCatch`, `setErrorFromCaught`, `parseAndValidateJsonBody`) and outside the now-mined `MANAGED_KEYS` / `config-cache` / `existingById` Map surface. Candidates worth re-scanning on a future List 4 pick: the `getBundlePathMap` helper in `agent/files/[key]/route.ts:80-91` (hand-rolls a `Record<string, string>` that maps the same 8 keys to bundle paths that `getBehaviorFiles()` already publishes; could share data with the existing `getBehaviorFiles()` map), the `appendAuditLine` calls across 12+ routes (could benefit from a `routeAuditSuccess(route, resource)` shorthand), the per-route `requireAuth(request)` + early-return pattern (could be a `withAuth` route wrapper — but 12+ sites means a HOC, not a helper, and the codebase has no HOC convention for route handlers; defer).
- **Carryover** — none. The next session starts with a clean working tree.

---

## Session 191 — List 3 (Models, Agents, Skills, Tools, Personalities) — `toggleActiveCollapsed` / `toggleInactiveCollapsed` 1-setter toggle-callback extraction in `src/app/operations/skills/page.tsx`

**Random pick:** `echo $((RANDOM % 4 + 1))` = 3 (List 3: Models, Agents, Skills, Tools, Personalities).

**Date:** 2026-06-13

**Outcome:** **1 byte-equivalent refactor in the List 3 surface + 1 new test file (7 source-pattern assertions).** All green under tsc + eslint + jest + build. Committed + pushed as `217c142` (refactor) + `85711c5` (docs).

### What shipped

**1. `toggleActiveCollapsed` / `toggleInactiveCollapsed` 1-setter toggle-callback extraction in `src/app/operations/skills/page.tsx` (List 3 surface).** The 2 inline 1-setter toggle arrows `() => setXCollapsed((v) => !v)` passed as the `onToggleCollapse` prop on the sibling `<SkillSection>` (line 413 for Active, line 458 for Inactive) are byte-equivalent and consolidate into 2 `useCallback` siblings with `[]` deps (useState setters are stable, per session 119 P-3 codebase convention). Extending the A3 single-setter close-callback pattern that session 100/103 established for `closeDelete` / `closeEditor` / `closeSkillEditor` / `closeEdit`, the toggle sub-shape is a first-class sibling of the close sub-shape — both share the `useCallback(() => setX(...), [])` 1-setter contract, only the semantic differs (reset to default vs. flip boolean). `toggleCategory` is intentionally NOT migrated — it takes an argument (the category key) and is a different shape. 1 new test file `tests/unit/session-191-skills-toggle-section-collapsed.test.ts` (7 source-pattern assertions) pins the post-refactor shape + the `toggleCategory` exclusion test pins the audit's scope. The full JSDoc explaining the call-site lockstep is in the helper block.

### Why this is byte-equivalent

- The 2 inline arrows were the only call sites for `setActiveCollapsed` / `setInactiveCollapsed` (other than the initial `useState` declaration itself). The new `useCallback` siblings are the only call sites, with the exact same body (`setXCollapsed((v) => !v)`) and the exact same deps (`[]`).
- The 2 `<SkillSection>` props receive the exact same callback identity at every render (the `useCallback` returns a stable reference because the deps are `[]`, identical to the inline arrow which was re-created on every render — but the new stable identity is *strictly better*, not a behavior change: the prop value is now the same reference across renders, but `<SkillSection>` is not memoized so the new stable reference is a no-op for any consumer).
- The only observable change is the **absence** of the inline form — never the **presence** of new behavior.

### New pitfall codified

**"The 1-setter callback family has 2 sub-shapes (close + toggle) — both deserve the same extraction discipline."** The umbrella skill's "1-setter close callback" pattern (session 100/103) covers the **close** sub-shape: a callback that resets a `useState` to a default value (`null`, `undefined`, `false`, `""`, `[]`). The canonical examples: `closeDelete = useCallback(() => setDeleteTarget(null), [])` (reset to null), `closeEditor = useCallback(() => setEditor(null), [])`, `closeSkillEditor = useCallback(() => setEditingSkill(null), [])`, `closeEdit = useCallback(() => setEditTarget(undefined), [])`. The session 191 extraction extends the pattern to the **toggle** sub-shape: a callback that flips a boolean via the functional setter form `setX((v) => !v)`. The canonical examples: `toggleActiveCollapsed = useCallback(() => setActiveCollapsed((v) => !v), [])` (flip), `toggleInactiveCollapsed = useCallback(() => setInactiveCollapsed((v) => !v), [])`. **The trap:** the umbrella skill's "1-setter close callback" pattern is named after the close sub-shape, but the pattern itself is more general. A future auditor searching for "1-setter callbacks" should scan for BOTH sub-shapes — a `useCallback(() => setX((v) => !v), [])` is a sibling of a `useCallback(() => setX(null), [])`, not a different pattern. **Detection recipe:** grep the file for `useState<\w+>` declarations paired with their setters; for each setter, count the inline form at JSX call sites; if 2+ sites have the byte-equivalent `() => setX((v) => !v)` shape → **toggle sub-shape**, extract to `toggleX`; if 2+ sites have the byte-equivalent `() => setX(null|undefined|false|""|[])` shape → **close sub-shape**, extract to `closeX`; the 1-arg sub-shape (`setX(prev => ({...prev, [arg]: !prev[arg]}))`) is NOT part of this family.

### Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint src/app/operations/skills/page.tsx tests/unit/session-191-skills-toggle-section-collapsed.test.ts --max-warnings 0`: clean
- `CI=true npx jest tests/unit/session-191-skills-toggle-section-collapsed.test.ts`: **7/7 pass**
- Full `CI=true npx jest` sweep: **307 suites / 2292 tests pass** (up from 306/2285 = +1 suite, +7 tests, matching the 1 new test file at 7 tests)
- `npm run build`: clean

### Carryover resolution

None (clean session; refactor + tests + verification + commit + push + docs all completed in-session).

### Next session should

- **Random pick next session.** The List 3 surface is now mined clean at the 1-setter callback family scope — `closeDelete` / `closeEditor` (s100/s183), `closeSkillEditor` (s100), `closeEdit` (s100), `closeCreate` (s100), `toggleActiveCollapsed` / `toggleInactiveCollapsed` (s191). The 1-setter callback family now has 2 sub-shapes (close + toggle) — the next audit of any "mined clean" surface should scan for both.
- **Carryover** — none. The next session starts with a clean working tree.

---

# refactor: rolling mission branch

**Full archive:** `pr-body.txt` at HEAD on the `mission/hermes-review-and-refactor` branch. This on-PR body is the headline summary (most recent 5 sessions in full + one-line summary of older sessions).

## Recent sessions (full detail)

## Session 190 — cross-list (List 2 + List 1 + List 3) — `getCategoryIdFromTemplate` helper + redundant `isCustom` cast removal + `onEditTemplate` signature narrowing in `useMissionsPage` + `cron/page.tsx` `hardwareEnabled`/`hardwareTotal` single-pass reduce + `handleToggleSkill` callback consolidation in `skills/page.tsx`

**Random pick:** `$(( $(date +%s) % 4 + 1 ))` = 2 (List 2: Cron, Missions, Chat) — but the carryover from the prior session's uncommitted work had already picked and executed 3 small refactors across Lists 1, 2, and 3 surfaces, and the protocol per the refactor-sweep-mission skill is: "If a previous session's `git status` is non-empty AND verification is green, close the carryover FIRST before doing new work." This session is the carryover closure.

**Date:** 2026-06-12

**Outcome:** **5 byte-equivalent refactors across 4 production files + 1 new helper export + 4 new test files.** All 5 refactors are mechanical consolidations that centralise repeated patterns:

1. **`getCategoryIdFromTemplate(t, fallback?)` helper extracted in `useMissionsPage.ts`** (List 2 surface) — the 3 sites that read the legacy `categoryId` field from a `MissionTemplate` (`applyTemplateToForm`'s `setNewCategoryId` call, the `fetchData` template-apply path's `const cid = …`, and the `templateCategoryPills` `useMemo`'s `for (const t of templates)` body) all duplicated the structural cast `(t as MissionTemplate & { categoryId?: string }).categoryId ?? <fallback>`. The helper centralises the cast + read + fallback discipline; the `?? fallback` is a defaulted param so each call site passes only the fallback it actually needs (`getCategoryIdFromTemplate(t)` for `null`, `getCategoryIdFromTemplate(t, "general")` for the pills). All 3 call sites are byte-equivalent — the helper body is literally `(t as MissionTemplate & { categoryId?: string }).categoryId ?? fallback`.

2. **Redundant `(t as MissionTemplate & { isCustom?: boolean })` cast removed in `useMissionsPage.handleSaveAsTemplate` (line 956)** — the cast was unnecessary because `isCustom?: boolean` is already declared on the `MissionTemplate` interface in `TemplateModals.tsx:67` (the legacy-backend-shape cast is only needed for `categoryId`, which is NOT on the interface). The pre-refactor code was `(t as MissionTemplate & { isCustom?: boolean }).isCustom !== false`; the post-refactor code is `t.isCustom !== false`. The `!== false` check is preserved byte-equivalent.

3. **`onEditTemplate` callback signature narrowed in `useMissionsPage.handleEditTemplate` + `TemplateManagerModalProps.onEditTemplate`** — the pre-refactor type was `MissionTemplate & { isCustom?: boolean; instruction?: string; context?: string; dispatchMode?: string; schedule?: string }` (a 5-field intersection). All 5 fields are already declared on the `MissionTemplate` interface itself (the `isCustom?` field at line 67, the rest at lines 64-72), so the intersection was redundant noise. The post-refactor type is `(t: MissionTemplate) => void` — same wire contract, same callback invocations, no behaviour change.

4. **`hardwareEnabled` + `hardwareTotal` single-pass reduce in `cron/page.tsx` (List 2)** — the pre-refactor code did two independent reads of `hardware.jobs`: `const hardwareEnabled = hardware.jobs.filter((j) => j.enabled).length;` and `const hardwareTotal = hardware.jobs.length;`. Both values are derived from the same array, so a single `.reduce()` pass with a named accumulator `{ enabled, total }` produces both. Same shape as session-188's reductions in `agents/page.tsx` (driftCount + syncErrorCount) and `models/import/route.ts` (modelsImported + modelsSkipped). The `|| 0` display fallback for the empty-array case is preserved (the page header renders "System: 0/0" instead of "System: 0/-" when no jobs exist). The reducer is wrapped in `useMemo` with `[hardware.jobs]` dep so the count is stable across renders that don't change the job list.

5. **`handleToggleSkill` `useCallback` extracted in `skills/page.tsx` (List 3)** — the 2 `onToggleSkill` inline arrow callbacks (the Active section's `onToggleSkill={(skill) => toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling))}` and the Inactive section's `onToggleSkill={(skill) => toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling, !skill.enabled))}`) are consolidated through a single `handleToggleSkill = useCallback((skill: Skill, fallback: boolean = skill.enabled) => toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling, fallback)), [toggleSkill, toggling])`. The helper defaults the fallback to `skill.enabled` so the Active call site is `onToggleSkill={handleToggleSkill}` (no inline arrow — the helper is the callback) and the Inactive call site is `onToggleSkill={(skill) => handleToggleSkill(skill, !skill.enabled)}` (a thin arrow that just supplies the fallback). The Inactive fallback is preserved byte-equivalent (the Inactive grid is the negation of the active state, so the "current enabled" that `toggleSkill` reads must be the inversion). The `toggling` dep is the state variable that `effectiveSkillEnabled` reads.

### What shipped

5 byte-equivalent refactors + 1 new helper export + 4 new test files.

1. **`src/hooks/useMissionsPage.ts` (MODIFIED, +30 / -3)** — new `getCategoryIdFromTemplate` helper exported (line 51-62), 3 call sites migrated (lines 588, 629, 1254), 1 redundant `isCustom` cast removed (line 959), 1 `handleEditTemplate` signature narrowed (line 1048). The helper is exported for unit testing; not part of the public hook contract.

2. **`src/components/missions/TemplateModals.tsx` (MODIFIED, +1 / -8)** — `onEditTemplate` prop type narrowed from the 5-field-intersection form to `(t: MissionTemplate) => void`. The 8-line intersection type declaration is gone, replaced by a 1-line type.

3. **`src/app/orchestration/cron/page.tsx` (MODIFIED, +19 / -2)** — `hardwareEnabled` and `hardwareTotal` are now destructured from a single `useMemo`'d `.reduce()` pass over `hardware.jobs`. Net +17 lines because the JSDoc + the reducer body is longer than the 2 inline reads it replaces; the comment block documents the byte-equivalence rationale + the same-shape session-188 reference.

4. **`src/app/operations/skills/page.tsx` (MODIFIED, +31 / -2)** — new `handleToggleSkill` `useCallback` declared (line 227-251), Active section's `onToggleSkill` prop migrated to `onToggleSkill={handleToggleSkill}` (line 415), Inactive section's `onToggleSkill` prop migrated to `onToggleSkill={(skill) => handleToggleSkill(skill, !skill.enabled)}` (line 460). The 2-line inline arrows are replaced by a 1-line helper reference + a 1-line thin arrow. The JSDoc on the helper documents the Active-vs-Inactive fallback semantics.

5. **`tests/unit/get-category-id-from-template.test.ts` (NEW, 6 cases)** — pins the helper's contract: returns `categoryId` when present, returns the fallback when `categoryId` is undefined, returns null when both are null, returns the fallback when `categoryId` is the empty string (the `??` operator only falls back on `null`/`undefined`, not on falsy), etc. The test exercises the actual function (not a source-pattern grep), so a future maintainer who accidentally changes the `??` to `||` will get a test failure (the `||` form would fall back on `""` too).

6. **`tests/unit/session-190-categoryid-helper-migration.test.ts` (NEW, 8 cases)** — source-pattern test that pins the post-migration shape: the 3 `getCategoryIdFromTemplate(t, …)` call sites exist in `useMissionsPage.ts`, the 3 pre-migration inline `(t as MissionTemplate & { categoryId?: string }).categoryId` casts are GONE, the `handleEditTemplate` signature has been narrowed (the 5-field intersection is gone), and the redundant `isCustom` cast in `handleSaveAsTemplate` is gone. Block + line comments are stripped from the source before scanning, so the post-refactor JSDoc notes don't false-positive on the negative-assertion regexes.

7. **`tests/unit/session-190-cron-hardware-counts-reduction.test.ts` (NEW, 5 cases)** — source-pattern test that pins the single-pass shape: `hardwareEnabled` is destructured from the `.reduce()` result (not a `.filter().length` read), `hardwareTotal` is destructured from the same reduce (not an independent `.length` read), the `.reduce()` accumulator is the named `{ enabled, total }` object, and the `useMemo` dep array is `[hardware.jobs]`.

8. **`tests/unit/session-190-skills-handle-toggle-skill.test.ts` (NEW, 7 cases)** — source-pattern test that pins the post-migration callback shape: `handleToggleSkill` is declared as a `useCallback` in the component, the helper signature has the defaulted `fallback: boolean = skill.enabled` param, the Active `onToggleSkill` prop is a bare `handleToggleSkill` reference (no inline arrow), the Inactive `onToggleSkill` prop is a thin arrow that supplies `!skill.enabled` as the fallback, the pre-refactor Active inline `toggleSkill(...)` form is GONE, the pre-refactor Inactive inline `toggleSkill(...)` form is GONE, and `toggleSkill` is still called from `handleToggleSkill`'s body.

### Why this is byte-equivalent

- **`getCategoryIdFromTemplate` migration at all 3 call sites**: the helper body is literally `(t as MissionTemplate & { categoryId?: string }).categoryId ?? fallback` — same cast, same read, same `?? <fallback>` fallback. The 3 call sites are structurally identical to the pre-refactor code; the only difference is the cast+read lives in a function call instead of inline. The `?? null` default in the helper signature means the `getCategoryIdFromTemplate(t)` call site (the `applyTemplateToForm` `setNewCategoryId` call) is byte-equivalent to the pre-refactor `(t as MissionTemplate & { categoryId?: string }).categoryId ?? null`. The `getCategoryIdFromTemplate(t, "general")` call site (the `templateCategoryPills` `useMemo`) is byte-equivalent to `(t as MissionTemplate & { categoryId?: string }).categoryId ?? "general"`. The `getCategoryIdFromTemplate(t)` call site in the `fetchData` template-apply path's `const cid = getCategoryIdFromTemplate(t);` is byte-equivalent to `const cid = (t as MissionTemplate & { categoryId?: string }).categoryId ?? null;` (the helper's default fallback is `null`). All 3 sites preserve the same `??` semantics.
- **Redundant `isCustom` cast removal**: `t.isCustom` reads the same field as the pre-refactor `(t as MissionTemplate & { isCustom?: boolean }).isCustom` — the cast was a no-op because `isCustom?: boolean` is already on the `MissionTemplate` interface. The `!== false` check is preserved (`t.isCustom` is `boolean | undefined`; `undefined !== false` is `true`, so an undefined `isCustom` still matches — same as the pre-refactor `(t as MissionTemplate & { isCustom?: boolean }).isCustom !== false`).
- **`onEditTemplate` signature narrowing**: the pre-refactor intersection `MissionTemplate & { isCustom?: boolean; instruction?: string; context?: string; dispatchMode?: string; schedule?: string }` is a SUPERSET of `MissionTemplate` (the intersection is satisfied by any `MissionTemplate` because all 5 fields are optional and declared on the base interface). The narrowed `(t: MissionTemplate) => void` accepts the same set of values. No call site is affected — `handleEditTemplate` is called from `TemplateManagerModal` and `TemplateModals` with `MissionTemplate` values, and the narrowed prop type accepts those same values.
- **`hardwareEnabled`/`hardwareTotal` reduce migration**: the pre-refactor code was `const hardwareEnabled = hardware.jobs.filter((j) => j.enabled).length;` and `const hardwareTotal = hardware.jobs.length;` — both reads are independent. The post-refactor code is a single `.reduce((acc, j) => { if (j.enabled) acc.enabled += 1; acc.total += 1; return acc; }, { enabled: 0, total: 0 })` — for each job, `acc.total` increments by 1 (matching `.length`) and `acc.enabled` increments by 1 IF `j.enabled` is true (matching `.filter().length`). The final `enabled` count is identical (both count jobs where `j.enabled === true`); the final `total` count is identical (both count all jobs). The `useMemo` wrapper is a perf optimisation, not a behaviour change — the reducer result is stable across renders that don't change `hardware.jobs`.
- **`handleToggleSkill` callback consolidation**: the pre-refactor Active inline arrow was `(skill) => toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling))` and the post-refactor helper is `(skill, fallback = skill.enabled) => toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling, fallback))` — the `fallback = skill.enabled` default param value means the Active call site (which passes no 2nd arg) gets the same `fallback` value as the pre-refactor inline `effectiveSkillEnabled(skill, toggling)` call (the `effectiveSkillEnabled` helper's default param value is also `skill.enabled`, so omitting the 3rd arg yields the same value as passing `skill.enabled`). The Inactive inline arrow `(skill) => handleToggleSkill(skill, !skill.enabled)` explicitly passes `!skill.enabled` as the fallback, which is the same as the pre-refactor `effectiveSkillEnabled(skill, toggling, !skill.enabled)` call. The `useCallback` dep array `[toggleSkill, toggling]` matches the closure captures of the pre-refactor inline arrows (which captured `toggleSkill` and `toggling` from the outer scope).

### Verification

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint . --max-warnings 0`: clean (0 warnings)
- `npx jest`: **306 suites / 2285 tests pass** (up from 302/2259 = +4 suites, +26 tests, matching the 4 new test files at 6+8+5+7=26 cases)
- `CI=true npx --yes pnpm@10.33.0 build`: clean

### Carryover resolution

This session started with a Mode B (verified-but-uncommitted) carryover: 4 production files modified (`useMissionsPage.ts`, `TemplateModals.tsx`, `cron/page.tsx`, `skills/page.tsx`) + 4 test files created (`get-category-id-from-template.test.ts`, `session-190-categoryid-helper-migration.test.ts`, `session-190-cron-hardware-counts-reduction.test.ts`, `session-190-skills-handle-toggle-skill.test.ts`). The carryover protocol per the refactor-sweep-mission skill is: (1) detect the carryover via `git status` (4 modified + 4 untracked files), (2) run the new test files in isolation FIRST (per pre-flight #6 — also catches Mode J), (3) run the full verification (tsc + eslint + jest + build), (4) commit + push + docs commit atomically. The pre-commit verification surfaced 0 issues — the migration is mechanical, the new test files' regex pins are exact, and the helper extraction follows the same pattern as session 181's `dispatchMissionAction` helper. Standard 4-step commit-when-verified protocol applied: verify → commit → push → docs commit.

### Reference doc

No new reference doc — this session is a 5-site consolidation that follows 3 already-documented patterns (helper extraction per session 181, redundant-cast removal per session 184, callback consolidation per session 175). The next session's reference (if this session needs follow-up closure) would just be a 1-line pointer to the patterns above.

### Next session should

- **Random pick next session.** The 5 refactors shipped in this session are NOT confined to a single list surface — they touch List 2 (`useMissionsPage.ts`, `cron/page.tsx`), List 1 (`TemplateModals.tsx` is consumed by the Dashboard + Missions routes), and List 3 (`skills/page.tsx`). The "true" List 2 surface (the `cron/page.tsx` + `missions/page.tsx` + `chat/page.tsx` pages + their APIs) is now even further mined-clean. The next random pick should land on whichever list the new pick yields; if it lands on List 2 again, look at the `missions/page.tsx` and `chat/page.tsx` for byte-equivalent candidates.
- **Carryover** — none. The next session starts with a clean working tree.

---


## Session 189 — cross-list (List 2 + List 1 Dashboard) — `dispatchMissionAction` migration in `useMissionsPage.handleDelete` + `useMissionsPage.handleCancel` (2 sites) + `page.tsx.handleCancelMission` (1 site) + inline `restoreMission` closure inlining (close session 181 carryover)

**Random pick:** `$(( $(date +%s) % 4 + 1 ))` = 1 (List 1: Dashboard, Sessions, Memory, Logs).

**Date:** 2026-06-12

**Outcome:** **3 byte-equivalent `dispatchMissionAction` call-site migrations + 1 closure inlining across the List 2 + List 1 surface (carryover closure from session 181).** The session 181 work shipped `dispatchMissionAction(action, body)` in `src/hooks/success-message-for-dispatch.ts` and migrated 4 sites in `useMissionsPage.handleCreate`, but ran out of tool-call budget before the 3 remaining inline `safeApiCall("/api/missions", { method: "POST", body: { action: "cancel"|"delete", missionId } })` sites (`useMissionsPage.handleDelete` line 1056, `useMissionsPage.handleCancel` line 1101, `page.tsx.handleCancelMission` line 212) were migrated. This session closed the carryover. (a) The 2 List-2 sites in `useMissionsPage.ts` collapsed from 8-line inline `safeApiCall + method + body` blocks to 2-line `dispatchMissionAction(action, { missionId })` calls. (b) The 1 List-1 site in `src/app/page.tsx` migrated AND fixed a real type-annotation bug — the pre-migration type was `safeApiCall<{ missions: MissionBrief[] }>` (the LIST endpoint envelope), but the cancel action returns `{ mission, cancel: { accepted, processKillPending } }` — the destructure only read `ok`/`error` so the type mismatch was invisible at runtime, but it was a maintenance trap for any future caller that read `result.data`. The helper now owns the wire call and the envelope type, so the call site can no longer pin the wrong envelope. (c) The 1-line `restoreMission(restored)` closure (added in session 181, itself a helper for the 2 restore-on-failure paths) inlined at the 2 restore sites — the closure was a `() => restored` capture of the same `id` and `setMissions` that the inline form already has, so the closure was just a 3-line declaration for a 1-line passthrough. (d) 2 test files: `tests/unit/use-missions-page-update-mission-shape.test.ts` (existing, +1 assertion re-pinned: 2 callsites → 3 callsites — the 2 restore paths now use `updateMission(id, () => previousMission)` directly, so the count grew by 1) + `tests/unit/dispatch-mission-action-call-sites.test.ts` (NEW, 10 source-pattern assertions pinning the post-migration shape: helper imports in both files, no inline `safeApiCall("/api/missions", { method: "POST", body: { action: "cancel"|"delete" } })` calls remain in either file, exact-count pins for `dispatchMissionAction("cancel", ...)` and `dispatchMissionAction("delete", ...)` at 1 site each in `useMissionsPage.ts` + 1 site each in `page.tsx`, the wrong-type `safeApiCall<{ missions: MissionBrief[] }>` annotation is gone from `page.tsx`, helper's `cancel` action is in the action-union). All 2259 jest tests pass (+10 from session 188's 2249) + tsc + eslint + build all green.

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



## Older sessions (one-line summary)

**Session 188** — List 3 — `isApiSuccessFalse` type-guard extraction in `operation-sync-action.ts` + 4 stale `line N` comment updates in `operations/agents/page.tsx`
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
