# refactor: rolling mission branch

**Full archive:** `pr-body.txt` at HEAD on the `mission/hermes-review-and-refactor` branch. This on-PR body is the headline summary (most recent 4 sessions in full + one-line summary of older sessions).

## Followup (June 14, 2026) — Session 215

Since the previous session 214 followup, one additional session has landed on this branch (via a Mode F.5 carryover closure — the prior cron tick had executed the refactor + written the 2 source-pattern tests, but never verified the suite + never committed):

**Session 215 — List 4 (Models, HERMES.md, Environment, All Settings)** — `EnvLineRow` component extraction (NEW: `src/components/config/EnvLineRow.tsx`) + `FallbackConfigPanel` `updateField` + `buildConfigPatch` consolidation. Two byte-equivalent extractions in the `/config` + `/config/models` surfaces, both List 4, both with new source-pattern tests:

1. **`EnvLineRow` component extraction** — the 30-line inline `.map((line, i) => ...)` body in `src/app/config/[section]/page.tsx` (with 3 `if (parsed.kind === "X")` branches: `blank` / `invalid` / `keyval` fallthrough) collapses to a single `<EnvLineRow lineKey parsed raw />` binding per row. The new `src/components/config/EnvLineRow.tsx` (88 lines) has an exhaustive 4-case `switch (parsed.kind)` over the `EnvLine` discriminated union. `maskKeyHint` ownership moves from the page to the component (the page drops the `import { maskKeyHint } from "@/lib/secret-mask"` import). The `parsed` prop is the already-parsed `EnvLine` (computed once per file content change in the page's `useMemo` over `fileContent`); the row is a pure presentational render.
2. **`FallbackConfigPanel` `updateField` + `buildConfigPatch` consolidation** — 3 inline handlers (`handleRetriesChange` / `handleRestorationChange` / `handleNotificationChange`) each did a `{ ...config, <field>: <value> }` spread followed by `onUpdate(...)`. They collapse to 1-line arrows that call the new `updateField(patch: Partial<FallbackConfig>)` helper. The new module-level `buildConfigPatch(config: FallbackConfig, patch: Partial<FallbackConfig>): FallbackConfig` is a pure spread `{ ...config, ...patch }`. The `Partial<FallbackConfig>` type discriminator catches unknown fields at compile time. The `parseInt + isNaN + range` guard in `handleRetriesChange` is preserved byte-equivalent (the guard is the variant-specific bit — retries is a number with a range check, the other 2 are booleans with no prelude).

**Source-pattern tests** (2 new files, 19 assertions):
- `tests/unit/env-line-row-extraction.test.ts` (11 assertions, 2 describes) — pins the new component file (existence, imports, default export with `({ lineKey, parsed, raw })` signature, exhaustive 4-case switch, `blank` variant's `&nbsp;` placeholder, `keyval` variant's `maskKeyHint(parsed.value)` masking) + the page migration (imports the new component, no longer imports `maskKeyHint`, still imports `parseEnvLine + envLineKey`, renders the .env preview via a single `<EnvLineRow>` binding, no `parsed.kind` references outside the component).
- `tests/unit/fallback-config-panel-update-field-extraction.test.ts` (8 assertions) — pins the `buildConfigPatch` module-level helper signature, the `{ ...config, ...patch }` body, the `updateField` page-local arrow, the 3 handler-body rewrites, the `parseInt + isNaN + range` guard preservation, and the `onUpdate(` call count invariant (exactly 1, after block-comment-stripping).

**3 test-assertion fixes (the F.5 carryover was written but had 3 known failures)** — the prior session's tests were UNVERIFIED. The carryover-closure protocol re-ran them and found 3 failing assertions; all 3 were 1-line regex fixes:
1. **EnvLineRow `keyval` case slice** — the `[\s\S]*?\}[\s\S]*?\}` non-greedy slice stopped at the first `}` (the closing `</span>` of `<span>{parsed.key}</span>`), missing the trailing `maskKeyHint(parsed.value)` line. Fixed by anchoring the slice to the END of the file (`source.slice(keyvalStart)`) and checking the slice directly.
2. **FallbackConfigPanel `buildConfigPatch` signature regex** — the original regex `\s*\)` after `Partial<FallbackConfig>` did not match the actual source, which has `Partial<FallbackConfig>,\n  ): FallbackConfig {` (TypeScript formatter wraps the long type after `,` and there's a newline + indent between `>` and `)`). Fixed by widening the regex to `[\s\S]*?\)` (any chars including newlines) between the `>` and the `)`.
3. **FallbackConfigPanel `onUpdate` count** — the original test sliced just the helpers block (`syncBlocked` to `return (`) and counted `onUpdate(` calls expecting exactly 1. But the JSDoc for `buildConfigPatch` contains 2 literal `onUpdate(...)` references inside `/* ... */` block comments, and the slice boundaries missed the `updateField` call. Actual count was 2. Fixed by stripping `/* ... */` block comments and `// ...` line comments FIRST, then counting `\bonUpdate\s*\(` calls. After stripping, the count is exactly 1. This is the same P-208-2 "block-comment-stripping" recipe codified for the List 2 `window.confirm` sister test, applied here to the `onUpdate` count invariant. Codified as the new pitfall **P-215-1** (block-comment-stripping for count invariants in JSDoc-documented files).

**No external behaviour change** — both refactors are byte-equivalent structural extractions. The .env preview in the file-section page still renders the same 4 visual variants (now via the `EnvLineRow` component); the 3 `FallbackConfigPanel` field-update handlers still produce the same `FallbackConfig` patches (now via the `updateField + buildConfigPatch` helper pair).

**Tests:** 336 suites / 2621 tests pass (was 334/2602 after the session 214 followup = +2 suites, +19 tests). `npx tsc --noEmit` clean, `CI=true npx eslint ... --max-warnings 0` clean across all 5 touched files, `npm run build` clean (1 pre-existing Turbopack NFT warning from `next.config.ts`, unrelated).

**Reference doc:** `docs/references/session-215-list4-f5-closure-env-line-row-and-fallback-config-panel.md` — the per-session reference. Documents the F.5 carryover closure protocol (8 steps), the 2 refactor's pre/post shape, the 3 test-assertion fixes with regex gotcha details, and the new pitfall P-215-1.

The full session 215 detail (F.5 closure protocol recap, verification, file inventory) is in the `pr-body.txt` archive at HEAD.

---

## Followup (June 14, 2026) — Session 214

Since the previous session 213 followup, one additional session has landed on this branch:

**Session 214 — List 2 (Cron, Missions, Chat)** — `useMissionsPage` dead-state removal (4 useState slots + 2 return-object setters). A small but precise dead-code cleanup in the Missions surface:

1. **`scheduleType` + `scheduleStartTime` useState slots removed** from `src/hooks/useMissionsPage.ts`. The `scheduleType` slot (`useState<"interval" | "wall-clock" | "post-run">("interval")`) was written 3 times and read 0 times — the `SchedulePicker` is string-driven. The `scheduleStartTime` slot (`useState("00:00")`) was never mutated from its default and never read.
2. **2 matching fields removed from the `MissionFormState` interface** in `src/components/missions/MissionCreateForm.tsx` — no consumer ever destructured `formState.scheduleType` or `formState.scheduleStartTime`.
3. **`setShowCategoryManager` + `setShowTemplateManager` removed from the hook's return object**. The page uses the named `openCategoryManager` / `closeCategoryManager` / `openTemplateManager` / `closeTemplateManager` callbacks instead. The setters are still USED internally by the `openX` callbacks (anti-migration guard pinned in the new test).
4. **`setFormField` no longer has entries for the 2 dead fields** (would otherwise crash with `setters[field](value)` on `undefined`).
5. **`populateFormFromMission` no longer calls `setScheduleType(...)`** — only `setNewSchedule` remains in the schedule branch.
6. **2 test `baseFormState` mock objects updated** in `mission-composer-actions.test.tsx` and `mission-dispatch-gate.test.tsx` to drop the 2 fields from the interface shape.
7. **Line-number update** in `window-confirm-source-patterns-list2.test.ts` (1100 → 1091) for the "Overwrite template?" site, because the dead-state removal shifts the file by 9 lines.

**Source-pattern test** (1 new file, 19 assertions across 6 describes):
- `tests/unit/use-missions-page-dead-state-removal.test.ts` — pins the post-extraction shape: hook no longer declares the 2 useState slots, `formState` no longer exposes them, `setFormField` no longer has entries for them, `populateFormFromMission` no longer calls `setScheduleType`, `MissionFormState` no longer declares the fields, hook's return object no longer exposes the 2 setters, the 2 test mocks lose the 2 fields. Plus 2 anti-migration guards: the corresponding STATE values (`showCategoryManager`, `showTemplateManager`) are still declared, and the `openX` callbacks still call the setters internally. Plus a source-wide grep assertion: the 2 names are completely absent from `src/`.

**No external behaviour change** — the `SchedulePicker` still updates the schedule string the same way, the modals still open/close the same way, the form fields still render the same way. The 2 dead useState slots no longer trigger re-renders on the (non-existent) state churn.

**Tests:** 334 suites / 2602 tests pass (was 333/2583 after the session 213 followup = +1 suite, +19 tests). `npx tsc --noEmit` clean, `CI=true npx eslint ... --max-warnings 0` clean across all 6 touched files, `npx --yes pnpm@10.33.0 build` clean.

**Reference doc:** `docs/references/session-214-list2-use-missions-page-dead-state-removal.md`.

The full session 214 detail (pre-session shape, post-session shape, anti-migration guards, byte-equivalence rationale, verification, file inventory, 4 new pitfalls) is in the `pr-body.txt` archive at HEAD.

---

## Recent sessions (full detail)

## Session 213 — List 1 (Dashboard, Sessions, Memory, Logs) — Hindsight `HINDSIGHT_INPUT_CLASS` constants + `RowActionButtons` shared components

**Date:** 2026-06-14
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 1 (List 1: Dashboard, Sessions, Memory, Logs). Last List 1 pick was session 211 (the `Panel` + `PanelHeader` extraction on the dashboard). Session 213 picks a fresh surface in the Hindsight memory area that session 211 did not touch.
**Outcome:** **2 byte-equivalent structural extractions in the Hindsight memory surface** — `HINDSIGHT_TEXT_INPUT_CLASS` + `HINDSIGHT_TEXTAREA_CLASS` constants (9-site migration in `Modals.tsx`) + `RowEditButton` + `RowDeleteButton` shared components (4-site migration across `DirectivesTab.tsx` + `MentalModelsTab.tsx`). 2 new source-pattern tests (33 assertions). No external behaviour change.

### What shipped

1. **`HINDSIGHT_TEXT_INPUT_CLASS` + `HINDSIGHT_TEXTAREA_CLASS` constants** (new in `src/components/memory/hindsight/utils.ts`, +44 lines) — 6 byte-identical text-input Tailwind className strings + 3 byte-identical textarea className tails in `Modals.tsx` consolidated. The textareas each compose their own `w-full h-N` height prefix at the call site. Two constants (not one) because the input uses `px-3 py-2` and the textarea uses `p-3 resize-none`.

2. **`RowEditButton` + `RowDeleteButton` shared components** (NEW: `src/components/memory/hindsight/RowActionButtons.tsx`, 105 lines) — 4 byte-identical `<button>` blocks (2 Edit + 2 Delete) across `DirectivesTab.tsx` + `MentalModelsTab.tsx` consolidated. The destructive-intent styling (`hover:bg-red-500/10` + `hover:text-red-400` for Delete) is centralised. The middle Toggle/Refresh button in each tab stays inline (different shape, anti-migration guard). `Pencil` and `Trash2` icons move from both tabs' `lucide-react` import to the new `RowActionButtons.tsx` file.

3. **Source-pattern tests** (2 new files, 33 assertions):
   - `tests/unit/hindsight-input-class-extraction.test.ts` (14 assertions) — pins both constant exports with byte-identical strings, `Modals.tsx` imports both, all 9 inline className strings are gone, surrounding JSX stays unchanged.
   - `tests/unit/hindsight-row-action-buttons-extraction.test.ts` (19 assertions) — pins the shared component file with both exports, both tabs import both, all 4 inline buttons removed, both tabs no longer import `Pencil`/`Trash2`, middle buttons stay inline.

### Verification

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/components/memory/hindsight/RowActionButtons.tsx src/components/memory/hindsight/DirectivesTab.tsx src/components/memory/hindsight/MentalModelsTab.tsx src/components/memory/hindsight/Modals.tsx src/components/memory/hindsight/utils.ts tests/unit/hindsight-input-class-extraction.test.ts tests/unit/hindsight-row-action-buttons-extraction.test.ts --max-warnings 0`: clean (0 warnings)
- `npm run build`: clean
- `CI=true npx jest`: **333 suites / 2583 tests pass** (was 331/2550 after session 212; +2 new suites, +33 new tests from the source-pattern tests)

### Files

| Type | Change |
|------|--------|
| New | `src/components/memory/hindsight/RowActionButtons.tsx` (105 lines, with JSDoc) |
| New | `tests/unit/hindsight-input-class-extraction.test.ts` (~200 lines) |
| New | `tests/unit/hindsight-row-action-buttons-extraction.test.ts` (~225 lines) |
| New | `docs/references/session-213-list1-hindsight-input-class-and-row-action-buttons.md` |
| Modified | `src/components/memory/hindsight/utils.ts` (+44 lines for the 2 new constants + JSDoc) |
| Modified | `src/components/memory/hindsight/Modals.tsx` (6 input + 3 textarea className strings replaced) |
| Modified | `src/components/memory/hindsight/DirectivesTab.tsx` (2 inline `<button>` blocks replaced; `Pencil` + `Trash2` removed) |
| Modified | `src/components/memory/hindsight/MentalModelsTab.tsx` (same migration) |

## Session 212 — List 2 (Cron, Missions, Chat) — `MessageBubble` + `MessageAvatar` extraction

See pr-body.txt for full session 212 detail. Headline: extracted 2 new components from the chat surface — `MessageBubble` (chat page's 50-line `messages.map` body collapsed to 1-line `<MessageBubble msg={msg} />`) and `MessageAvatar` (3 byte-identical 4-line `w-8 h-8 rounded-lg bg-neon-X/20 ...` icon chips consolidated via role-driven `AVATARS` map). `AVATAR_ROLE` type exported for exhaustive type discipline. 17-assertion source-pattern test. 2550/2550 tests pass.

## Session 211 — List 1 (Dashboard, Sessions, Memory, Logs) — `Panel` + `PanelHeader` extraction

See pr-body.txt for full session 211 detail. Headline: extracted `<Panel>` + `<PanelHeader>` from `src/components/dashboard/Panel.tsx` — consolidates the "rounded card with icon-and-label header" shell that 5 of the 6 dashboard panels duplicated verbatim. 14-assertion source-pattern test. 2533/2533 tests pass.

**Session 208** — List 2 — 3 per-row `window.confirm` sites in useMissionsPage lifted to leaf components (per-row `useTwoStepConfirm` migration)
## Session 206 — List 2 (Cron, Missions, Chat) — 3 missions-modal close-callbacks promoted from `missions/page.tsx` to `useMissionsPage` hook (open/close pair symmetry)

See pr-body.txt for full session 206 detail. Headline: 3 page-local `useCallback(() => setX(false), [setX])` close-callbacks (`closeCategoryManager` / `closeTemplateManager` / `closeTemplateEditor`) promoted to the `useMissionsPage` hook as named siblings of the existing `openX` callbacks. The HARD 2-setter `cancelTemplateEditor` (clears `editingTemplateId` too) is intentionally NOT promoted (2-setter shape doesn't fit the hook's single-setter close-callback contract). 20-assertion source-pattern test + 4 new assertions in `open-category-manager-callback.test.ts`. 2437/2437 tests pass.

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

**Session 199** — List 2 — `handlePauseAllForActiveTab` page-local useCallback extraction in cron page (1-site sister to `openCreateForActiveTab`)
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
**Session 206** — List 2 — 3 missions-modal close-callbacks promoted from missions/page.tsx to useMissionsPage hook (open/close pair symmetry; HARD 2-setter cancelTemplateEditor intentionally NOT promoted)

No new reference doc — the work is a single small-bore refactor with one well-known pattern ("always-the-same override is boilerplate"), and the source-pattern test file's JSDoc header already documents the pre-session shape, the post-session shape, the anti-migration guards, and the byte-equivalence rationale. A reference doc would be redundant with the test file.

### Next session should

**Session 200** — List 4 — `window.confirm` → `useTwoStepConfirm` migration in Models table + FallbackChainList (2-site migration: per-row per-key confirm + `ModelRow` + `FallbackRow` sub-component extraction + test filter scope extension)
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

**Session 214** — List 2 — `useMissionsPage` dead-state removal (4 useState slots + 2 return-object setters) + `MissionFormState` interface field removal (session 214 followup)
**Session 213** — List 1 — Hindsight `HINDSIGHT_INPUT_CLASS` constants + `RowEditButton` / `RowDeleteButton` shared components (9-site + 4-site migration) + 2 new source-pattern tests
**Session 209** — List 3 — `useCopyToClipboard` hook extraction (NEW: `src/hooks/useCopyToClipboard.ts`) + 2-site migration (MessageBubble 1500ms + PersonalityCard 2000ms) + carryover closure (getMessageRole 4th caller + dashboard-error-dedup dead-code removal)
**Session 200** — List 4 — `window.confirm` → `useTwoStepConfirm` migration in Models table + FallbackChainList (2-site migration: per-row per-key confirm + `ModelRow` + `FallbackRow` sub-component extraction + test filter scope extension)

**Session 194** — List 4 — `safeProfileSlug` file-local helper extraction in `src/app/api/agent/files/[key]/route.ts` (Rule of Two in-file Set/Map extraction — sister to session 193's `existingFallbackKeys` extraction)
**Session 193** — List 4 — `ConfigModelSection` interface consolidation (export from `hermes-import.ts` + 1-site migration in `models/[id]/diff/route.ts`) + `existingFallbackKeys()` helper extraction in `models/fallbacks/import/route.ts` (2-site migration) (close session 192 carryover)
**Session 192** — List 4 — `isManagedKey` runtime predicate extraction from `MANAGED_KEYS` Set literal + 3-site migration in `src/app/api/agent/files/[key]/route.ts`
**Session 196** — List 4 — `closeModelEditor` + `closeFallbackModal` + `closeAddCustom` + `closeSyncModal` 1- and 2-setter close-callback extractions across 4 files in the List 4 surface (close session 195 followup)
**Session 191** — List 3 — `toggleActiveCollapsed` / `toggleInactiveCollapsed` 1-setter toggle-callback extraction in `src/app/operations/skills/page.tsx`
**Session 190** — cross-list (List 2 + List 1 + List 3) — `getCategoryIdFromTemplate` helper + redundant `isCustom` cast removal + `onEditTemplate` signature narrowing in `useMissionsPage` + `cron/page.tsx` `hardwareEnabled`/`hardwareTotal` single-pass reduce + `handleToggleSkill` callback consolidation in `skills/page.tsx`
**Session 197** — List 2 — `prependAndActivateSession` 2-setter helper extraction in chat page (2-site migration)
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

**Session 195** — List 1 — `hindsightMutate` helper extraction in HindsightBrowser.tsx (4-site migration) (close session 190 plan)