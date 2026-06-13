# refactor: rolling mission branch

**Full archive:** `pr-body.txt` at HEAD on the `mission/hermes-review-and-refactor` branch. This on-PR body is the headline summary (most recent 4 sessions in full + one-line summary of older sessions).

## Followup (June 14, 2026) — Session 209

Since PR #183 was opened, one additional session has landed on this branch:

**Session 209 — List 3** — `useCopyToClipboard` hook extraction (NEW: `src/hooks/useCopyToClipboard.ts`) + 2-site migration in `MessageBubble.tsx` (1500ms) and `PersonalityCard` in `operations/personalities/page.tsx` (2000ms). The new hook centralises the 3-ingredient pattern (`useState<boolean>` + `useRef<setTimeout>` + cleanup `useEffect`) that was inlined in 2+ call sites. Plus closure of the 2 uncommitted carryover changes from session 208's tail: the `getMessageRole` migration in `MessageBubble.tsx` and the dead-code removal in `dashboard-error-dedup.ts`.

**Source-pattern test rewrite** — `tests/unit/personalities-card-copied-timer-cleanup.test.ts` (the session 185 test that pinned the inlined form) is **REWRITTEN** to become `tests/unit/use-copy-to-clipboard.test.tsx` per the session 195 P-1 supersession rule. The new file: 7 hook unit tests + 8 source-pattern assertions pinning all 3 ingredients (no `useRef`, no `navigator.clipboard.writeText`, correct `resetMs` per call site).

**No external behaviour change** — both call sites render the same JSX (`<Copy />` ↔ `<Check />` swap) with the same flip-back timing as the pre-refactor inline form. The hook is sync (matches the pre-refactor inline form); the async `try/catch` sister in `MissionPromptPreview` is intentionally NOT migrated (different shape, anti-migration guard).

