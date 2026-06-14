# Session 213 — List 1 (Dashboard, Sessions, Memory, Logs) — Hindsight `HINDSIGHT_INPUT_CLASS` constants + `RowActionButtons` shared components

**Date:** 2026-06-14
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 1 (List 1: Dashboard, Sessions, Memory, Logs). Last List 1 pick was session 211 (the `Panel` + `PanelHeader` extraction on the dashboard). Session 213 picks a fresh surface in the Hindsight memory area that session 211 did not touch.
**Status:** committed + pushed (commit at HEAD on `mission/hermes-review-and-refactor`).

## What this refactor did

Two byte-equivalent consolidation opportunities in the Hindsight memory surface (List 1 territory), each in its own focused commit:

1. **`HINDSIGHT_TEXT_INPUT_CLASS` + `HINDSIGHT_TEXTAREA_CLASS` constants** in `src/components/memory/hindsight/utils.ts`, with 9-site migration in `Modals.tsx`.
2. **`RowEditButton` + `RowDeleteButton` shared components** in a new `src/components/memory/hindsight/RowActionButtons.tsx`, with 4-site migration in `DirectivesTab.tsx` + `MentalModelsTab.tsx`.

## Extraction 1 — `HINDSIGHT_TEXT_INPUT_CLASS` + `HINDSIGHT_TEXTAREA_CLASS` (9-site migration)

`Modals.tsx` rendered the byte-identical Tailwind className for the standard Hindsight modal text `<input>` at **6 sites** (memory content tags, directive name, directive priority, directive tags, model name, model tags):

```
w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2
text-sm text-white/80 focus:border-pink-500/50 focus:outline-none
```

…and the byte-identical **tail** of the className for the standard Hindsight modal `<textarea>` at **3 sites** (memory content h-32, directive content h-28, model source-query h-28):

```
bg-dark-800 border border-white/10 rounded-lg p-3 text-sm
text-white/80 resize-none focus:border-pink-500/50 focus:outline-none
```

The textareas each add their own `w-full h-N` height prefix at the call site, so the constant holds the shared base. The constant is composed as `` className={`w-full h-32 ${HINDSIGHT_TEXTAREA_CLASS}`} ``.

**Why two constants, not one:** the text input uses `px-3 py-2`, the textarea uses `p-3 resize-none`. Collapsing them into a single constant with a conditional prop would require either (a) a `variant: "input" | "textarea"` discriminator with a string assembly, or (b) a single mega-string that doesn't match either pre-extraction form. Two constants keeps each one byte-equivalent to its pre-extraction inline string.

**`as const` + explicit `string` type annotation** keeps the union literal shape stable across re-exports. Tailwind's JIT compiler scans the source for class name strings either way; the `as const` is for the type system, not for Tailwind.

## Extraction 2 — `RowEditButton` + `RowDeleteButton` (4-site migration)

`DirectivesTab.tsx` and `MentalModelsTab.tsx` both render a per-row action button group (Edit / (Toggle|Refresh) / Delete) inside the same wrapper div (`flex items-center gap-1 shrink-0`). The **Edit** and **Delete** `<button>` blocks were byte-identical at both call sites — same className, same Lucide icon (`Pencil` / `Trash2`), same `title` text, same `onClick: () => void` signature. The **middle button** (Toggle in DirectivesTab, Refresh in MentalModelsTab) is intentionally NOT extracted — it has a different shape per tab (different icon, different onClick signature, conditional `disabled` + `animate-pulse` for the Refresh state). Forcing it into a shared component would require a 5-prop API surface with 2 of the 5 props no-op at one of the 2 sites — net negative.

**Distinguishing styling between Edit and Delete** (preserved in the shared components):
- Edit hover: `hover:bg-white/5` + `hover:text-white/70`
- Delete hover: `hover:bg-red-500/10` + `hover:text-red-400`

Centralising the destructive-intent colour into the shared component ensures a future "make destructive actions more obvious" tweak lands in one place.

**Icon import migration** — `Pencil` and `Trash2` move from the `lucide-react` import in `DirectivesTab.tsx` and `MentalModelsTab.tsx` (where they were only used by the inlined buttons) to the new `RowActionButtons.tsx` file. Both tabs no longer import those two icons.

## Anti-migration guards

- **Middle Toggle button in `DirectivesTab.tsx` stays inline** (different icon `Power`, different onClick signature `(item: DirectiveRow) => void`, different `title="Toggle"`).
- **Middle Refresh button in `MentalModelsTab.tsx` stays inline** (different icon `RefreshCw`, conditional `disabled` + `animate-pulse` for the in-flight state, different onClick signature, different `title="Refresh"`).
- **`<label>` and `<Modal>` + `<Button>` shells in `Modals.tsx` stay unchanged** — only the input/textarea className strings are extracted, not the surrounding JSX structure.

