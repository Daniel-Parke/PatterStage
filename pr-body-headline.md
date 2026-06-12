# refactor: rolling mission branch

**Full archive:** `pr-body.txt` at HEAD on the `mission/hermes-review-and-refactor` branch. This on-PR body is the headline summary (most recent 5 sessions in full + one-line summary of older sessions).

## Recent sessions (full detail)

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

---
## Session 188 — List 3 (Models, Agents, Skills, Tools, Personalities) — `isApiSuccessFalse` type-guard extraction in `operation-sync-action.ts` + 4 stale `line N` comment updates in `operations/agents/page.tsx`

**Random pick:** `$(( $(date +%s) % 4 + 1 ))` = 3 (List 3: Models, Agents, Skills, Tools, Personalities).

**Date:** 2026-06-12

**Outcome:** **1 byte-equivalent type-guard extraction in the List 3 shared sync helper (`src/lib/operation-sync-action.ts`) + 1 comment-only cleanup in `src/app/operations/agents/page.tsx`.** The 6-clause chained type guard that pattern-matches on the `{ data: { success: false, error?: string } }` envelope produced by `/api/agent/profiles/sync/*` endpoints was inlined inside `runSyncAction`'s try-block. The chain is moved into a new named type-guard `isApiSuccessFalse(response: unknown): response is { data: { success: false; error?: unknown } }` exported from the same file. The call site shrinks from 6 chained clauses (10 lines) to `if (checkSuccess && isApiSuccessFalse(data))` (1 line). The `errMsg` extraction also drops its inner `typeof (data.data as { error?: unknown }).error === "string"` cast — the type-narrowing from the `is` predicate means `data.data.error` is already typed `unknown` (with the runtime `typeof === "string"` check the only thing needed to narrow to `string`). The 4 stale `line N` comment updates in `operations/agents/page.tsx` replace the now-drifted line numbers (e.g. "line 492" → "around line 600", "line ~222" → "around line 282") with the "around line N" form so the references stay useful as anchors without becoming stale on the next edit. 26 new tests across 2 test files: `tests/unit/operation-sync-action-is-api-success-false.test.ts` (21 cases — 5 positive input shapes, 14 negative input shapes, 2 type-narrowing assertions) + `tests/unit/operation-sync-action-is-api-success-false-source-pattern.test.ts` (5 source-pattern assertions pinning the post-refactor shape: helper is exported, call site uses the helper, inlined chain's signature fragment is absent, error access uses the narrowed type, return type uses the `is` type-guard predicate). All 2249 jest tests pass (+26 from session 187's 2223 = +21 runtime + 5 source-pattern) + tsc + eslint + build all green.

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
- **Carryover** — none. The next session starts with a clean working tree.

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

**Random pick:** `$((RANDOM % 4 + 1))` = 1 (List 1: Dashboard, Sessions, Memory, Logs).

**Date:** 2026-06-12

**Outcome:** **1 byte-equivalent catch-shim extraction in the List 1 surface that brings the 2 POST/DELETE catch sites in `/api/memory/hindsight/route.ts` to parity with the `serverErrorFromCatch` sister-helper family.** Also closed the session 185 carryover (the `saveStatusTimerRef` + `copiedTimerRef` timer-cleanup work was uncommitted in the working tree at the start of the session). (a) `hindsightErrorFromCatch(route, context, error)` helper in `src/lib/hindsight-route-helpers.ts` — composed of `logApiError(route, context, error)` + `hindsightErrorResponse(error)`, the sister-helper to `serverErrorFromCatch` (in `src/lib/api-logger.ts`) for the hindsight-specific response shape (500 + `{ data: { available: false, error: msg } }`, NOT the plain `{ error: msg }` shape used by `serverError`). (b) The 2 POST + DELETE catch blocks in `src/app/api/memory/hindsight/route.ts` (lines 401-403, 433-435) collapsed from 2-line `logApiError + return hindsightErrorResponse(error)` to a single `return hindsightErrorFromCatch(ROUTE, CONTEXT, error)` call. The GET catch block intentionally NOT migrated — it has a different response shape (uses `memories: []` and 503 for connection errors). (c) 2 new test files: `tests/unit/hindsight-error-from-catch.test.ts` (11 cases mirroring the `server-error-from-catch.test.ts` sister test, 6 shape + 5 byte-equivalence matrix cases) + `tests/unit/memory-hindsight-route-hindsight-error-from-catch-source-pattern.test.ts` (8 source-pattern assertions pinning the post-migration shape, including the GET-branch intentional carryover). All 2209 jest tests pass (+19 from session 185's 2190 = +11 unit + 8 source-pattern) + tsc + eslint + build all green.

### What shipped

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


## Older sessions (one-line summary)

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
