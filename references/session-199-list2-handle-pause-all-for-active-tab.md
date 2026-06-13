# Session 199 — List 2 — `handlePauseAllForActiveTab` page-local useCallback extraction in `cron/page.tsx`

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 2 (List 2: Cron, Missions, Chat).
**Status:** committed + pushed as `ade9bfe`.

## What this refactor did

Extracted the inline 6-line arrow function in the `ActionButtons` `onPauseAll` prop into a single `handlePauseAllForActiveTab` page-local `useCallback`. The `ActionButtons` `onPauseAll` prop collapsed from 6 lines to 1 line.

## The pattern: "symmetric tab-dispatch callback" (Rule of Two, not Rule of Three)

The pre-existing `openCreateForActiveTab` helper was extracted in a prior session — a 2-branch tab-dispatch callback for the "open create modal" direction. The natural symmetric extension is the "pause all" callback (also a 2-branch tab-dispatch for the "action" direction).

The Rule of Three (3+ sites) does NOT apply here — the discriminator lives at 1 site (the `ActionButtons` prop), and a future second call site (e.g., a keyboard shortcut, a confirm dialog button) would benefit from the same helper.

### The discriminator

If you see an inline `if (activeTab === "X") { void A.method(); } else { void B.method(); }` and there's a sister `if (activeTab === "X") { setA(...); } else { setB(...); }` that's already been extracted, the 1-site is worth promoting.

### When to use this pattern

- **YES**: a page with a `activeTab` state variable that branches between 2 sub-tabs, AND there are 2+ "do X for the active tab" callbacks (one is a state-setter, one is a method-invocation, etc.) that share the same discriminator.
- **NO**: a single "do X for the active tab" callback without a symmetric counterpart — the Rule of One applies (extract on the 2nd site, not the 1st).

## The byte-equivalence argument

The helper body is literally `if (activeTab === "agent") { void agent.handlePauseAll(); } else { void hardware.handlePauseAll(); }` — the EXACT same 2-branch discriminator with the EXACT same 2 `void` returns as the pre-session inline form. The `ActionButtons` `onPauseAll` prop receives the EXACT same callback (the `useCallback` is stable as long as `activeTab`, `agent`, `hardware` are stable).

## What this session did NOT do (anti-migration guards)

- Did NOT migrate the 3 render-output ternaries at lines 391-393 (`color={activeTab === "agent" ? "orange" : "cyan"}` + `pauseBusy={activeTab === "agent" ? agent.pauseAllBusy : false}` + `hasJobs={activeTab === "agent" ? !!agent.data?.total : hardwareTotal > 0}`). Those branch on DIFFERENT per-tab values, not on action dispatch — extracting them as a single `activeTabConfig` object is a more invasive refactor and is out of scope.
- Did NOT migrate the tab-conditional JSX root at line 411 (the `activeTab === "agent" ? <AgentTab /> : <SystemTab />` ternary). That branches on render output (which sub-component to render), not on action dispatch.
- Did NOT extract a sister `handleRunForActiveTab` or `handleDeleteForActiveTab` — those are passed as inline `(id) => agent.handleX(id)` arrows to the `CronTabContent` props (one per tab), so the tab-dispatch is already implicit in the per-tab JSX block.

## Sister relationships

- **Session 199 ↔ `openCreateForActiveTab` (session ~100, prior)**: the symmetric 2-branch tab-dispatch for "open create modal" direction.
- **Session 199 ↔ session 196's close-callback extractions (List 4)**: same Rule of Two reasoning, different surface (List 4 had close-callbacks for modal dismissal; List 2 has tab-dispatch for action invocation).
- **Session 199 ↔ session 197's `prependAndActivateSession` (List 2 chat)**: sister in being a 2-setter `useCallback` extraction in a page file. Different discriminator shape (session 197 was a 2-setter sequence; session 199 is a 2-branch dispatch).

## Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint src/app/orchestration/cron/page.tsx tests/unit/handle-pause-all-for-active-tab.test.ts --max-warnings 0`: clean
- `CI=true npx jest tests/unit/handle-pause-all-for-active-tab.test.ts`: 5/5 pass
- Full `CI=true npx jest` sweep: 318 suites / 2376 tests pass (up from 317/2371 = +1 suite, +5 tests)
- `CI=true npx --yes pnpm@10.33.0 build`: clean
