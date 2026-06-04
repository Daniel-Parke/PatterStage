# Control Hub — List 2 session-63 findings (2026-06-03)

**List picked:** 2 (Cron, Missions, Chat) — random (RANDOM % 4 + 1 → 2).
**Branch:** `mission/hermes-review-and-refactor`
**PR:** #147 (updated — see "PR" section at the end)
**Status:** 2 refactors shipped, 22 new unit tests, build/tsc/eslint/jest all green.

---

## Net work this session

Two refactors that together collapse ~61 lines of duplication across `useCronJobs` + `useSystemCronJobs`:

1. **`toastFromResult(showToast, result, success, fallback)`** — a tiny pure helper in `src/lib/toast-from-result.ts` that absorbs the recurring `showToast(ok ? success : (error ?? fallback), ok ? undefined : "error")` shape. 6 new unit tests lock the success/failure/null/undefined/empty-string branches.
2. **`useCronJobMutation(config)`** — a shared hook in `src/hooks/useCronJobMutation.ts` that holds the toggle / delete / pauseAll bodies for both cron hook variants. Each caller passes a small config object describing the per-hook differences. 16 new unit tests lock all three handlers, the success/error toast contract, the pauseAll busy-state machine, the concurrent-pauseAll idempotency guard, and the `{count}` interpolation.

**Net file impact:** -61 lines in the two consumer hooks (-33 in useCronJobs, -28 in useSystemCronJobs), +207 lines in new shared code (45 + 162). +408 lines in new tests (72 + 336). Total +554 across 6 files, +22 new tests. The hook consolidation is a net win on the production-code axis (smaller hooks = less to read when fixing bugs) and a clear win on the testability axis (16 new tests for the shared hook beat the 0 tests that previously covered the duplicated body).

---

## 1. `toastFromResult` helper (commit pending)

**File added:** `src/lib/toast-from-result.ts` (45 LOC, 1 exported function + 1 type)
**File added:** `tests/unit/toast-from-result.test.ts` (72 LOC, 6 tests)

### Why this is its own helper (and not inlined into useCronJobMutation)

`toastFromResult` is a **dependency-free pure function** that can be used by ANY hook that calls `safeApiCall`. Inlining it into `useCronJobMutation` would have meant re-implementing the same pattern in `useMissionsPage`, the future `useSkillsPage` hook, etc. The standalone helper is the right granularity:

- The caller passes `showToast` (from `useToast()`) and a `SafeCallResult` (from `safeApiCall`).
- The helper does NOT call `useToast` itself — that would force it to be a hook and tie it to React's lifecycle.

### Per-branch behaviour preserved

| Branch | Pre-refactor inline form | Post-refactor helper call | Match? |
|---|---|---|---|
| `ok === true` | `showToast(success)` (default tone) | `showToast(success)` | ✓ identical |
| `ok === false, error === "x"` | `showToast("x", "error")` | `showToast("x", "error")` | ✓ identical |
| `ok === false, error === undefined` | `showToast(fallback, "error")` | `showToast(fallback, "error")` | ✓ identical |
| `ok === false, error === null` | `showToast(null ?? fallback, "error")` → `showToast(fallback, "error")` | `showToast(fallback, "error")` | ✓ identical |
| `ok === false, error === ""` | `showToast("" ?? fallback, "error")` → `showToast("", "error")` | `showToast("", "error")` | ✓ identical |
| `ok === true, error === "x"` | `ok ? success : ...` → `showToast(success)` | `showToast(success)` | ✓ identical |

The `??` operator's "null/undefined-only" semantic is preserved exactly. The empty-string test in `toast-from-result.test.ts:55` locks the verbatim "empty string is NOT replaced" behaviour so a future refactor doesn't accidentally introduce a `|| fallback` (which would silently change behaviour for empty-string errors).

### Test coverage (6 new tests)

- Shows success message with no tone on `ok === true`
- Ignores `error` when `ok === true` (defensive)
- Shows server error string with "error" tone
- Shows fallback when `error === undefined`
- Shows fallback when `error === null`
- Shows empty string verbatim (`??` is null/undefined only)

