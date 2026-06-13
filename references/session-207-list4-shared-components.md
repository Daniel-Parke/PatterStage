# Session 207 — List 4 — 2 shared-component extractions in `src/components/models/`

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 4 (List 4: Models, HERMES.md, Environment, All Settings)

## What this session established

### Pitfall: "Per-row action component extraction" (Rule of Two for action components)

When 2+ table-row components share an **identical** per-row action block (e.g. delete, archive, duplicate) with the same hook instance (`useTwoStepConfirm({ autoDismissMs: 4000 })`) + the same JSX (button + icon + armed-state styling + aria-labels), extract a shared action component **even if the call site has only 2 consumers**.

The pre-extraction form passes the "Rule of Three" test (2 duplicates = wait for a 3rd), but the maintenance cost is asymmetric: any future "armed state visual" tweak (colour, ring, animation) is a 2-file change, not a 1-file change.

**Discriminator:** ask whether the two row components render the **exact same** action button, with the **exact same** hook instance, differing only in the row-specific data (id, name, onDelete callback). If yes, extract.

**Threshold:** 2 sites (Rule of Two for action components, not Rule of Three).

**Trap:** a "similar but not identical" button (e.g. seed page's text+border restore button vs. models' icon-only delete button) is a **different** surface and stays inline. Do NOT force into the shared component.

### Pitfall: "Per-call-site select with shared chrome" (Rule of Two for selects)

When 2+ call sites render the same `<select>` + chevron overlay pattern with **identical** classes (only the placeholder text + background tone differ), extract a shared `ModelSelectDropdown`-style component. The 3 props that vary across the 2 call sites in this session were:
- `placeholder` (text)
- `tone` (background surface: `panel` vs `card`)
- `ariaLabel` / `title` (per-use accessibility hints)

**Discriminator:** if the 2 `<select>` blocks have **identical** className strings and **identical** chevron positioning, but different `placeholder` text + different background tone, extract with 2-3 props. If the selects have **different** classNames (e.g. different focus colour, different label format), they're different surfaces — don't force.

### Anti-migration guards (consolidated from session 200 + 207)

| Surface | Why it does NOT migrate to `ModelSelectDropdown` |
|---|---|
| `ModelsAgentDefaultSection.tsx` (agent-default select) | Different focus colour (`neon-orange` vs `neon-purple`), no chevron overlay, different label format (`${name}` only — no `(${provider}/${modelId})`) |
| `CredentialPicker.tsx` (credential select) | Different placeholder text ("+ Create new credential"), different `__new__` sentinel-value handling, different focus / background styling |
| `src/app/config/[section]/page.tsx` (.env line display) | Different domain (parsed env line display, not a model picker) |
| `src/app/config/seed/page.tsx` (per-agent restore button) | Different styling pattern (text+border button, not icon-only+ring) — does NOT migrate to `PerRowDeleteButton` |
| `src/app/page.tsx` (per-mission cancel button) | Different styling pattern — does NOT migrate to `PerRowDeleteButton` |
| `BulkAuxiliaryUpdater.tsx` (expand-collapse chevron) | Different `ChevronDown` use (collapse indicator, not select chevron) — kept inline |

### Test design lessons

1. **Per-shared-component contract tests** — when a new shared component is extracted, write a test that pins its contract: the rendered HTML (label format, chevron positioning, aria-label forwarding, controlled value reflection). The contract is the "API" the 2+ call sites depend on.

2. **Per-call-site positive + negative assertions** — for each migrated call site, assert (positive) it imports the shared component, AND (negative) it does NOT import the now-internal pieces (`useTwoStepConfirm`, `ChevronDown`, etc.) that have moved into the shared component. The negative assertion is the regression guard — it catches "moved it back to the page" regressions.

3. **Test-rewrite-when-contract-changes** — the pre-extraction `window-confirm-source-patterns.test.ts` test was pinning the **per-row hook instance** in the row components. The post-extraction contract pins the hook instance in the **shared component**. The test was rewritten (not deleted) to assert the new 3-part contract (shared owns the hook + import; both row files import the shared; neither row file imports the hook directly). Keeping the test in the same file preserves the audit history; rewriting the assertions matches the new shape.

## Files changed in this session

| File | Change | Lines |
|---|---|---|
| `src/components/models/PerRowDeleteButton.tsx` | NEW | +95 |
| `src/components/models/ModelSelectDropdown.tsx` | NEW | +115 |
| `src/components/models/ModelsTableSection.tsx` | Use `PerRowDeleteButton` (drop `useTwoStepConfirm` + `Trash2` imports) | -33 |
| `src/components/models/FallbackChainList.tsx` | Use `PerRowDeleteButton` (drop `useTwoStepConfirm` + `Trash2` imports) | -42 |
| `src/components/models/DefaultsGrid.tsx` | Use `ModelSelectDropdown` (drop `ChevronDown` import) | -15 |
| `src/components/models/BulkAuxiliaryUpdater.tsx` | Use `ModelSelectDropdown` (keep `ChevronDown` for collapse indicator) | -16 |
| `tests/unit/model-select-dropdown-source-pattern.test.tsx` | NEW | +200 |
| `tests/unit/window-confirm-source-patterns.test.ts` | Rewrite "per-row useTwoStepConfirm" test to assert post-extraction shape | +35/-10 |
| `pr-body-headline.md` | Session 207 entry prepended | +78 |

**Net diff:** 6 production files (2 new + 4 modified), 2 test files (1 new + 1 modified), 1 doc file. +274 / -116 lines of code, +0 lines of broken tests.

## Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint ... --max-warnings 0`: clean across all 8 touched files
- `npx jest`: **323 suites / 2446 tests pass** (was 322/2437 = +1 suite, +9 tests)
- `npm run build`: clean

## What the next List 4 session should look at

- Per-row sync icon buttons in `ModelSyncButtons.tsx` (push/pull arrows + spinner logic — candidate for `ModelSyncIconButton` with `direction="push"|"pull"` prop)
- 4 model-list page section headers (`ModelsTableSection`, `ModelsAgentDefaultSection`, `ModelsTaskDefaultsSection`, `ModelsFallbackSection`) all render the same `flex items-center gap-2 ... icon text-X/60` header pattern — candidate for `ModelsSectionHeader` with `icon` + `title` + `iconClass` props
- `saving` + `dirty` + `saveError` triple-state pattern in `FallbackConfigPanel` (lines 32-50 + 133-141 + 152) is the same "save-promise" shape used in `useModelsPage.ts`'s fallback config handlers (lines 432-465) — candidate for a `useSaveableConfig` hook
