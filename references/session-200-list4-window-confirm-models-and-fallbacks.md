# Session 200 — List 4 — `window.confirm` → `useTwoStepConfirm` migration in Models table + FallbackChainList (2-site migration + per-row per-key confirm + test filter scope extension)

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 4 (List 4: Models, HERMES.md, Environment, All Settings).
**Status:** committed + pushed.

## What this refactor did

Migrated the 2 remaining `window.confirm(` callsites in the List 4 surface (per the user-stated page set "Models, HERMES.md, Environment, All Settings") to per-row `useTwoStepConfirm` instances owned by the leaf component. Also extended the `window-confirm-source-patterns.test.ts` filter to cover the **full** List 4 surface — the pre-session test only scanned `src/app/config/` + `src/components/config/`, missing the Models page's hook (`src/hooks/useModelsPage.ts`) and the Models page's components (`src/components/models/`).

The pre-session `window.confirm` was a single global native dialog (anti-pattern #8 in `overnight-refactor-patterns`):
- `src/hooks/useModelsPage.ts:220` — `if (!confirm(\`Delete model "${model.name}"? This cannot be undone.\`)) return;` (the `handleDelete` pre-confirm guard for the per-model delete button in `ModelsTableSection`).
- `src/components/models/FallbackChainList.tsx:148` — `if (!confirm("Remove this fallback model?")) return;` (the `handleDeleteClick` pre-confirm guard for the per-fallback delete button).

Both were a **single global dialog with no per-row context** — clicking delete on a model in a 5-row table would surface the same native dialog regardless of which row the user clicked. The migrated shape lifts the confirm into the leaf component so each row owns its own `useTwoStepConfirm` (per-key variant: `autoDismissMs: 4000`), so a "Click again to confirm" state is row-scoped, and a stale "armed" state from one row cannot accidentally fire when the user clicks a different row's delete button minutes later.

## The pattern: "per-row two-step confirm" (Rule of Three from the existing seed page + dashboard)

The per-row confirm pattern was already established in the codebase by:
- `/config/seed/page.tsx` `agentRestore = useTwoStepConfirm({ autoDismissMs: 4000 })` — per-agent "Restore this agent" button in the seed page's professional-agents list (session 138).
- `src/app/page.tsx` `useTwoStepConfirm({ autoDismissMs: 4000 })` — per-mission "Cancel mission" button in the dashboard's active-missions list (pre-existing).

Both are per-key (`armedKey = missionId` or `armedKey = agentId`) so each row arms and confirms independently. The 2 new sites follow the same shape — each `ModelRow` (in `ModelsTableSection`) and each `FallbackRow` (in `FallbackChainList`) owns its own `useTwoStepConfirm({ autoDismissMs: 4000 })` instance.

## What this session changed (file-level)

1. **`src/components/models/ModelsTableSection.tsx`** — extracted the row into a `ModelRow` sub-component that owns its own `useTwoStepConfirm({ autoDismissMs: 4000 })`. The per-row delete button now has a "Click again to confirm" armed state with a red ring + bg highlight matching the seed page's "Restore this agent" pattern. The ModelsTableSection's outer map delegates to the new sub-component.

2. **`src/components/models/FallbackChainList.tsx`** — extracted the row into a `FallbackRow` sub-component with the same per-row `useTwoStepConfirm({ autoDismissMs: 4000 })` shape. The inline `handleDeleteClick` function (with its `window.confirm` call) was deleted; the row click handler now lives inside `FallbackRow` and dispatches via `isArmedFor(entry.id) ? deleteConfirm.confirm(...) : deleteConfirm.arm(entry.id)`. The per-row delete button has the same red ring + bg armed-state visual.

3. **`src/hooks/useModelsPage.ts`** — removed the `window.confirm(...)` guard from `handleDelete`. The hook no longer needs to know about confirm-state — that's now owned by the leaf component, where the model id is in scope at render time. Added a JSDoc comment explaining that the per-row confirm has already fired by the time `handleDelete` is called.

4. **`tests/unit/window-confirm-source-patterns.test.ts`** — extended the filter to cover the full List 4 surface:
   - Added `src/components/models/` to `LIST4_DIRS` (the Models page's components are part of the List 4 surface per the user-stated "Models, HERMES.md, Environment, All Settings" page set).
   - Added `LIST4_FILES = [join("src", "hooks", "useModelsPage.ts")]` (the Models page's hook is a single file, not a directory, so it doesn't fit the recursive `walk()` shape).
   - Updated `collectAllSites()` to walk both `LIST4_DIRS` and `LIST4_FILES`.
   - Added a new positive-shape assertion (`replaces the global \`window.confirm\` with per-row \`useTwoStepConfirm\` in the Models table + FallbackChainList`) that pins the post-migration pattern. A bare import with no call site would also be a regression — the test asserts BOTH the import AND the `useTwoStepConfirm({ autoDismissMs: 4000 })` instantiation.
   - Updated the test name + JSDoc to reflect the expanded filter scope.

## Anti-migration guards (what this session did NOT change)

- Did NOT migrate the `useMissionsPage.ts:886`, `useMissionsPage.ts:1080/1104/1120` (List 2), `src/app/page.tsx:262` (List 1), `src/app/recroom/story-weaver/page.tsx:30` (Rec Room), `src/app/recroom/story-weaver/library/page.tsx:33` (Rec Room), `src/components/cron/JobCard.tsx:58` (List 2), `src/components/cron/SystemCronCard.tsx:41` (List 2) sites. These are in OTHER list surfaces and are out of scope for the List 4 pick. The test's filter is List 4 only; those sites will be caught by their own per-list sister tests when their respective list picks land.
- Did NOT add a 2-step confirm for the **edit** buttons in ModelsTableSection + FallbackChainList. Edit is non-destructive (it opens a modal, doesn't delete data), so a confirm is over-engineering.
- Did NOT migrate the per-row toggle buttons (the `InlineToggle` for fallback entries) — toggles are reversible, so a confirm is over-engineering.

## Sister relationships

- **Session 200 ↔ session 138 (seed page)**: the per-row confirm in the seed page's "Restore this agent" list established the per-key `useTwoStepConfirm` shape. Session 200 closes the Models table + FallbackChainList siblings.
- **Session 200 ↔ session 196 (List 4 close-callback extractions)**: sister List 4 surface refactor — both close the gap that session 138's seed-page migration left in the "window.confirm" pattern. Session 196 closed the close-callback shape (`closeModelEditor`, `closeFallbackModal`, `closeAddCustom`, `closeSyncModal`); session 200 closes the confirm shape.
- **Session 200 ↔ the `models-table-row-extraction` (pre-existing)**: the `ModelsTableSection` row was already mapped inline. Extracting into a `ModelRow` sub-component is a **necessary precondition** for the per-row confirm — the hook needs the model id in scope at render time, which the per-row sub-component provides.

## Byte-equivalence argument

The pre-session flow was:
1. User clicks delete on a row.
2. `onDelete(m)` is called → `handleDelete` runs.
3. `handleDelete` calls `window.confirm("Delete model ...")`. If false, early return.
4. If true, the DELETE API call fires.

The post-session flow is:
1. User clicks delete on a row.
2. `handleDeleteClick` (in the row's `useTwoStepConfirm`-armed branch) calls `deleteConfirm.confirm(() => onDelete(model))` → `onDelete(m)` is called → `handleDelete` runs.
3. `handleDelete` calls the DELETE API call (no confirm check — the confirm has already fired).

The DELETE API call is fired under the same conditions (only when the user explicitly confirms). The only difference is HOW the user confirms — a single global native dialog vs. an in-page row-scoped "Click again to confirm" state. The end result (a successful DELETE or no DELETE) is byte-identical.

## Verification

- `npx tsc --noEmit`: clean
- `npm run lint` (`eslint . --max-warnings 0`): clean
- `npm run build`: clean (Next.js production build, all 30 routes pre-rendered correctly)
- `npx jest tests/unit/window-confirm-source-patterns.test.ts`: 4/4 pass (1 scanner, 1 exemption, 1 fixture, 1 new positive-shape)
- Full `npx jest --no-coverage` sweep: 321 suites / 2413 tests pass (up from 320/2408 = +1 test in the existing suite — the new positive-shape test; the existing 3 tests in the suite were already there and still pass)

## Next-session carryover

- The `useMissionsPage.ts:886/1080/1104/1120` (List 2), `src/app/page.tsx:262` (List 1), `src/app/recroom/story-weaver/page.tsx:30` + `library/page.tsx:33` (Rec Room), `src/components/cron/JobCard.tsx:58` + `SystemCronCard.tsx:41` (List 2) `window.confirm` sites remain. A future List 1, List 2, or Rec Room pick can close them using the same per-row `useTwoStepConfirm` migration pattern, and a sister `window-confirm-source-patterns-listN.test.ts` test should be added to pin the per-list migration.
- A new audit-found pattern surfaced: the per-row `useTwoStepConfirm` shape (per-key) is now established across 4 components (`ModelRow`, `FallbackRow`, `seed/agentRestore`, `dashboard/missionCancel`). The "1-setter close-callback" family has a sibling — "1-key per-row toggle" — and the per-list surface tests can be extended to assert both shapes going forward.
