# Session 208 — List 2 — `window.confirm` → `useTwoStepConfirm` migration in MissionEditorPanel + TemplateModals (3 per-row sites) + new sister source-pattern test

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 2 (List 2: Cron, Missions, Chat). Last List 2 pick was session 206 (3 missions-modal close-callbacks promoted to the hook) — different sub-surface (leaf-component per-row confirm vs hook callback), so no rotation bump needed.
**Outcome:** **3 per-row `window.confirm` sites lifted from the `useMissionsPage` hook into the leaf components as `useTwoStepConfirm({ autoDismissMs: 4000 })` instances + 1 new source-pattern test (`window-confirm-source-patterns-list2.test.ts`, 3 assertions across 3 describes).** Closes the carryover explicitly documented in `tests/unit/window-confirm-source-patterns.test.ts:48-54` (the List 4 sister test's JSDoc says: "the `useMissionsPage.ts:886` site (List 2) is the only remaining `window.confirm` call in the codebase after the session 138 migration... When that migration lands, the sister test for List 2 (`window-confirm-source-patterns-list2.test.ts`) should be added with the same shape").

## The 4 `window.confirm` sites in the List 2 surface (pre-session)

All 4 were in `src/hooks/useMissionsPage.ts`:

| Line | Site | Shape | Migration |
|---|---|---|---|
| 1029 | `handleSaveAsTemplate` "Overwrite template?" | form-scope, single-button inside the MissionCreateForm Sheet | **NOT migrated** — Rule of Three (3+ sites) not met, documented in EXEMPTIONS |
| 1121 | `handleDeleteTemplate` "Delete this template?" | per-row (per-template in the TemplateManagerModal list) | **MIGRATED** to the `TemplateRow` leaf sub-component in `TemplateModals.tsx` |
| 1145 | `handleDelete` "Delete this mission and its cron job?" | per-row (per-mission in the MissionEditorPanel) | **MIGRATED** to the `MissionEditorPanel` leaf component (deleteConfirm instance) |
| 1161 | `handleCancel` "Cancel this mission?" | per-row (per-mission in the MissionEditorPanel) | **MIGRATED** to the `MissionEditorPanel` leaf component (cancelConfirm instance) |

The 3 per-row sites are sister to the per-row `useTwoStepConfirm` shape that session 200 established in the Models table + FallbackChainList (and session 207 further consolidated into the `PerRowDeleteButton` shared component). The form-scope site (`handleSaveAsTemplate` "Overwrite template?") is intentionally NOT migrated — it's a single-button confirm inside the MissionCreateForm Sheet, not a per-row list/table confirm, so the Rule of Three threshold isn't met. The site's logic stays in the hook as a single inline `window.confirm` call. If a future migration lifts the entire save flow into a leaf component, the confirm can move with it.

## What this session established

### Pitfall: "Per-row confirm inside a hook" — Rule of Three (3+ sites) threshold

The pre-session 207 form had all 3 per-row confirms inside the `useMissionsPage` hook callbacks (`handleDelete`, `handleCancel`, `handleDeleteTemplate`). The hook callbacks received the row id as an argument and gated the destructive action on a single global `window.confirm` dialog. This is the **same** anti-pattern that the List 4 session 138 migration closed in the seed page (the per-agent "Restore this agent" list) and session 200 closed in the Models table + FallbackChainList (the per-model and per-fallback delete buttons):

- A single global `window.confirm` dialog with no per-row context.
- A stale "armed" state from one row could (in the `useTwoStepConfirm` form) leak into a different row's destructive button click minutes later.
- The user could not tell which row they were about to confirm because the dialog was modal but context-free.

The fix: lift the `useTwoStepConfirm` instance into the leaf component, where the row id is in scope at render time. The hook callback becomes a thin transport wrapper — by the time the hook receives the call, the user has already confirmed in the leaf.

**Discriminator:** the row id must be in scope at render time. If the leaf component is per-row (one instance per row, like `MissionEditorPanel` or `ModelRow`), the row id is always in scope. If the row is inlined inside a `.map(...)` (like the `TemplateManagerModal` rows pre-session), extract a per-row sub-component FIRST, then add the `useTwoStepConfirm` to the sub-component.

**Threshold:** 3+ per-row sites in the same hook. The List 2 hook had exactly 3, so the threshold is met. The List 4 hook (`useModelsPage.ts`) had 2 per-row sites (session 200), so the threshold is 2+ for `useTwoStepConfirm` in general (the per-row pattern is well-established since session 138) — but the **lift-into-leaf** migration is 3+ specifically because the leaf must be a per-row sub-component, and 2 inline rows inside a `.map(...)` don't need the lift (the per-row `useTwoStepConfirm` can live in the same map).

**Trap:** the form-scope "Overwrite template?" check in `handleSaveAsTemplate` is a single-button site, not a per-row site. Don't force it into the per-row pattern — it would be a 1-site use of `useTwoStepConfirm` for a button that has no row context. Keep it as an inline `window.confirm` (or migrate to a different confirm mechanism, e.g. a modal) when the save flow gets a refactor of its own.

## Files changed in this session

| File | Change | Lines |
|---|---|---|
| `src/components/missions/MissionEditorPanel.tsx` | Add `useTwoStepConfirm` import + 2 hook instances (deleteConfirm + cancelConfirm) + 2 click handlers (handleDeleteClick + handleCancelClick) + JSX armed-state visuals (ring + bg + "Confirm?" text) | +56 / -7 |
| `src/components/missions/TemplateModals.tsx` | Add `useTwoStepConfirm` import + extract new `TemplateRow` sub-component (per-row useTwoStepConfirm + handleDeleteClick) + JSX armed-state visuals (text-neon-red bg-neon-red/15 ring-1) + replace inline row in TemplateManagerModal with `<TemplateRow ...>` | +104 / -34 |
| `src/hooks/useMissionsPage.ts` | Drop 3 `if (!window.confirm(...)) return;` guards (lines 1029 site stays as the EXEMPTION; the other 3 are gone) | +24 / -9 |
| `tests/unit/window-confirm-source-patterns-list2.test.ts` | NEW sister source-pattern test (3 assertions: un-exempted site count, EXEMPTIONS documentation, leaf-vs-hook contract) | +347 / 0 |

**Net diff:** 3 production files (2 modified), 1 production file (1 new sub-component, counted in TemplateModals.tsx), 1 test file (new). +531 / -50 lines.

## What the new test pins

`tests/unit/window-confirm-source-patterns-list2.test.ts` mirrors the structure of the List 4 sister test:

1. **Scanner test (1 assertion)** — finds every `window.confirm(` callsite in the List 2 surface (`src/app/orchestration/`, `src/components/cron/`, `src/components/missions/`, `src/components/chat/`, + 6 per-file `src/hooks/*.ts` covers) and asserts that the only un-exempted count is 0. The 1 EXEMPTION (the form-scope "Overwrite template?" check at `useMissionsPage.ts:1029`) is documented in the `EXEMPTIONS` array with a reason and a 1-line discriminator.

2. **EXEMPTIONS staleness check (1 assertion)** — every entry in `EXEMPTIONS` must still have a `window.confirm` callsite in its file (the line number may shift across refactors). If the exemption is stale (e.g. someone migrates the form-scope site in a future session), the entry is removed and the EXEMPTIONS array is empty.

3. **Leaf-vs-hook contract test (1 assertion, multi-step)** — pins the post-migration shape:
   - `MissionEditorPanel.tsx` imports `useTwoStepConfirm` + has exactly 2 instantiations of `useTwoStepConfirm({ autoDismissMs: 4000 })` (one for deleteConfirm, one for cancelConfirm).
   - `TemplateModals.tsx` imports `useTwoStepConfirm` + has exactly 1 instantiation of `useTwoStepConfirm({ autoDismissMs: 4000 })` (for the `TemplateRow` sub-component).
   - `useMissionsPage.ts` does NOT import `useTwoStepConfirm` + does NOT instantiate the hook locally (the post-migration "hook is a thin transport wrapper" contract).

## New pitfall codified

**"Block-comment-stripping in source-pattern tests"** — the JSDoc on the migrated files contains inline references to `useTwoStepConfirm({ autoDismissMs: 4000 })` (e.g. line 211 of `TemplateModals.tsx` has `* Sister to the per-row useTwoStepConfirm({ autoDismissMs: 4000 }) instance`). A naive regex count would false-positive the count assertions (3 matches instead of the actual 1 in `TemplateModals.tsx`). The fix: extend the `findSites` comment-stripping step to also mask `/* ... */` block comments, not just `//` line comments. The List 4 sister test's `findSites` only handles line comments because its use case is matching the `window.confirm(` literal (which is unlikely to appear in JSDoc). The List 2 sister's count assertions need a stricter stripper because the JSDoc actively uses the form `useTwoStepConfirm({ autoDismissMs: 4000 })` to document the post-migration contract.

**Discriminator:** if the source-pattern test's assertion is "exactly N instantiations of `<form>(...)` in the code body", and the JSDoc on the file uses the same `<form>(...)` literally, you need block-comment stripping. The List 4 sister test only does line-comment stripping because its assertions are "import is present" + "import is absent" (the JSDoc can mention the form without breaking those). The List 2 sister's "exactly N instantiations" assertion is a stricter shape that needs the block-comment stripper.

**Reusable across:** any future source-pattern test that pins an exact count of `<function>(<args>)` instantiations in a file that has JSDoc documenting the form. The `stripComments(text: string): string` helper in the new test file is the canonical extractor.

## Anti-migration guards (what this session did NOT change)

- **Did NOT migrate the form-scope `window.confirm` at `useMissionsPage.ts:1029`** ("Overwrite template?" in `handleSaveAsTemplate`). It's a single-button confirm inside the MissionCreateForm Sheet, not a per-row list/table confirm. The Rule of Three (3+ sites) threshold for the per-row lift is not met. The site's logic stays in the hook as a single inline `window.confirm` call. The EXEMPTIONS entry documents this rationale.
- **Did NOT add a 2-step confirm for the edit buttons** in `MissionEditorPanel` (line 288-306) or the per-template edit button in `TemplateModals` (line 272-278). Edit is non-destructive (it opens a modal, doesn't delete data), so a confirm is over-engineering.
- **Did NOT add a 2-step confirm for the duplicate button** in `MissionEditorPanel` (line 278-286). Duplicate is non-destructive (it creates a new mission with `(copy)` suffix, doesn't delete the original), so a confirm is over-engineering.
- **Did NOT migrate the per-row toggle buttons** (the `InlineToggle` for fallback entries, the `enabled` toggle for cron jobs) — toggles are reversible, so a confirm is over-engineering.
- **Did NOT migrate the `chat/page.tsx` `confirm("Session deleted")` site** — the chat page uses a different confirm pattern (toast-based, no dialog) and the sister List 2 test would catch any future re-introduction.

## Sister relationships

- **Session 208 ↔ session 200 (List 4 `window.confirm` → `useTwoStepConfirm` migration in Models table + FallbackChainList)** — the per-row `useTwoStepConfirm({ autoDismissMs: 4000 })` shape and the per-row arm/confirm pattern are the same. Session 200 closed the 2 per-row sites in the List 4 surface; session 208 closes the 3 per-row sites in the List 2 surface. The List 4 + List 2 sister tests together cover the full `window.confirm` audit surface.
- **Session 208 ↔ session 207 (List 4 shared-component extraction)** — the `PerRowDeleteButton` shared component that session 207 extracted is the same pattern at a higher level: instead of each row component owning its own `useTwoStepConfirm`, the shared component owns one. The List 2 sister migration doesn't extract a shared component because the 2 leaf components (`MissionEditorPanel` and `TemplateRow`) have different shapes (MissionEditorPanel is a per-row expanded panel; TemplateRow is a flat list row). The "Rule of Two for action components" pitfall from session 207 doesn't apply here because the 2 sites are structurally different (different action: delete vs cancel, different visual surfaces: red ring vs danger button).
- **Session 208 ↔ session 198 (List 2 `dispatchPayload` schedule integration)** — both close small-but-meaty opportunities in the same `useMissionsPage` hook. Session 198 closed the always-the-same-override boilerplate; session 208 closes the per-row confirm inside the hook callbacks. Both are 1-step refactors in the same file, with the same "leaf owns the helper, hook is a thin transport" mental model.

## Verification (full suite)

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/hooks/useMissionsPage.ts src/components/missions/MissionEditorPanel.tsx src/components/missions/TemplateModals.tsx tests/unit/window-confirm-source-patterns-list2.test.ts --max-warnings 0`: clean
- `CI=true npx jest tests/unit/window-confirm-source-patterns-list2.test.ts`: **3/3 pass**
- Full `CI=true npx jest` sweep: **324 suites / 2449 tests pass** (up from 323/2446 = +1 suite, +3 tests)
- `npx --yes pnpm@10.33.0 build`: clean (Next.js production build, all routes pre-rendered correctly)

## What the next List 2 session should look at

- **Random pick next session.** The List 2 surface's 3 per-row `window.confirm` sites are now closed; the 1 form-scope site is documented as out of scope. Candidates worth re-scanning: (a) the `useMissionsPage` `useState` slot count is still ~20 (the `clearMissionFormFields` helper already centralises the form-field resets, but the underlying slots are unchanged — could collapse to a single `useState<MissionFormState>` with a `setFormState` setter if the type signature allows it), (b) the 2 `if (isArmedFor(mission.id))` check + 2 `useTwoStepConfirm` instantiation pattern in `MissionEditorPanel` could collapse to a single `useTwoStepConfirmFor(id: string, options: { confirmLabel: string })` helper if a 3rd per-row action lands in the panel (the helper would own the `isArmedFor` + `confirm` + `arm` + `handleClick` shape), (c) the `dispatchMode` setter in `useMissionsPage` (which also calls `setDispatchAcknowledged(true)` as a side effect, lines 261-264) is a similar 1-setter-with-side-effect pattern — could extract a `setDispatchModeAndAcknowledge` helper if a future setter is added.
- **Carryover** — none. The next session starts with a clean working tree.