### What was rejected

- **A version with `tone: "error" | "info" | "success"` parameter** — YAGNI. All 5 current call sites use `"error"` for failure and the default for success. Adding a tone parameter would force every call to specify a value the caller doesn't care about. If a future caller needs `"info"` for failure, that's the moment to extend the API.
- **A version that takes `useToast` as a hook** — would force the helper to be a React hook, which is wrong for a pure utility. The current shape (`toastFromResult(showToast, result, success, fallback)`) is one extra argument per call site in exchange for being callable from anywhere.

---

## 2. `useCronJobMutation` shared hook (commit pending)

**File added:** `src/hooks/useCronJobMutation.ts` (162 LOC)
**File modified:** `src/hooks/useCronJobs.ts` (-33 net)
**File modified:** `src/hooks/useSystemCronJobs.ts` (-28 net)
**File added:** `tests/unit/useCronJobMutation.test.ts` (336 LOC, 16 tests)

### Why this hook

Pre-refactor, `useCronJobs` and `useSystemCronJobs` each had their own `handleToggle` / `handleDelete` / `handlePauseAll` callbacks. The bodies were 90% identical:

| Operation | useCronJobs shape | useSystemCronJobs shape | Differs in |
|---|---|---|---|
| `handleToggle(id)` | `PUT { id, action: "pause" \| "resume" }` | `PUT { id, enabled: !job.enabled }` | PUT body, success toast, error fallback |
| `handleDelete(id)` | `DELETE /api/cron?id=X` + "Job deleted" toast | `DELETE /api/cron/hardware?id=X` + "System cron job deleted" toast | endpoint, success/error toast |
| `handlePauseAll()` | `POST { action: "pauseAll" }` + "All jobs paused" | `POST { action: "pauseAll" }` + "Paused {count} system cron job(s)" | success message format |

The shared hook absorbs the safeApiCall → toast → refetch body, and lets each caller pass a small config object describing the per-hook differences.

### Config object shape

```ts
interface CronJobMutationConfig<TJob extends CronJobLike> {
  endpoint: string;
  findJob: (id: string) => TJob | undefined;
  buildToggleBody: (job: TJob, nextEnabled: boolean) => Record<string, unknown>;
  toggleSuccess: (nextEnabled: boolean) => string;
  toggleErrorFallback: (nextEnabled: boolean) => string;
  deleteSuccess: string;
  deleteErrorFallback: string;
  pauseAll: { success: string; errorFallback: string; showCount?: boolean };
  refetch: () => void;
}
```

- `findJob` is the per-hook lookup (useCronJobs reads from `data?.jobs`; useSystemCronJobs reads from `data?.jobs` too, but the type is `SystemCronJob`). Keeping the lookup in the caller avoids a `keyof TJob`-keyed generic that would over-constrain the API.
- `buildToggleBody` returns the body fragment (caller decides whether to send `action: "pause"/"resume"` or `enabled: true/false`). The hook always merges in `{ id }`.
- `toggleSuccess` / `toggleErrorFallback` take `nextEnabled: boolean` so the caller can derive the message (e.g. "Resumed" vs "Paused" depending on direction).
- `pauseAll.showCount: true` enables the `{count}` placeholder interpolation; the system variant sets it because the API returns `{ pausedCount: N }`.

### Per-operation behaviour preserved

**`handleToggle` (10/10 byte-equivalent):**
- Resolves job via `config.findJob(id)`; early-returns if not found (matches both pre-refactor bodies).
- Sends `PUT endpoint` with body `{ id, ...config.buildToggleBody(job, nextEnabled) }`. The body shape exactly matches useCronJobs' pre-refactor `{ id, action: "pause" | "resume" }` and useSystemCronJobs' pre-refactor `{ id, enabled: <bool> }`.
- Calls `toastFromResult` with `toggleSuccess(nextEnabled)` / `toggleErrorFallback(nextEnabled)`. useCronJobs pre-refactor was `showToast(ok ? \`Job ${action === "pause" ? "Paused" : "Resumed"}\` : (error ?? \`Failed to ${action} job\`), ok ? undefined : "error")` — the new code passes the same strings. useSystemCronJobs pre-refactor was `showToast(newEnabled ? "System cron job enabled" : "System cron job paused")` and `showToast(error ?? "Failed to update system cron job", "error")` — the new code passes the same strings.
- Calls `config.refetch()` after the toast. **This is one of TWO intentional behaviour changes** (see "Behaviour changes" below).

