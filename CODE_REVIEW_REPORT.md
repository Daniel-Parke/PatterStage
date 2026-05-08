# Control Hub — Code Review & Design Audit Report

**Branch:** `chore/code-cleanup-and-design-review`
**Date:** 2026-05-08
**Prepared by:** Bob (PatterTech CEO)

---

## Summary

This report covers three areas: (1) dead code and files removed, (2) bugs found and fixed during this review, and (3) a full UI/UX audit of every page with prioritised improvements.

---

## Part 1 — Dead Code Removed

### Deleted Files

| File | Reason |
|------|--------|
| `src/app/api/agent/route.ts` | Dead namespace route — no incoming links, no consumers |
| `src/app/api/agent/personality/route.ts` | Redundant personality guard — all logic in `agent/profiles` |
| `src/app/edition-not-available/page.tsx` | Orphaned placeholder page + empty directory |
| `src/app/edition-not-available/` | Empty directory removed |

### Deprecated

| File | Change |
|------|--------|
| `src/lib/hermes.ts` | Added `@deprecated since Control Hub v1.4` notice — routes should import from `lib/paths.ts` instead |

### Recreated

| File | Reason |
|------|--------|
| `src/lib/db.ts` | Was deleted (zero imports found), but `mission-repository.ts` imports from it. Deleted in error — recreated with full SQLite schema for missions, kanban, goals, and templates. SQL typo (`IF NOT EXISTS IF NOT EXISTS`) fixed. |

---

## Part 2 — Bugs Found & Fixed

### Bug 1 — Missions Page Build Error
**Severity:** Critical
**Cause:** `mission-repository.ts` imported from `./db` which was deleted. The `missions` page crashed at build time.
**Fix:** Recreated `src/lib/db.ts` with proper `better-sqlite3` schema. SQL typo fixed on line 96.

### Bug 2 — Cron Page "This page couldn't load"
**Severity:** High
**Cause:** Stale Next.js production server running on port 3000 from before the cleanup session. Not a code bug — server state issue.
**Fix:** Killed stale server process, restarted `npm run dev`.

### Bug 3 — SQL Syntax Error in `db.ts`
**Severity:** High
**Cause:** `CREATE TABLE IF NOT EXISTS IF NOT EXISTS templates` — duplicate `IF NOT EXISTS` clause.
**Fix:** Changed to `CREATE TABLE IF NOT EXISTS templates`.

### Bug 4 — TypeScript `esModuleInterop` Error
**Severity:** Medium
**Cause:** `@types/better-sqlite3` doesn't support default imports. `tsconfig.json` has `esModuleInterop: true` but the types package still requires namespace import.
**Fix:** Changed `import Database from "better-sqlite3"` to `import * as Database from "better-sqlite3"`.

---

## Part 3 — Broken Pages (404)

### A. `/config/hermes_md` — 404
**Severity:** High
**Issue:** Operations sidebar "HERMES.md" links to `/config/hermes_md` but no page exists at that path. `src/app/config/` only has `page.tsx`.
**Solution:** Create `src/app/config/hermes_md/page.tsx` to edit/view HERMES.md content, or change the sidebar link to point to an existing page.

### B. `/environment` → 404
**Severity:** High
**Issue:** Operations sidebar "Environment" links to `/config/env` — no page exists at that path.
**Solution:** Create `src/app/config/env/page.tsx` to display/edit environment variables, or redirect to a working URL.

### C. `/orchestration/kanban` — 404
**Severity:** Low
**Issue:** For URL consistency, Teams lives at `/orchestration/teams` but Kanban lives at `/kanban`. No redirect from `/orchestration/kanban`.
**Solution:** Either create `src/app/orchestration/kanban/page.tsx` as a redirect, or update the sidebar link to use `/kanban` directly.

### D. Missing Config Section Pages
**Severity:** Medium
**Issue:** These config section sidebar links have no corresponding page:
- `/config/streaming`
- `/config/platform_toolsets`
- `/config/smart_model_routing`
- `/config/human_delay`
- `/config/session_reset`
- `/config/checkpoints`
- `/config/code_execution`
- `/config/tts`
- `/config/stt`
- `/config/voice`
- `/config/privacy`
- `/config/approvals`
- `/config/delegation`
- `/config/skills`
- `/config/web`
- `/config/auxiliary`
- `/config/session_reset`

**Solution:** Create stub pages for each or mark as "Coming Soon" with a redirect to `/config`.

---

## Part 4 — UI/UX Design Issues

### E. Dashboard — Placeholder `...` for Stat Counters
**Severity:** Medium
**Issue:** "CRON JOBS" and "SESSIONS" show `...` instead of real counts.
**Solution:** Fetch counts from `/api/cron` and `/api/sessions` on mount and display real numbers.

### F. Dashboard — Empty States Need Visual Distinction
**Severity:** Low
**Issue:** "No sessions yet — run a mission or use Hermes chat" and "0 active agents" don't have any visual distinction between "loading", "zero results", and "error state".
**Solution:** Add distinct visual treatment — muted icons, dashed borders — for empty states vs loading states.

### G. Cron Page — Empty State Has No Card Container
**Severity:** Low
**Issue:** `EmptyState` component renders as a floating block with no border or background card, making it feel disconnected from the page layout.
**Solution:** Wrap the `EmptyState` in a `div` with `className="rounded-xl border border-white/10 p-8"` or update the `EmptyState` component to always render inside a card.

### H. Missions Page — Hardcoded Category Filter Buttons
**Severity:** Low
**Issue:** Category filter buttons are hardcoded JSX, not driven by data. Adding categories requires a code change.
**Solution:** Fetch categories from the API or drive them from a constants file.

