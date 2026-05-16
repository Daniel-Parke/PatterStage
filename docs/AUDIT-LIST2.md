# Audit: List 2 — Cron, Missions, Kanban, Teams

**Date:** 2026-05-16  
**Inspecting:** `feature/hermes-overnight-refactor` (post-arch restructure)

## Summary

| Area | Files | Total Size | Issues Found |
|------|-------|-----------|--------------|
| Missions | 1 page + 1 API + 2 libs | ~130KB | 7 major |
| Cron | 1 page + 1 API + 1 lib | ~86KB | 5 major |
| Kanban | 1 page + 1 API + 2 libs | ~69KB | 4 major |
| Teams | 1 page + 1 API + 1 lib | ~30KB | 3 major |

---

## Findings

### F1 — Duplicated `apiFetch` helper

**Files:** `kanban/page.tsx` (lines 31-41), `teams/page.tsx` (lines 27-37)  
**Problem:** Identical `async function apiFetch()` defined in two pages.  
**Fix:** Extract to `src/lib/api-fetch.ts` and import in both places.

### F2 — Duplicated `formatSchedule` on Cron page

**File:** `cron/page.tsx` (lines 61-147)  
**Problem:** 87-line `formatSchedule()` function duplicates logic from `parseSchedule` (lib/schedule/parse-schedule.ts) which already parses cron expressions and returns display strings.  
**Fix:** Remove inline function, use `parseSchedule(schedule).display` or `parseSchedule(schedule).kind`.

### F3 — Hardcoded profile list in Cron modals

**File:** `cron/page.tsx` (lines 467-480, 632-642)  
**Problem:** EditJobModal and CreateJobModal both contain a hardcoded `<select>` with profile options ("Bob (default)", "swe", "qa", etc.) instead of using the `ProfileSelector` component used elsewhere.  
**Fix:** Replace with `ProfileSelector` component.

### F4 — Missions page is 92KB / 2266 lines

**File:** `missions/page.tsx`  
**Problem:** Single monolithic file with:
- 30+ state variables
- 3 inline modals (Template Manager, Template Editor, full create/edit form)
- Complex prompt building/splitting logic (~50 lines of regex)
- Duplicated raw fetch calls mixed with useMissionsApi hook
- Stats row (40 lines of repeated card JSX)
- IIFE in JSX for category filter buttons
- handleCreate is 150+ lines handling create/update/re-dispatch  
**Fix:** Extract inline modals to components, extract reusable sections.

### F5 — Empty orchestration layout

**File:** `orchestration/layout.tsx`  
**Problem:** Layout is just `{children}` with no shared navigation between cron/missions/kanban/teams.  
**Fix:** Add sub-navigation so users can switch between orchestration pages. Already partially addressed by PageHeader `backHref` props.

### F6 — Duplicated error/saving patterns in Cron page

**File:** `cron/page.tsx`  
**Problem:** EditJobModal and CreateJobModal both handle `error` state, `saving` state, and `onSubmit` with near-identical patterns. Hardware cron handlers (handleHardwareToggle, handleHardwareDelete, etc.) mirror agent cron handlers with identical try/catch blocks.  
**Fix:** Extract shared handler patterns, create reusable `useCronApi` hook.

### F7 — confirm() dialogs for destructive actions

**Files:** `teams/page.tsx` (line 261), `kanban/page.tsx` (line 373)  
**Problem:** Uses browser `confirm()` for delete confirmation instead of a proper UI dialog.  
**Fix:** Use Modal component or add a local confirm dialog.

### F8 — Kanban page inline polling

**File:** `kanban/page.tsx` (lines 165-210)  
**Problem:** Goal session polling (`setInterval` every 15s) is embedded in the main page component.  
**Fix:** Extract to a `useGoalPolling` custom hook.

### F9 — Missions page: inline stats cards

**File:** `missions/page.tsx` (lines 982-1014)  
**Problem:** 4 stat cards (Total, Active, Completed, Failed) are repeated with near-identical JSX.  
**Fix:** Create a simple `StatCard` component or map over an array.

### F10 — Missions page: inline category filter generation

**File:** `missions/page.tsx` (lines 1044-1074)  
**Problem:** Category filter buttons are generated inside an IIFE in JSX.  
**Fix:** Extract to a named function or useMemo.

---

## Implementation Plan

### Phase 1: Shared utilities (no behavior changes)
1. Create `src/lib/api-fetch.ts` — extract duplicated `apiFetch`
2. Fix `formatSchedule` on cron page — use parseSchedule
3. Create `src/hooks/useGoalPolling.ts` — extract kanban polling

### Phase 2: Extract inline modals to components
4. Create `components/teams/CreateTeamModal.tsx`
5. Replace hardcoded profile selects in cron with ProfileSelector
6. Break up missions page (extract components)

### Phase 3: Consolidation passes
7. Missions: stats row → mapped array
8. Missions: category filters → useMemo
9. Clean up any remaining raw fetch calls
10. Run tests to verify nothing broke
