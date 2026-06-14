# Session 214 — List 2 (Cron, Missions, Chat) — Dead state removal in `useMissionsPage` + `MissionCreateForm`

**Date:** 2026-06-14
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 2 (List 2: Cron, Missions, Chat). Last List 2 pick was session 212 (`MessageBubble` + `MessageAvatar` extraction in the chat surface). Session 214 picks the Missions side of the same list and closes a tiny dead-state carryover from the prior sessions.
**Status:** committed + pushed (commit at HEAD on `mission/hermes-review-and-refactor`).

## What this refactor did

Four dead `useState` slots + two dead return-object setters, all in the List 2 Missions surface, removed in one pass:

1. **`scheduleType` useState** in `src/hooks/useMissionsPage.ts` (declared `useState<"interval" | "wall-clock" | "post-run">("interval")`). Never read by any consumer — grep `\.scheduleType` returns 0 hits in `src/` or `tests/`. The `SchedulePicker` consumes only `value` + `onChange` strings.
2. **`scheduleStartTime` useState** in the same file (declared `useState("00:00")`). Never mutated from `"00:00"`, never read.
3. **Two matching fields on the `MissionFormState` interface** in `src/components/missions/MissionCreateForm.tsx` (lines 36-37 of the pre-session file). Removed because no consumer destructured `formState.scheduleType` or `formState.scheduleStartTime`.
4. **Two return-object setters** — `setShowCategoryManager` and `setShowTemplateManager` — removed from the hook's return object. Neither is destructured by the page (the page uses the named `openCategoryManager` / `closeCategoryManager` / `openTemplateManager` / `closeTemplateManager` callbacks instead). The setters are still used internally by the `openX` callbacks (anti-migration guard below).

## Why dead

The two `useState` slots were vestigial from an earlier `MissionCreateForm` design that distinguished between `interval`, `wall-clock`, and `post-run` schedule types. The current `SchedulePicker` is string-driven — it accepts a `value` and an `onChange` callback that updates `newSchedule` — and it derives its display state from the string itself, not from a parallel `scheduleType` discriminator. The `scheduleStartTime` slot was a sibling of the (also-removed) `scheduleType`, both initialised to a default and never touched.

The two return-object setters were exposed in case a consumer needed imperative "open this modal" control. In practice, every consumer reaches for the named `openX` / `closeX` callback pairs. Exposing the raw setters was both unused API surface and a small footgun (they could be called with arbitrary `boolean` values that bypass the intended flow).

## Files touched

| Type | Change |
|------|--------|
| Modified | `src/hooks/useMissionsPage.ts` — removed 2 `useState` declarations, 2 `formState` getter entries, 2 `setFormField` entries, 2 `setScheduleType` calls in `populateFormFromMission`, and 2 setters from the return object |
| Modified | `src/components/missions/MissionCreateForm.tsx` — removed 2 fields from the `MissionFormState` interface |
| Modified | `tests/unit/mission-composer-actions.test.tsx` — removed 2 fields from `baseFormState` mock |
| Modified | `tests/unit/mission-dispatch-gate.test.tsx` — same |
| Modified | `tests/unit/window-confirm-source-patterns-list2.test.ts` — line-number update (1100 → 1091) for the `useMissionsPage.ts` "Overwrite template?" site, because the dead-state removal shifts the file by 9 lines |
| New | `tests/unit/use-missions-page-dead-state-removal.test.ts` — source-pattern test, 19 assertions across 6 describes |

## Anti-migration guards

The source-pattern test pins 4 invariants that guard against re-introducing the dead state or over-removing the still-needed code:

- `showCategoryManager` + `showTemplateManager` **state slots** are still declared (the `useState` declarations remain — only the **setters** were removed from the return object).
- The `openCategoryManager` callback still calls `setShowCategoryManager(true)`, and the `openTemplateManager` callback still calls `setShowTemplateManager(true)` — the setters are still USED internally; they just aren't EXPOSED externally.
- `setFormField` no longer has entries for the 2 dead fields (it would crash with a `setters[field](value)` call to `undefined` otherwise).
- `populateFormFromMission` no longer calls `setScheduleType(...)` (only `setNewSchedule` remains in the schedule branch).

## Verification

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/hooks/useMissionsPage.ts src/components/missions/MissionCreateForm.tsx tests/unit/mission-composer-actions.test.tsx tests/unit/mission-dispatch-gate.test.tsx tests/unit/window-confirm-source-patterns-list2.test.ts tests/unit/use-missions-page-dead-state-removal.test.ts --max-warnings 0`: clean (0 warnings)
- `CI=true npx jest`: **334 suites / 2602 tests pass** (was 333/2583 after session 213 followup; +1 suite, +19 tests from the new source-pattern test)
- `npx --yes pnpm@10.33.0 build`: clean

## Net effect

- **+52 / -56 lines** across the 6 files.
- **2 dead useState slots removed** (saves 2 re-renders per state churn, plus simplifies the formState shape).
- **2 unused fields removed** from the public `MissionFormState` interface.
- **2 unused return-object setters removed** (less API surface for downstream consumers to misuse).
- **No external behaviour change** — the `SchedulePicker` still updates the schedule string the same way, the modals still open/close the same way, the form fields still render the same way.

## Pitfalls codified for future sessions

1. **Audit `formState` getters the same way as `useState` declarations.** When a `useState` is dead, its field is also dead in any shape that exposes it. In this case: the `MissionFormState` interface, the `formState` getter object in the hook, and 2 test `baseFormState` mock objects all had to be updated together.
2. **The `setFormField` switch table is a single point of failure.** Removing a `useState` slot without also removing its `setFormField` entry would leave an unreachable branch that crashes if ever called. The source-pattern test pins both removals as a pair.
3. **Return-object setters are often dead.** If a named `openX` / `closeX` callback pair exists, the raw setter is usually a leak. Confirm via `grep "setShow\w*\s*[,}]" src/` style queries before removing — the setter might still be called by the `openX` callback internally.
4. **Line-number pinning in source-pattern tests is brittle.** The `window-confirm-source-patterns-list2.test.ts` test had to be updated (1100 → 1091) because the dead-state removal shifted the line. In the long run, prefer `expect(source).toMatch(/.../)` with text-anchored patterns over absolute line numbers.