### I. Personalities Page — Empty/Loading State Unclear
**Severity:** Medium
**Issue:** Page shows only the "HOW PERSONALITIES WORK" explainer and a search box. If no personalities exist, the user has no indication of this — the page appears broken.
**Solution:** Add an `EmptyState` component with a "Create your first personality" CTA, or show personality cards if any exist.

### J. Logs Page — Horizontal Truncation
**Severity:** Low
**Issue:** Long log lines are truncated at the viewport edge with no horizontal scroll.
**Solution:** Wrap log content in a scrollable container with `overflow-x-auto`.

### K. Config Index — Unequal Card Row Heights
**Severity:** Low
**Issue:** Cards have varying label lengths causing row misalignment in the 3-column grid.
**Solution:** Set a fixed minimum card height, or use CSS grid `grid-auto-rows: 1fr`.

### L. Sidebar — Icon Reuse
**Severity:** Low
**Issue:** `Users` icon used for both "Agents" and "Teams". Should be distinct.
**Solution:** Use `Bot` or `Cpu` for Agents, `Users` for Teams.

### M. Config Page — `streaming` Section Missing from Sidebar Map
**Severity:** Low
**Issue:** `src/app/config/page.tsx` CATEGORIES doesn't include `streaming`, but the sidebar config groups have it.
**Solution:** Add `streaming` to the Integrations category sectionIds.

### N. Page Header — Inconsistent Presence
**Severity:** Low
**Issue:** Some pages (Dashboard, Missions, Cron) have a `PageHeader` with actions. Others (Sessions, Tools, Skills) render inline headers or no header at all.
**Solution:** Standardise on `PageHeader` for all major pages for visual consistency.

### O. Spacing Inconsistencies
**Severity:** Low
**Issue:** Padding on page content varies: `px-6 py-6` on some pages, no explicit padding on others, `px-4` on others. Creates visual inconsistency.
**Solution:** Establish a standard page content wrapper class and use it consistently.

### P. Color Consistency — `bg-dark-900/50`
**Severity:** Low
**Issue:** The `bg-dark-900/50` opacity is used throughout for card backgrounds. At 50% opacity the darkness varies visually depending on what's behind it. Some places use `bg-dark-950` directly.
**Solution:** Choose one consistent approach — prefer `bg-dark-900` (solid) or a fixed opacity like `bg-dark-900/80` — and standardise.

### Q. Toast Notifications — No Stacking
**Severity:** Low
**Issue:** The `useToast` hook renders a single toast. Rapid actions trigger multiple toasts that overwrite each other.
**Solution:** Implement toast stacking with `z-index` and unique IDs.

---

## Part 5 — Code Quality Issues

### R. Unused `error` Variable in Cron Page
**Severity:** Low
**Issue:** `const { data, loading, error, refetch: loadJobs }` — `error` is destructured but never rendered. ESLint disable comment suppresses the warning.
**Solution:** Either render `<ErrorBanner message={error} />` when `error` is set, or remove `error` from the destructuring.

### S. No Error Boundaries on Client Pages
**Severity:** Medium
**Issue:** Pages like Cron, Missions, and Memory crash with Next.js's generic "This page couldn't load" when a fetch fails, rather than a graceful in-app error state.
**Solution:** Create a `ClientPageErrorBoundary` component wrapping page content on all data-driven pages.

### T. Schema Migration Strategy Missing
**Severity:** Medium
**Issue:** `db.ts` calls `initSchema` on every startup with `CREATE TABLE IF NOT EXISTS`. If a schema change is needed (adding a column, etc.), existing tables aren't updated.
**Solution:** Add a lightweight migration system — a `migrations/` directory with numbered SQL scripts, tracked in a `schema_version` table.

### U. Kanban API — No Request Validation
**Severity:** Low
**Issue:** `src/app/api/kanban/route.ts` accepts raw body fields without Zod validation (unlike cron and missions routes which use `cronPostBodySchema`).
**Solution:** Add `kanbanPostBodySchema` / `kanbanPutBodySchema` validation to the kanban route handlers.

### V. Missing `ApiResponse<T>` on Some Routes
**Severity:** Low
**Issue:** Some routes return `{ data: ... }` directly while others return `{ error: "..." }`. No consistent envelope.
**Solution:** Audit all API routes to use `ApiResponse<T>` from `@/types/hermes` consistently.

### W. `src/lib/backends/hermes.ts` — `configureTool` is a No-Op
**Severity:** Low
**Issue:** `configureTool` logs an error and returns — it's not implemented. If a user toggles a tool in the UI, nothing happens.
**Solution:** Either implement it properly or show a "Coming Soon" badge in the Tools UI until it's ready.

---

## Recommended Priority Order

1. **Create missing config pages** (`hermes_md`, `env`, `streaming`, etc.) — users clicking sidebar links will hit 404s
2. **Fix cron page `error` variable** — suppressed lint warning, should render or be removed
3. **Add error boundaries** to all data-fetching pages
4. **Create migration system** for `db.ts` to handle schema evolution
5. **Fix dashboard stat counters** — replace `...` with real API data
6. **Standardise page header** across all pages
7. **Fix toast stacking** — multiple actions should not overwrite toasts
8. **Implement `configureTool`** or disable the toggle in the Tools UI
9. **Add Zod validation to kanban route**
10. **Fix sidebar icon reuse**

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/lib/hermes.ts` | Added `@deprecated` notice |
| `src/lib/db.ts` | Recreated (was deleted); fixed SQL typo; fixed import style |
| `src/app/api/agent/route.ts` | Deleted |
| `src/app/api/agent/personality/route.ts` | Deleted |
| `src/app/edition-not-available/page.tsx` | Deleted |
| `src/app/edition-not-available/` | Directory deleted |