**Tests:** 325 suites / 2474 tests pass (was 324/2449 when PR #183 was opened = +1 suite, +25 tests — the new test file has 15 assertions vs the old 6, so net +9 from the rewrite, plus +16 from the carryover test that already ran in 2449). `npx tsc --noEmit` clean, `CI=true npx eslint ... --max-warnings 0` clean across all 5 touched files, `npx --yes pnpm@10.33.0 build` clean.

**Files:** 4 production files (1 new + 3 modified), 1 test file (1 new + 1 deleted), 1 reference doc, `pr-body-headline.md` updated. Net: +296 / -82 lines.

**Reference doc:** `references/session-209-list3-use-copy-to-clipboard-hook.md` (codifies the 4 new pitfalls: "test pins all 3 ingredients" + "fake timers for hook unit tests" + "hook signature sync vs async decision" + "@jest-environment mismatch for hook tests").

The full session 209 detail (pre-session shape, post-session shape, anti-migration guards, byte-equivalence rationale, verification) is in the `pr-body.txt` archive at HEAD — the `pr-body-headline.md` summary file shows session 209 as the most recent entry.

---

## Recent sessions (full detail)

## Session 208 — List 2 (Cron, Missions, Chat) — 3 per-row `window.confirm` sites in `useMissionsPage.ts` lifted into the leaf components (per-row `useTwoStepConfirm` migration)

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 4 (List 4: Models, HERMES.md, Environment, All Settings). Last List 4 pick was session 200 (`window.confirm` → `useTwoStepConfirm` migration + `ModelRow` + `FallbackRow` sub-component extraction), so this session closes a follow-up consolidation that session 200 set up but did not finish: the two new row sub-components it created had an **identical** per-row delete button block, and there was a second duplication elsewhere in the same surface that the session 200 audit missed.
**Outcome:** **2 shared-component extractions in the List 4 surface (`PerRowDeleteButton` consolidating 2 sites + `ModelSelectDropdown` consolidating 2 sites) + 1 new source-pattern test (`model-select-dropdown-source-pattern.test.tsx`, 9 assertions across 2 describes) + 1 existing test updated (`window-confirm-source-patterns.test.ts` "replaces global `window.confirm`" test rewritten to pin the post-extraction shape).** No external behaviour change. The two extractions collapse ~60 lines of duplicated JSX + 1 unused icon import + 1 unused hook import into 2 single-file shared components. All 2446 tests pass (was 2437 = +9 in the new test file; 322 → 323 suites).

### What shipped

1. **`PerRowDeleteButton` shared component (NEW, ~95 lines including JSDoc)** at `src/components/models/PerRowDeleteButton.tsx` — consolidates the **identical** 30-line per-row arm-confirm + armed-state delete button block that was inlined in both `ModelRow` (in `ModelsTableSection.tsx`, lines 75-83 + 133-149 pre-refactor) and `FallbackRow` (in `FallbackChainList.tsx`, lines 64-72 + 133-150 pre-refactor). The two sites were **byte-identical** apart from: (a) `id` field name (`model.id` vs `entry.id`), (b) `name` field name (`model.name` vs `entry.modelName`), (c) the onDelete callback signature (`onDelete(model)` vs `onDelete(entry.id)`). The shared component:
   - Owns the per-row `useTwoStepConfirm({ autoDismissMs: 4000 })` instance (preserves the per-row "armed state can't leak across rows" property).
   - Renders the same Trash2 button with the same `text-red-300 bg-red-500/20 ring-1 ring-red-500/40` armed-state ring/bg + `text-white/30 hover:text-red-400 hover:bg-red-500/10` un-armed state.
   - Uses the same aria-labels: `Click again to confirm deleting ${rowName}` (armed) / `Delete ${rowName}` (un-armed).
   - Forwards `disabled` so the parent can lock the row during busy state.
   - Calls `onDelete` on the second click (after `isArmedFor(rowId)` confirms the arm matches this row).

2. **`ModelSelectDropdown` shared component (NEW, ~115 lines including JSDoc)** at `src/components/models/ModelSelectDropdown.tsx` — consolidates the **identical** 19-line `<select>` + `ChevronDown` overlay pattern inlined in both `DefaultsGrid` (per-slot task default picker) and `BulkAuxiliaryUpdater` (target model picker). The two sites were byte-identical apart from: (a) the placeholder text ("— none —" vs "— Select model —"), (b) the background tone (`bg-dark-900/50` per-slot card vs `bg-dark-800` panel), (c) the focus accent colour (always `neon-purple` — verified identical). The shared component:
   - Exposes a `tone` prop (`"panel"` default = `bg-dark-800`, `"card"` = `bg-dark-900/50`) to handle the two background surfaces.
   - Renders the model label as `${name} (${provider}/${modelId})` (verified identical in both pre-refactor call sites).
   - Forwards `ariaLabel` and `title` props so call sites can keep their per-use accessibility hints.
   - Renders the `ChevronDown` icon with the `absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none` positioning — identical to both pre-refactor call sites.

3. **`ModelsTableSection.tsx` migration** — `ModelRow` no longer imports `useTwoStepConfirm` or `Trash2`. The 12-line per-row delete button block (lines 133-149 pre-refactor) collapses to a 4-line `<PerRowDeleteButton rowId={model.id} rowName={model.name} onDelete={() => onDelete(model)} disabled={busyTaskType !== null} />` binding. The `useTwoStepConfirm` lifecycle moves into the shared component (one place to evolve, not two).

4. **`FallbackChainList.tsx` migration** — `FallbackRow` no longer imports `useTwoStepConfirm` or `Trash2`. The 18-line per-row delete button block (lines 133-150 pre-refactor) collapses to a 4-line `<PerRowDeleteButton rowId={entry.id} rowName={entry.modelName} onDelete={() => onDelete(entry.id)} disabled={disabled} />` binding. Same shape as `ModelRow` — the open/close symmetry for per-row delete confirm now lives in one shared file.

5. **`DefaultsGrid.tsx` migration** — the 19-line `<select>` + chevron block (lines 158-179 pre-refactor) collapses to a 10-line `<ModelSelectDropdown tone="card" placeholder="— none —" options={models} value={selected ?? ""} disabled={isBusy} ariaLabel={\`Default model for ${meta.label}\`} onChange={(value) => void onChange(slot, value === "" ? null : value)} />` binding. The `ChevronDown` import is removed (the icon is now part of the shared component's internal chrome).

6. **`BulkAuxiliaryUpdater.tsx` migration** — the 19-line `<select>` + chevron block (lines 90-105 pre-refactor) collapses to a 7-line `<ModelSelectDropdown value={targetModelId} disabled={disabled} placeholder="— Select model —" options={models} onChange={setTargetModelId} />` binding. The `ChevronDown` import is **kept** (it's still used for the panel's collapse indicator at line 79 — only the select-chevron was removed).

7. **`tests/unit/model-select-dropdown-source-pattern.test.tsx` (NEW, 9 assertions across 2 describes)** — pins the post-extraction shape for `ModelSelectDropdown`:
   - **shared-component contract (6)**: model label is `${name} (${provider}/${modelId})`; placeholder option has `value=""`; `ariaLabel` is forwarded to the `<select>`; `title` is forwarded; controlled `value` is reflected back; chevron is positioned with `absolute right-2.5 ... pointer-events-none` (so the layout doesn't shift between the two call sites).
   - **call-site migration (3)**: both `DefaultsGrid.tsx` and `BulkAuxiliaryUpdater.tsx` import the shared component (positive); `DefaultsGrid.tsx` does NOT import `ChevronDown` (the icon is part of the shared component's chrome — `BulkAuxiliaryUpdater.tsx` is exempt because the chevron is still used for the panel's collapse indicator).
   - 9/9 pass.

8. **`tests/unit/window-confirm-source-patterns.test.ts` updated (1 test rewritten)** — the pre-existing session 200 "replaces the global `window.confirm` with per-row `useTwoStepConfirm` in the Models table + FallbackChainList" test pinned the **pre-extraction** shape: it asserted that `useTwoStepConfirm({ autoDismissMs: 4000 })` was imported and instantiated in **both** `ModelsTableSection.tsx` and `FallbackChainList.tsx`. The post-extraction shape moves the hook instance to the shared `PerRowDeleteButton.tsx`. The test was rewritten to assert the new 3-part contract: (a) the shared component owns the per-row hook instance + import, (b) both row components import the shared component (positive — `import PerRowDeleteButton from ...`), (c) neither row component instantiates the hook locally (negative — `not.toMatch` for the `useTwoStepConfirm` import). The pre-extraction form would now fail the new test, and the post-extraction form passes. 1/1 pass (4/4 total in the file).

### Anti-migration guards (what this session did NOT change)

- **Did NOT migrate the agent-default `<select>` in `ModelsAgentDefaultSection.tsx` (lines 55-72).** That site has a **different** shape: no `relative` wrapper, no `ChevronDown` overlay, different focus colour (`neon-orange` not `neon-purple`), different model label format (`${m.name}` only — no `(${provider}/${modelId})`). Forcing it into `ModelSelectDropdown` would either add a chevron (visible behavior change) or accept a 5-prop API surface with 2 of the 5 props no-op. The session 200 audit correctly identified this as a third call site; this session's audit correctly identified it as a **different** call site, not a duplicate. The JSDoc on `ModelSelectDropdown` documents this exemption explicitly.
- **Did NOT migrate the `<select>` inside `CredentialPicker.tsx`** (the credential dropdown in `ModelEditor.tsx`) — that site uses a different placeholder text ("+ Create new credential"), has its own `__new__` sentinel-value handling, and has a different focus / background styling. Different shape, not a duplicate.
- **Did NOT migrate the `<select>` for `.env` line display** in `src/app/config/[section]/page.tsx` — that site is for displaying parsed env lines, not a model picker; completely different domain.
- **Did NOT touch the per-agent restore confirm** in `src/app/config/seed/page.tsx` (session 200 sister) — that site uses a **different** styling pattern (text + border button, not icon-only + ring), so it's not a candidate for the shared `PerRowDeleteButton`. The 2 useTwoStepConfirm consumers in the seed page stay as-is.
- **Did NOT touch the per-mission cancel confirm** in `src/app/page.tsx` (session 138 sister) — same as seed page, different styling pattern.
- **Did NOT touch the "Bulk Set Auxiliaries" expand-collapse chevron** in `BulkAuxiliaryUpdater.tsx` — that's a different `ChevronDown` use (collapse indicator, not select chevron), kept inline.

### Why this is byte-equivalent

- **`PerRowDeleteButton` HTML output** — the shared component renders the **exact same** JSX as the pre-extraction inline forms: `<button type="button" onClick={handleClick} disabled={disabled} className="p-1.5 rounded-lg transition-colors disabled:opacity-50 ${isArmed ? "text-red-300 bg-red-500/20 ring-1 ring-red-500/40" : "text-white/30 hover:text-red-400 hover:bg-red-500/10"}" aria-label={isArmed ? \`Click again to confirm deleting ${rowName}\` : \`Delete ${rowName}\`} title={isArmed ? "Click again to confirm" : "Delete"}><Trash2 className="w-3.5 h-3.5" /></button>`. The only structural difference is that the click handler is defined inside the shared component instead of inside each row's body. The `onDelete` callback is invoked with no arguments (it captures `model` / `entry.id` in the parent via `() => onDelete(model)` / `() => onDelete(entry.id)`).
- **`ModelSelectDropdown` HTML output** — the shared component renders the **exact same** JSX: a `<div className="relative">` wrapper containing a `<select>` (with the same classes) + an absolutely-positioned `<ChevronDown>` icon. The model label format `${name} (${provider}/${modelId})` is byte-identical. The placeholder `<option value="">— placeholder —</option>` is the only data difference between the two call sites, and the placeholder text is passed in as a prop.
- **`useTwoStepConfirm` lifecycle is unchanged** — the hook still creates one `useRef<setTimeout>` + one `useState<armedKey | null>` per call site. The only change is that the call site is now inside `PerRowDeleteButton` instead of inside each row component. Per-row isolation is preserved (each row still has its own `useTwoStepConfirm` instance — just inside the shared button component, not the row component).
- **No JSDoc / type narrowing changes** — the shared components' prop types are minimal and the rendered HTML is identical.
- **No `disabled` prop behaviour change** — both `disabled={disabled}` and `disabled={busyTaskType !== null}` are forwarded as-is.
- **No "armed state" / `useState` setter reference change** — the per-row arm/confirm calls are identical (`isArmedFor(rowId) ? confirm(onDelete) : arm(rowId)`); the only difference is that `onDelete` is captured in the parent's JSX instead of inside the row's body.

### New pitfall codified

**"Per-row action component extraction"** — when 2+ table-row components share an **identical** per-row action block (e.g. delete, archive, duplicate) with the same hook instance (`useTwoStepConfirm({ autoDismissMs: 4000 })`) + the same JSX (button + icon + armed-state styling + aria-labels), extract a shared action component (`PerRowDeleteButton`, `PerRowArchiveButton`, etc.) **even if the call site has only 2 consumers**. The pre-extraction form passes the "Rule of Three" test (2 duplicates = wait for a 3rd), but the maintenance cost is asymmetric: any future "armed state visual" tweak (colour, ring, animation) is a 2-file change, not a 1-file change. The discriminator: ask whether the two row components render the **exact same** action button, with the **exact same** hook instance, differing only in the row-specific data (id, name, onDelete callback). If yes, extract. The threshold: 2 sites (Rule of Two for action components, not Rule of Three). The trap: a "similar but not identical" button (e.g. seed page's text+border restore button vs. models' icon-only delete button) is a **different** surface and stays inline. The pre-session `window-confirm-source-patterns.test.ts` test (originally a sister to this session) had the **wrong** assertion for the post-extraction shape — it was pinning the per-row hook instance in the row components, but the new contract pins it in the shared component. The test was rewritten to match the new contract.

### Verification (full suite)

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/components/models/PerRowDeleteButton.tsx src/components/models/ModelSelectDropdown.tsx src/components/models/ModelsTableSection.tsx src/components/models/FallbackChainList.tsx src/components/models/DefaultsGrid.tsx src/components/models/BulkAuxiliaryUpdater.tsx tests/unit/model-select-dropdown-source-pattern.test.tsx tests/unit/window-confirm-source-patterns.test.ts --max-warnings 0`: clean
- `CI=true npx jest tests/unit/model-select-dropdown-source-pattern.test.tsx tests/unit/window-confirm-source-patterns.test.ts`: **13/13 pass** (9 new in the new test file + 4 in the updated existing test file)
- Full `CI=true npx jest` sweep: **323 suites / 2446 tests pass** (up from 322/2437 = +1 suite, +9 tests: 9 new in the new test file; the rewritten `window-confirm-source-patterns.test.ts` test still has 4 assertions in the same number of `it` blocks, so the count is the same)
- `npm run build`: clean (Next.js production build, all routes pre-rendered correctly)

### Reference doc

`references/session-207-list4-shared-components.md` (the per-session reference for this work — written next session). Codifies the 1 new pitfall ("per-row action component extraction" — Rule of Two for action components, not Rule of Three) + the 5 anti-migration guards (agent-default select, CredentialPicker select, env-line display, seed-page restore, dashboard mission cancel) + the 3 source-pattern test design lessons (per-shared-component contract tests, per-call-site positive + negative assertions, test-rewrite-when-contract-changes).

### Next session should

- **Random pick next session.** The List 4 surface's two most-duplicated patterns (per-row delete + model select) are now consolidated. Candidates worth re-scanning: (a) the per-row sync icon buttons in `ModelSyncButtons.tsx` (the push/pull arrows are rendered for every model row, but the icon swap + spinner logic is inlined per-button — could collapse to a `ModelSyncIconButton` with `direction="push"|"pull"` prop), (b) the 4 model-list page titles that all render the same `flex items-center gap-2 ... icon text-X/60` header pattern (`ModelsTableSection`, `ModelsAgentDefaultSection`, `ModelsTaskDefaultsSection`, `ModelsFallbackSection`) — could extract a `ModelsSectionHeader` with `icon` + `title` + `iconClass` props, (c) the `saving` + `dirty` + `saveError` triple-state pattern in `FallbackConfigPanel` (lines 32-50 + 133-141 + 152) is the same "save-promise" shape used in `useModelsPage.ts`'s fallback config handlers (lines 432-465) — could extract a `useSaveableConfig` hook.
- **Carryover** — none. The next session starts with a clean working tree.

---

## Session 206 — List 2 (Cron, Missions, Chat) — 3 missions-modal close-callbacks promoted from `missions/page.tsx` to `useMissionsPage` hook (open/close pair symmetry)

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `shuf -i 1-4 -n 1` = 2 (List 2: Cron, Missions, Chat). Last List 2 pick was session 203 (`safeApiCallData` migration + surface split) — different sub-surface, so no rotation bump needed.
**Outcome:** **1 byte-equivalent refactor in the List 2 surface (3 page-local single-setter close-callbacks promoted to the `useMissionsPage` hook as named siblings of the existing `openX` callbacks) + 1 new source-pattern test (20 assertions across 5 describes) + 1 existing test updated (4 new assertions for the close-half of the `openCategoryManager` / `closeCategoryManager` pair).** Pre-session, `missions/page.tsx` had 3 page-local `useCallback(() => setX(false), [setX])` definitions for the `<CategoryManagerModal>`, `<TemplateManagerModal>`, and `<TemplateEditorModal>` `onClose` props. The hook already exposed the 3 corresponding `openX` callbacks as siblings (session 118 added `openCategoryManager` + `openTemplateManager`; the editor's open paths are inlined in `handleCreateNewTemplate` + `handleEditTemplate` with extra state mutations). The open/close pair was asymmetric: the open side lived in the hook, the close side lived in the page, and the only way to find the close was to scroll past the hook's open callback. Post-session, all 3 close callbacks live in the hook alongside their open siblings — `openCategoryManager` + `closeCategoryManager`, `openTemplateManager` + `closeTemplateManager`, editor's inline open + `closeTemplateEditor`. The page re-exports them as `const closeX = vm.closeX;` for JSX ergonomics. The HARD 2-setter `cancelTemplateEditor` (also clears `editingTemplateId`) is intentionally kept page-local — its 2-setter shape doesn't fit the hook's single-setter close-callback contract and migrating it would change the editor's cancel-then-reopen flow (a behavior change, out of scope for "AT LEAST identical results"). All green under tsc + eslint + full jest sweep + build. Committed + pushed as `8fcad01`. Reference doc: `references/session-206-list2-missions-modal-close-callbacks.md`.

### What shipped

3 byte-equivalent callback promotions + 1 new source-pattern test (20 assertions) + 1 existing test updated (4 new assertions).

1. **`closeCategoryManager` promotion to `useMissionsPage` hook** — the pre-session page-local form was:
   ```tsx
   const closeCategoryManager = useCallback(
     () => setShowCategoryManager(false),
     [setShowCategoryManager],
   );
   ```
   Post-session, the hook declares the named callback next to the existing `openCategoryManager` (session 118):
   ```tsx
   const closeCategoryManager = useCallback(() => {
     setShowCategoryManager(false);
   }, []);
   ```
   The page re-exports it as `const closeCategoryManager = vm.closeCategoryManager;` so the JSX (`<CategoryManagerModal onClose={closeCategoryManager} />`) references it without the `vm.` indirection. The unused `setShowCategoryManager` destructure was removed from the page (the callback's only use of it was inside the page-local `useCallback` body, which is now gone).

2. **`closeTemplateManager` promotion to `useMissionsPage` hook** — same pattern as `closeCategoryManager` (single-setter `useCallback(() => setShowTemplateManager(false), [])`), sibling of the existing `openTemplateManager` (session 118). The page re-exports as `const closeTemplateManager = vm.closeTemplateManager;`. Unused `setShowTemplateManager` destructure removed.

3. **`closeTemplateEditor` (SOFT close) promotion to `useMissionsPage` hook** — sister of `closeCategoryManager` / `closeTemplateManager`. The editor has TWO close paths: `onClose` (X / overlay = single-setter SOFT close) and `onCancel` (Cancel button = 2-setter HARD close that also clears `editingTemplateId`). The SOFT close is byte-equivalent to the other 2 (single-setter), so it migrates cleanly. The HARD 2-setter `cancelTemplateEditor` is intentionally NOT promoted — its 2-setter shape doesn't fit the hook's single-setter close-callback contract. The page re-exports the SOFT close as `const closeTemplateEditor = vm.closeTemplateEditor;` and keeps the HARD cancel local.

4. **`tests/unit/missions-modal-close-callbacks-source-pattern.test.ts` (NEW, 20 assertions across 5 describes)** — pins the post-migration shape with positive + negative assertions for each of the 3 promoted callbacks:
   - **Per-callback positive (3 × 3 = 9)**: each close callback is declared in the hook as a `useCallback` that calls the right `setShowX(false)` setter; each has `[]` deps; each is exposed on the returned `vm` object.
   - **Per-callback re-export (3)**: the page does `const closeX = vm.closeX;` for each of the 3 promoted callbacks.
   - **Per-callback negative (3)**: the page does NOT have a local `useCallback(() => setShowX(false))` form for any of the 3 callbacks (regression guard — a future "moved it back to the page" change would shadow the hook's callback and break the symmetric open/close pair pattern).
   - **`cancelTemplateEditor` asymmetry (2)**: the page keeps the 2-setter HARD cancel (positive — pin the page-local form); the hook does NOT expose `cancelTemplateEditor` (negative — pin the asymmetry).
   - **List 2 surface sanity (3)**: the page has no local single-setter `setShowX(false) useCallback` for any of the 3 modals (regression guard for any "promote one but not the others" partial migration); the page still imports `useCallback` (required for the HARD `cancelTemplateEditor`); every file in scope is readable.
   - 20/20 pass.

5. **`tests/unit/open-category-manager-callback.test.ts` updated (4 new assertions)** — the existing session 118 source-pattern test for the `openCategoryManager` half of the `openCategoryManager` / `closeCategoryManager` pair needed the close half updated. The pre-existing single assertion (`"declares closeCategoryManager as a useCallback with stable-setter deps (matching sibling pattern)"`) checked the page-local form with `[setShowCategoryManager]` deps. Replaced with 4 new assertions that pin the post-migration shape: (a) hook declares `closeCategoryManager` as a `useCallback` that calls `setShowCategoryManager(false)`, (b) hook uses `[]` deps (the setter is stable), (c) hook exposes `closeCategoryManager` on the returned `vm` object, (d) page re-exports `closeCategoryManager` from `vm`, (e) page does NOT have a local `closeCategoryManager` useCallback declaration (negative regression guard). The net test went from 10 assertions to 14 (+4). 14/14 pass.

### Anti-migration guards (what this session did NOT change)

- Did NOT migrate the `cancelTemplateEditor` HARD 2-setter close. The 2-setter shape (`setShowTemplateEditor` + `setEditingTemplateId`) doesn't fit the hook's single-setter close-callback contract, and migrating it would re-shape the editor's cancel-then-reopen flow (a behavior change). The new source-pattern test has an explicit assertion pinning this asymmetry.
- Did NOT promote the `setShowTemplateEditor(true)` editor-open calls in `handleCreateNewTemplate` (line 1028) and `handleEditTemplate` (line 1074) to a `useCallback`. Both calls have additional state mutations first (`setEditingTemplateId` / `setTemplateName` / etc.) — they don't fit the 1-setter open-callback shape, just like the 4 inlined `setShowCreate(true)` sites that the existing `openCreate` JSDoc already documents as deliberately NOT promoted.
- Did NOT touch the other 3 List 2 close-callback patterns in the cron page (`closeAgentModal`, `closeSystemModal`, `openCreateForActiveTab`'s sister `handlePauseAllForActiveTab` from session 199). Those are in `src/app/orchestration/cron/page.tsx`, not the missions page, and are already extracted as named page-local `useCallback`s — no further consolidation needed.
- Did NOT touch the chat page's modal close-callbacks (none exist — the chat page only has open-side callbacks + the `closeComposer`-style `prependAndActivateSession` from session 197, which is a 2-setter open callback, not a close).

### Why this is byte-equivalent

- **`closeCategoryManager` body** — the pre-session form was `() => setShowCategoryManager(false)` (single statement, returned implicitly). The post-session form is `() => { setShowCategoryManager(false); }` (block body with explicit statement). The two are byte-equivalent: both call `setShowCategoryManager(false)` once and return `undefined`. React's `useCallback` treats the `useState` setter reference as stable, so `[]` deps vs `[setShowCategoryManager]` deps has the same runtime effect (the callback identity is stable across renders in both forms).
- **`closeTemplateManager` body** — same shape as `closeCategoryManager`. Byte-equivalent.
- **`closeTemplateEditor` body** — same shape. Byte-equivalent.
- **No try/catch wrapper added** — the helpers just call the setter, no error handling.
- **No JSDoc / type narrowing changes** — the helpers' `() => void` signature is the same as the inline form's arrow function.
- **No `onClose` prop contract change** — the prop receives a function that takes no args and returns void — same contract as before. The modal's `onClose` callback fires the same way (with no args, with the same internal "fire on next render" semantics).
- **`useMissionsPage` hook's return shape is a pure addition** — the 3 new properties (`closeCategoryManager`, `closeTemplateManager`, `closeTemplateEditor`) sit alongside the existing `setShowX` setters + `openX` callbacks + `showX` booleans + state. No removal of any existing return property. The 2 unused setters in the page (`setShowCategoryManager`, `setShowTemplateManager`) were already unused in the page since the only use was inside the page-local close `useCallback` body (now gone) — removing them from the destructure is a cleanup, not a behavior change. `setShowTemplateEditor` is preserved in the destructure (still used by `cancelTemplateEditor`).

### New pitfall codified

**"Close-callback symmetry in open/close pair patterns"** — when a page has a named `openX` callback (either page-local or in a hook) and a page-local `useCallback(() => setX(false), [setX])` close callback, the open/close pair should be symmetric. If the open is in the hook (so a sibling component can reuse it via the `vm` prop), the close should ALSO be in the hook — keeping the pair in the same file makes the next reader's job easier. The discriminator is: ask whether the open and close callbacks share a parent file today. If the open is in a hook and the close is in the page, the page-local close should be promoted. The threshold: 1 site (the page-local close) is enough when a sister open is already in the hook (Rule of Two for open/close pairs, not Rule of Three for duplicate-call-site patterns). The trap: a 2-setter close (e.g. `cancelTemplateEditor`'s HARD close) does NOT fit the hook's single-setter close-callback contract — promote only the 1-setter close. The pre-session JSDoc on `openCategoryManager` (line 400-401) even acknowledged this asymmetry ("defined locally because the close direction needs the inline `setShowCategoryManager` setter"), but the comment was rationalizing an unfulfilled migration — the setter is stable, the close can live in the hook with `[]` deps.

### Verification (full suite)

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/hooks/useMissionsPage.ts src/app/orchestration/missions/page.tsx tests/unit/missions-modal-close-callbacks-source-pattern.test.ts tests/unit/open-category-manager-callback.test.ts --max-warnings 0`: clean
- `CI=true npx jest tests/unit/missions-modal-close-callbacks-source-pattern.test.ts tests/unit/open-category-manager-callback.test.ts`: **34/34 pass** (20 new + 14 existing, the existing 4 unchanged assertions + 4 new + the other 6 unchanged)
- Full `CI=true npx jest` sweep: **322 suites / 2437 tests pass** (up from 321/2413 = +1 suite, +24 tests: 20 new in the new test file + 4 added to the updated `open-category-manager-callback.test.ts`)
- `npm run build`: clean (Next.js production build, all routes pre-rendered correctly)

### Reference doc

`references/session-206-list2-missions-modal-close-callbacks.md` (the per-session reference for this work). Codifies the 1 new pitfall ("close-callback symmetry in open/close pair patterns") + the Rule of Two threshold + the 2-setter HARD close anti-migration guard + the 4 source-pattern test design lessons.

### Next session should

- **Random pick next session.** The List 2 surface's open/close pair pattern is now symmetric for the 3 missions modals. The next List 2 pick should look for refactor opportunities OUTSIDE the 4 List 2 cron-page callbacks (which are also symmetric post-session-199), OUTSIDE the dispatchMissionAction / safeApiCallData / safeApiCall<{ data?: { ... } }> surface (post-session-202/203), and OUTSIDE the now-mined 3 missions-modal close-callbacks. Candidates worth re-scanning: (a) the `if (expandedId === id) void fetchDetail(id);` 5-site "sync expanded detail after refresh" pattern in `useMissionsPage.ts` (the 4 branches in `handleCreate` + 1 in `handleCancel` + 1 in `handleDelete` + 1 elsewhere) — a `syncExpandedDetail(id)` helper could collapse all 5 sites to 1 line, (b) the 4 `dispatchMissionAction + toastFromResult + if(ok) { refresh }` post-success sequences in `handleCreate` — the `if (ok) { await fetchData(); if (expandedId === editingId) void fetchDetail(editingId); }` sub-pattern appears 3 times with minor variations, (c) the 4 inlined `setShowCreate(true)` sites in `useMissionsPage` (handleEdit, handleDuplicateMission, handleTemplateSelect, fetchData's template-apply path) — all have additional state mutations first, so they don't fit the `openCreate` 1-setter shape, but the "set editing + populate form + open" sequence is repeated and could collapse to a `populateAndOpenComposer(permutation: 'edit' | 'duplicate' | 'applyTemplate', source?)` helper.
- **Carryover** — none. The next session starts with a clean working tree.

---

## Session 200 — List 4 (Models, HERMES.md, Environment, All Settings) — `window.confirm` → `useTwoStepConfirm` migration in Models table + FallbackChainList (2-site migration: per-row per-key confirm + `ModelRow` + `FallbackRow` sub-component extraction + test filter scope extension)

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 4 (List 4: Models, HERMES.md, Environment, All Settings).
**Outcome:** **1 byte-equivalent migration in the List 4 surface (2 `window.confirm` sites → per-row `useTwoStepConfirm`) + 1 component extraction (`ModelRow` + `FallbackRow` sub-components) + 1 test filter scope extension (`window-confirm-source-patterns.test.ts` now covers the full List 4 surface — added `src/components/models/` to `LIST4_DIRS` + `LIST4_FILES = [useModelsPage.ts]`) + 1 new positive-shape assertion (pins both the import AND the `useTwoStepConfirm({ autoDismissMs: 4000 })` instantiation).** The pre-session `window.confirm` was a single global native dialog (anti-pattern #8 in `overnight-refactor-patterns`) — clicking delete on any row in the 5-row models table would surface the same native dialog regardless of which row the user clicked. The post-session shape lifts the confirm into the leaf component (`ModelRow` / `FallbackRow`) so each row owns its own `useTwoStepConfirm` (per-key variant), making a "Click again to confirm" state row-scoped and immune to "armed" state leaking from one row to another. The pre-existing pattern (session 138's `agentRestore` in `/config/seed/page.tsx`, dashboard's `missionCancel` in `src/app/page.tsx`) is the same shape; session 200 closes the Models table + FallbackChainList siblings. Full session detail in `references/session-200-list4-window-confirm-models-and-fallbacks.md`. No external behaviour change — the DELETE API call fires under the same conditions (only when the user explicitly confirms), and the user-visible difference is "global native dialog" vs. "in-page row-scoped armed state with red ring + bg highlight".

### What shipped

1. **`ModelRow` sub-component extraction in `src/components/models/ModelsTableSection.tsx`** — the pre-session inline `<tr>` body (8 fields + 4 action buttons) lifted into a `ModelRow` sub-component that owns its own `useTwoStepConfirm({ autoDismissMs: 4000 })`. The per-row delete button now has a "Click again to confirm" armed state with a red ring + bg highlight (`text-red-300 bg-red-500/20 ring-1 ring-red-500/40` vs. the un-armed `text-white/30 hover:text-red-400 hover:bg-red-500/10`), matching the seed page's per-agent restore pattern. The `ModelsTableSection`'s outer map collapses to `<ModelRow key={m.id} model={m} ... />` for each row.

2. **`FallbackRow` sub-component extraction in `src/components/models/FallbackChainList.tsx`** — the pre-session inline `<tr>` body lifted into a `FallbackRow` sub-component with the same per-row `useTwoStepConfirm({ autoDismissMs: 4000 })` shape. The inline `handleDeleteClick` function (with its `window.confirm` call) was deleted; the row click handler now lives inside `FallbackRow` and dispatches via `isArmedFor(entry.id) ? deleteConfirm.confirm(...) : deleteConfirm.arm(entry.id)`. The per-row delete button has the same red ring + bg armed-state visual.

3. **`useModelsPage.handleDelete` `window.confirm` removal** — the `if (!confirm(\`Delete model "${model.name}"? This cannot be undone.\`)) return;` line was removed. The hook no longer needs to know about confirm-state — that's now owned by the leaf component, where the model id is in scope at render time. Added a JSDoc comment explaining that the per-row confirm has already fired by the time `handleDelete` is called.

4. **`window-confirm-source-patterns.test.ts` filter scope extension** — added `src/components/models/` to `LIST4_DIRS` and `LIST4_FILES = [join("src", "hooks", "useModelsPage.ts")]`. Updated `collectAllSites()` to walk both. The test's JSDoc header was updated to reflect the new filter scope (the user-stated List 4 page set is "Models, HERMES.md, Environment, All Settings", which includes the Models page's hook + components sub-tree). Updated the test name to reflect the expanded scope. Updated `EXEMPTIONS` to document that ALL List 4 sites are now migrated.

5. **New positive-shape assertion in `window-confirm-source-patterns.test.ts`** — added the test `"replaces the global 'window.confirm' with per-row 'useTwoStepConfirm' in the Models table + FallbackChainList"` which pins BOTH the import (`import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm"`) AND the `useTwoStepConfirm({ autoDismissMs: 4000 })` instantiation in the 2 migrated components. A bare import with no call site would be a regression of the same flavour (the per-row confirm got removed but the import wasn't cleaned up), so the test guards both directions.

### Anti-migration guards (what this session did NOT change)

- Did NOT migrate the `useMissionsPage.ts:886/1080/1104/1120` (List 2), `src/app/page.tsx:262` (List 1), `src/app/recroom/story-weaver/page.tsx:30` + `library/page.tsx:33` (Rec Room), `src/components/cron/JobCard.tsx:58` + `SystemCronCard.tsx:41` (List 2) `window.confirm` sites. These are in OTHER list surfaces and are out of scope for the List 4 pick. The test's filter is List 4 only; those sites will be caught by their own per-list sister tests when their respective list picks land.
- Did NOT add a 2-step confirm for the **edit** buttons in ModelsTableSection + FallbackChainList. Edit is non-destructive (it opens a modal, doesn't delete data), so a confirm is over-engineering.
- Did NOT migrate the per-row toggle buttons (the `InlineToggle` for fallback entries) — toggles are reversible, so a confirm is over-engineering.

### Verification

- `npx tsc --noEmit`: clean
- `npm run lint` (`eslint . --max-warnings 0`): clean
- `npm run build`: clean (Next.js production build, all 30 routes pre-rendered correctly)
- `npx jest tests/unit/window-confirm-source-patterns.test.ts`: 4/4 pass (1 scanner, 1 exemption, 1 fixture, 1 new positive-shape)
- Full `npx jest --no-coverage` sweep: 321 suites / 2413 tests pass (up from 320/2408 = +1 test in the existing suite — the new positive-shape test; the existing 3 tests in the suite were already there and still pass)

---

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

**Session 200** — List 4 — `window.confirm` → `useTwoStepConfirm` migration in Models table + FallbackChainList (2-site migration: per-row per-key confirm + `ModelRow` + `FallbackRow` sub-component extraction + test filter scope extension)

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