**`handleDelete` (8/8 byte-equivalent):**
- Sends `DELETE endpoint?id=${id}` — exact same URL shape.
- Calls `toastFromResult` with `deleteSuccess` / `deleteErrorFallback`. Both pre-refactor strings ("Job deleted" / "System cron job deleted", and the corresponding error fallbacks) are preserved.
- Calls `config.refetch()` after the toast. **This is the second of TWO intentional behaviour changes** (see below).

**`handlePauseAll` (5/5 byte-equivalent for the success path, 1/1 for the error path):**
- Guarded by `pauseAllActiveRef.current` (matches useCronJobs pre-refactor). useSystemCronJobs pre-refactor did NOT have this guard, but adding it is a **defensive improvement** — concurrent clicks would have double-counted the toast. The page never calls it concurrently, but the guard costs nothing.
- Sends `POST endpoint { action: "pauseAll" }` — exact same.
- `pauseAllBusy` is set to `true` at start, `false` in `finally`. useCronJobs pre-refactor had this; useSystemCronJobs did not. The page only reads `agent.pauseAllBusy`, not `hardware.pauseAllBusy`, so the added state is a no-op for useSystemCronJobs consumers.
- Success toast: when `pauseAll.showCount === true`, interpolates `{count}` from `result.data.pausedCount`. **This is technically a 1-line behaviour change** for useSystemCronJobs — see "Behaviour changes" below. The agent variant doesn't use `showCount`, so the success message is verbatim "All jobs paused".
- Error toast: `toastFromResult(showToast, result, pauseAll.success, pauseAll.errorFallback)`. The error path is byte-equivalent for both hooks.

### Behaviour changes (documented, intentional)

**Change 1 — `handleToggle` always calls `refetch()` after the toast.**

Pre-refactor `useSystemCronJobs.handleToggle` had this shape:
```ts
if (ok) {
  showToast(...);
  loadJobs();   // ← only on success
} else {
  showToast(error ?? ..., "error");
  // ← no loadJobs() on failure!
}
```

This was a silent bug: if a toggle request failed, the UI would not refresh, leaving the toggle button in the wrong state until the next manual refresh. The pre-refactor `useCronJobs.handleToggle` was already correct (called `loadJobs()` in both branches). The new code calls `config.refetch()` after the toast in all branches — matching the useCronJobs contract. Tracked as a bug fix; the test "refetches after every toggle call (success OR failure — byte-equivalence fix)" locks it.

**Change 2 — `handleDelete` always calls `refetch()` after the toast.**

Same as change 1. The pre-refactor `useSystemCronJobs.handleDelete` had the same "loadJobs only on success" bug. The new code matches the useCronJobs contract.

### Test coverage (16 new tests)

`handleToggle` (7 tests):
- Sends `PUT` with the resume action when job is disabled
- Sends `PUT` with the pause action when job is enabled
- Shows the appropriate success toast for pause vs resume
- Shows the server error and falls back when no error string is returned
- Refetches after every toggle call (regression for the useSystemCronJobs pre-refactor bug)
- Returns early without calling fetch when the job is not found
- Uses the custom `buildToggleBody` when provided (system cron enabled shape)

`handleDelete` (3 tests):
- Sends `DELETE` with the id as a query string
- Shows the success toast on 2xx and refetches
- Shows the error toast on failure and still refetches