## Tests

Two new source-pattern tests (no full-page render — Hindsight modals require mocking the `/api/memory/hindsight` POST/DELETE lifecycle and the `<Modal>` Sheet wrapper; the harness would dwarf the invariants being tested):

- `tests/unit/hindsight-input-class-extraction.test.ts` (new, 14 assertions across 5 describes) — pins:
  - Both `HINDSIGHT_TEXT_INPUT_CLASS` and `HINDSIGHT_TEXTAREA_CLASS` constants exported from `utils.ts` with byte-identical strings
  - `Modals.tsx` imports both constants
  - The 6 input className strings (one per modal field) are gone from `Modals.tsx` — replaced with constant references
  - The 3 textarea className strings (one per modal field) are gone — replaced with constant references composed with their own `w-full h-N` height prefix
  - The surrounding JSX (`<label>`, `<Modal>`, `<Button>`) stays unchanged
  - The exported `stringOr` helper and other `utils.ts` exports are unaffected

- `tests/unit/hindsight-row-action-buttons-extraction.test.ts` (new, 19 assertions across 5 describes) — pins:
  - `RowActionButtons.tsx` exists with both `RowEditButton` and `RowDeleteButton` exports
  - Both `DirectivesTab.tsx` and `MentalModelsTab.tsx` import both components
  - All 4 inline `<button>` blocks (2 in each tab) are gone
  - The 2 migrated Edit sites use `<RowEditButton onClick={...} />` with the right onClick signature
  - The 2 migrated Delete sites use `<RowDeleteButton onClick={...} />` with the right onClick signature
  - Both tabs no longer import `Pencil` or `Trash2` from `lucide-react`
  - The middle Toggle/Refresh button stays inline in each tab
  - The shared component file uses the same byte-identical className as the pre-extraction form

## Verification

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/components/memory/hindsight/RowActionButtons.tsx src/components/memory/hindsight/DirectivesTab.tsx src/components/memory/hindsight/MentalModelsTab.tsx src/components/memory/hindsight/Modals.tsx src/components/memory/hindsight/utils.ts tests/unit/hindsight-input-class-extraction.test.ts tests/unit/hindsight-row-action-buttons-extraction.test.ts --max-warnings 0`: clean (0 warnings)
- `npm run build`: clean
- `CI=true npx jest`: **333 suites / 2583 tests pass** (was 331/2550 after session 212; +2 new suites, +33 new tests from the source-pattern tests)

## Files

| Type | Change |
|------|--------|
| New | `src/components/memory/hindsight/RowActionButtons.tsx` (105 lines, with JSDoc explaining extraction rationale + anti-migration guards) |
| New | `tests/unit/hindsight-input-class-extraction.test.ts` (~200 lines) |
| New | `tests/unit/hindsight-row-action-buttons-extraction.test.ts` (~225 lines) |
| Modified | `src/components/memory/hindsight/utils.ts` (+44 lines for the 2 new constants + JSDoc) |
| Modified | `src/components/memory/hindsight/Modals.tsx` (6 input + 3 textarea className strings replaced with constant references) |
| Modified | `src/components/memory/hindsight/DirectivesTab.tsx` (2 inline `<button>` blocks replaced with `<RowEditButton>` + `<RowDeleteButton>`; `Pencil` + `Trash2` removed from lucide-react import) |
| Modified | `src/components/memory/hindsight/MentalModelsTab.tsx` (same migration) |
| New | `docs/references/session-213-list1-hindsight-input-class-and-row-action-buttons.md` (this file) |
| Modified | `pr-body.txt` + `pr-body-headline.md` (session 213 entry) |

## Next session should

- **Pick a random list** — list rotation: List 1 last picked 213, List 2 last picked 212, List 3 last picked 209, List 4 last picked 210. The next pick should rotate (likely 2 or 3).
- **Carryover** — closed. Both Hindsight extraction targets (input className constants + per-row action buttons) are now in the shared `utils.ts` + `RowActionButtons.tsx` files. A future List 1 pick that revisits the Hindsight surface would need a different angle (e.g. the 3 modal close-callbacks in `Modals.tsx` follow the `closeTemplateManager` / `openTemplateManager` sister pattern from session 206 — same 1-line-`setShowX(false)` shape duplicated 3 times, but the helper is so thin that the extraction gain is marginal).
