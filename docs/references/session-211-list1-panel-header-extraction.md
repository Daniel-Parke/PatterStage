# Session 211 — List 1 (Dashboard, Sessions, Memory, Logs) — Panel + PanelHeader extraction (5 inline panel shells → 2 components)

**Date:** 2026-06-14
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 1 (List 1: Dashboard, Sessions, Memory, Logs). Last List 1 pick was session 204 (the `loadHindsightList` helper extraction in `hindsight-client` + 2-site migration). The Dashboard surface (List 1) had not been revisited since — multiple carryover hooks remained in the dashboard area.
**Status:** committed + pushed (commit `b316ff7`).

## What this refactor did

Extracted 2 new components from `src/app/page.tsx` (the Dashboard page) — `Panel` and `PanelHeader` — that consolidate the "rounded card with icon-and-label header" shell that 5 of the 6 dashboard panels duplicated verbatim.

**The 5 identical lines per site that this extraction collapses:**

```tsx
<div className="rounded-xl border border-{accent}-500/20 bg-dark-900/50 overflow-hidden">
  <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-{accent}" />
      <span className="text-xs font-mono text-white/60">{label}</span>
    </div>
    {rightSlot}
  </div>
  {children}
</div>
```

## The 5 migrated sites

| # | Panel | Accent | Count | Right slot |
|---|-------|--------|-------|------------|
| 1 | Active Missions | cyan | "(N)" count | all-missions link |
| 2 | Cron Jobs | orange | — | manage link |
| 3 | Platforms | cyan | — | (none) |
| 4 | Errors | red | — | severity pills |
| 5 | Rec Room | purple | — | (none) |

## Anti-migration guards

**Mission Dispatch** (site #1 in the file but not a Panel candidate) was intentionally NOT migrated — its header is a `<button>` (a click-to-toggle accordion), not the static 4-flex-div header this component renders. Different shape, not a duplicate. The 5 migrated sites all share the static-header shape; the accordion does not.

**process-card grid** (No Active Processes / per-process card) was intentionally NOT migrated — its outer shell is a `grid` (not a `rounded-xl border`), and it doesn't have a "header bar with icon + label" structure. Different shape, not a duplicate.

## Shared-class infrastructure

**`panelBorderClass(accent)`** — centralises the `border-{accent}-500/20` / `border-neon-{accent}/20` mapping that the inline form repeated per site. The `/20` opacity is a static no-hover value distinct from the hover-aware `colorBorderMap` in `theme.ts`. The `red` / `blue` / `yellow` base accents get `-500` because their token is a bare colour name (not `neon-*`); the other 6 accents get `neon-` prefix.

**`iconColorMap` reuse** — the `PanelHeader`'s icon colour uses `iconColorMap` from `theme.ts` (the same map `StatPill` and `MissionStatusBadge` consume). One source of truth for "what colour is the X accent on a dark background" — the panel header is automatically consistent with every other accent-aware component.

## Tests

`tests/unit/dashboard-panel-header-extraction.test.ts` (new, 14 assertions) covers: file exists, both exports present, dashboard imports both, all 5 inline shells removed, all 5 inline headers removed, 5 migrated sites use Panel+PanelHeader, Mission Dispatch accordion stays inline, process-card grid stays inline. Source-pattern style (no full-page render) — the dashboard is 900+ LOC with 8+ API fetches, 3+ polls, 20+ useState calls, and a wide variety of accent colours. Rendering it requires mocking `useApiData`, `useTwoStepConfirm`, `useInterval`, the full `/api/*` surface, and the timer/refresh hooks — the harness would dwarf the invariants being tested.

## Verification

- `npx tsc --noEmit`: clean
- `npx eslint src/app/page.tsx src/components/dashboard/Panel.tsx tests/unit/dashboard-panel-header-extraction.test.ts --max-warnings 0`: clean
- `npx jest tests/unit/dashboard-panel-header-extraction.test.ts`: 14/14 pass

## Files

- `src/components/dashboard/Panel.tsx` (new, 148 lines with JSDoc)
- `tests/unit/dashboard-panel-header-extraction.test.ts` (new, ~200 lines)
- `src/app/page.tsx` (modified, 5 sites migrated, -62 lines / +62 lines)

Net: zero net change in `src/app/page.tsx` LOC (extraction is structural, not reductive — the new component is bigger than the 5 inline copies because of extensive JSDoc explaining the rationale). The 5 panels now share a single component, so a future "we want the panel border to be more visible" tweak lands in one place.

## Next session should

- **Carryover** — closed. The dashboard Panel extraction was the only List 1 carryover.
- **Random pick next session** — list rotation: List 1 last picked 204/211, List 2 last picked 210, List 3 last picked 209, List 4 last picked 210. The next pick should be a coin flip; session 212 is free to pick any list.