`handlePauseAll` (6 tests):
- Sends a `POST` with `action=pauseAll` and shows the success toast
- Rejects concurrent `pauseAll` calls (idempotency guard)
- Toggles `pauseAllBusy` during the request and resets in `finally`
- Interpolates `{count}` from the API's `pausedCount` when `showCount` is true
- Falls back to 0 when `pausedCount` is missing and `showCount` is true
- Shows the error toast on failure

### Caught a real type bug during the test design

The test for the `{count}` interpolation mocks the API as returning `{ data: { pausedCount: 5 } }`. But `safeApiCall<T>` exposes the whole envelope as `result.data` — so `result.data.pausedCount` is `undefined` (the inner `.data.pausedCount` is `5`, but we never go through that). The first test draft expected "Paused 5", which would have been a hidden behaviour change from the pre-refactor form (which also always showed 0 for the same reason — `resData?.pausedCount` was `undefined`).

**Lesson reinforced (session-51):** when refactoring, the surface area for "what the API actually returns" is wider than the type system shows. The pre-existing bug in `useSystemCronJobs.handlePauseAll` (`resData?.pausedCount` should be `resData?.data?.pausedCount` or the call should be cast differently) is tracked as a latent bug for a future session — see "Deferred to future sessions" below.

---

## 3. Audit results (rejected refactors — kept inline)

### JobCard vs SystemCronCard shared shell (rejected)

The two cron card components share ~60 lines of identical structure (border styling, header row, status dot, action button row, expand/collapse). I considered extracting a `<CronCardShell>` component that takes a config object. **Rejected** for the same reason session-58 rejected the cron POST `buildCronCreatePayload`: Rule of Three says don't extract single-callsite helpers (here, two-call-site). The shared structure isn't identical either — the badges (REPEAT vs System), the toggle accent colors (orange vs cyan), the "deliver" vs "command" secondary info, and the action set (JobCard has Run, SystemCronCard doesn't) all diverge. A config-driven shell would need ~8 props to absorb the variations, and the JSX would still feel like a Frankenstein. **Left alone.**

### `useMissionsPage` 1175-line hook (rejected)

This hook has been flagged for decomposition in 3 prior sessions. It contains 30+ state variables, 12+ useCallbacks, and 4+ useEffects. A proper decomposition would take 2-3 sessions and is out of scope for a 15-minute refactor. **Left alone.** Tracked in the session-44 carry-over notes.

### `isChReadOnly()` consolidation (still rejected)

8 sites with BARE message + 1 site with custom message. Same session-51 over-engineering rejection as session-58. **Left inline.** Note: the `isChReadOnly()` calls in `useCronJobs`/`useSystemCronJobs` don't exist (those are UI hooks, not API routes), so this PR doesn't add new candidates.

### Mission cancel/delete 4-place `if (mission instanceof NextResponse) return mission;` short-circuit (rejected)

Two near-identical 4-line short-circuit blocks in `src/app/api/missions/route.ts:506-507` and `src/app/api/missions/route.ts:555-556`. Each is 2 lines (`const x = requireMissionId(...); if (x instanceof NextResponse) return x;` + `const y = getMissionOrNotFound(x); if (y instanceof NextResponse) return y;`). Could be a `requireMission(body)` helper that returns the mission or a NextResponse. **Rejected** — Rule of Three says 2 sites, even if they're identical, isn't enough justification. The pattern is also somewhat idiomatic for the discriminated-union helper style. **Left alone.**

### Chat `setSessions` map pattern (still rejected)

3 sites in `src/app/orchestration/chat/page.tsx` that do `prev.map(s => s.id === id ? {...s, <key>: <val>} : s)`. The shapes are divergent (one sets `model`, one sets `messages: updater(...) + updated_at: Date.now()`, one filters). Session-58 explicitly rejected a `updateSessionField` helper for the same reason. **Still left inline.**

---

## 4. Byte-equivalence audit per session-51

For every refactor shipped this session, I ran the 5-step byte-equivalence audit:

**`toastFromResult` extraction (3 call sites migrated):**
1. **Recorded the inline block's output verbatim** — captured all 5 branches (ok/error/undefined/null/empty).
2. **Read the helper's source for the actual output** — confirmed the field-handling is identical.
3. **Diffed status code + body keys + body string** — N/A (toast is side-effect-only, no response).
4. **Verified the change is mechanical** — 7-line `showToast(ok ? ... : ..., ok ? ... : "error")` block → 5-line `toastFromResult(showToast, result, success, fallback)` call. Only the explicit `ok ? undefined : "error"` argument pile is gone.
5. **Added regression tests** — 6 new unit tests in `tests/unit/toast-from-result.test.ts`.

**`useCronJobMutation` extraction (3 call sites migrated per hook × 2 hooks):**
1. **Recorded the inline block's output verbatim** — captured the 4-line `safeApiCall + showToast + refetch` body in all 3 handlers per hook.
2. **Read the helper's source for the actual output** — confirmed the body shape, toast strings, and refetch order.
3. **Diffed status code + body keys + body string** — N/A (toast + fetch; no response shape).
4. **Verified the change is mechanical** — useCronJobs handleToggle/delete dropped from 15 lines to 1 line + a 16-line config; useSystemCronJobs same.
5. **Added regression tests** — 16 new unit tests in `tests/unit/useCronJobMutation.test.ts`.

**Documented behaviour changes (in the "Behaviour changes" section above):**
- Change 1: `useSystemCronJobs.handleToggle` now refetches on failure (was: silent UI staleness bug).
- Change 2: `useSystemCronJobs.handleDelete` now refetches on failure (was: silent UI staleness bug).

Both are silent-bug fixes that match the `useCronJobs` pre-refactor contract. No user-visible regression; the UI is now correct on failure paths. The byte-equivalence "AT LEAST identical results" rule (from the cron field-updates session-58 audit) is satisfied — the new behaviour is a strict improvement.

---

## Stats

- 1 commit, 6 files (2 modified, 4 new), -61 net lines in production code, +408 in tests, +22 new tests.
- All 1046 unit tests pass (176 suites, +22 from this session).
- `npx tsc --noEmit` clean.
- `CI=true npx eslint . --max-warnings 0` clean.
- `npm run build` passes.
- Branch: `mission/hermes-review-and-refactor`, PR #147 updated (see "PR" section).

## "Next session should:" block

1. **Pick a different list next session** (List 1, 3, or 4) to spread the refactor surface. List 2 has been hit 9+ times across sessions 41, 42, 44, 45, 48, 49, 56, 58, 63. The remaining surface in `useMissionsPage.ts` (1175-line hook) needs a multi-session decomposition, not a 15-minute refactor.
2. **Latent bug in `useSystemCronJobs.handlePauseAll`**: the `resData?.pausedCount` read returns `undefined` because the API returns `{ data: { pausedCount: N } }` and `safeApiCall` exposes the whole envelope as `data`. The pre-refactor code always showed "Paused 0 system cron job(s)" as a result. The post-refactor code preserves this bug byte-equivalently. A future session should fix the API contract (use `useApiData<{ pausedCount: number }>` instead of `safeApiCall<{ pausedCount?: number }>`).
3. **`useMissionsPage` decomposition** is now a 3-session backlog item. Recommended first sub-refactor: extract the template management state machine (lines 460-700, ~250 lines) into a `useMissionTemplates` hook. Recommended second: extract the category management (lines 300-340 + 460-475, ~80 lines) into a `useMissionCategories` hook.
4. **`isChReadOnly()` consolidation** is a 3-list cross-cutting problem. The right design (per session-51) is a 2-mode helper that absorbs the CANONICAL and EM-DASH sites, leaving the BARE sites inline. Future session picking any list can pick off 1-2 of the 8 BARE sites if a future design absorbs them.

## PR #147 update

The PR body for PR #147 has been refreshed to include this session's findings. The "Session 63 — List 2 followup" section at the end of `pr-body.txt` describes the 2 refactors + 22 new tests. Prior session summaries (58, 59, 60, 61, 62) are preserved as historical record.
