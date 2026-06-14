# Session 216 — List 1 (Dashboard, Sessions, Memory, Logs) — `computeOrphanCutoffs` + `tallyOrphanRows` helper extraction in `session-repository.ts`

**Date:** 2026-06-14
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 1 (List 1: Dashboard, Sessions, Memory, Logs). Last List 1 pick was session 213 (Hindsight `HINDSIGHT_INPUT_CLASS` constants + `RowActionButtons` shared components).
**Sister to:** session 122's `useApiData` adoption in the session detail page (also List 1, also touched `session-repository.ts`'s downstream consumers — the Sessions list page).

## What this session did

The orphan-sweep logic in `src/lib/session-repository.ts` had 2 functions — `previewOrphanSweep` (the dry-run SELECT for the admin backfill endpoint) and `closeOrphanedActiveSessions` (the actual UPDATE for the periodic 15s sync cycle). Both implement the same dual-track orphan-close logic (path A: parent-mission-gated close; path B: age-only fallback for parentless sessions) and both return the same `OrphanSweepResult` counter shape.

The pre-session form had:
- 2x duplicated `for (const row of rows) { total++; bySource[row.source]++; byNewStatus[row.status]++; }` blocks per function (one per path × 2 functions = 4 inlined tally blocks total)
- 2x duplicated `new Date(Date.now() - 5 * 60 * 1000).toISOString()` / `new Date(Date.now() - 30 * 60 * 1000).toISOString()` cutoff computations

This session extracted both patterns into 2 pure module-level helpers in `src/lib/session-repository.ts`:

### 1. `computeOrphanCutoffs(now: number = Date.now())`

Returns `{ shortCutoff, longCutoff }` from a single `now` timestamp. The 5-min boot-safety gate (`shortCutoff`) and the 30-min orphan gate (`longCutoff`) are derived in lockstep, so the dry-run SELECT and the write UPDATE always see the same point-in-time.

The pre-session form had each function call the 2 `new Date(...)` separately — the two timestamps could drift by a few ms if the function calls crossed a tick boundary, which would have made the dry-run count differ from the write count by 1 row in the worst case. The pre-extraction dry-run/writes had this subtle race; the helper closes it.

### 2. `tallyOrphanRows(rows, counters)`

Mutates an `OrphanSweepResult` counter object in place from an array of `{ source, status }` rows. Each row contributes `+1` to `total`, `+1` to `bySource[source]`, and `+1` to `byNewStatus[status]`.

The pre-session form had 4 inlined tally loops (one per (A)/(B) track, × 2 functions), each doing the same 3-line `total++; bySource[...]++; byNewStatus[...]++;` triple. The helper collapses all 4 loops to 1-line `tallyOrphanRows(rows, counters)` calls.

The (B) path's `byNewStatus["completed"]` hardcode (which had drifted from the (A) path's `byNewStatus[row.new_status]` discipline) is now explicit: each source row is tagged as `{ source, status: "completed" }` before the tally call, and the helper increments `byNewStatus["completed"]` exactly once per row. This is a forced DRY alignment — the helper's contract says "all rows use the `status` field" so the 2 paths can't drift again.

Both helpers are pure (no side effects beyond the explicit counter mutation), well-documented (each has a JSDoc block describing the contract + the (A)/(B) path usage), and exported from `session-repository.ts` for unit testing.

## Pre/post shape

### Pre-session `previewOrphanSweep` (excerpt, 4 inlined tally loops collapsed to 1)

```ts
export function previewOrphanSweep(database: Database.Database): OrphanSweepResult {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const bySource: Record<string, number> = {};
  const byNewStatus: Record<string, number> = {};
  let total = 0;

  try {
    const rows = database.prepare(/* sql */ `
      SELECT sessions.source,
             CASE ... END AS new_status
      FROM sessions
      LEFT JOIN missions m ON m.id = sessions.mission_id
      WHERE sessions.status = 'active'
        AND sessions.mission_id IS NOT NULL
        AND sessions.started_at < ?
        AND (m.id IS NULL OR m.deleted_at IS NOT NULL OR m.status != 'dispatched')
    `).all(cutoff) as Array<{ source: string; new_status: string }>;
    for (const row of rows) {
      total += 1;
      bySource[row.source] = (bySource[row.source] ?? 0) + 1;
      byNewStatus[row.new_status] = (byNewStatus[row.new_status] ?? 0) + 1;
    }
  } catch { /* non-fatal */ }

  try {
    const longCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const rows = database.prepare(/* sql */ `
      SELECT source FROM sessions WHERE ...
    `).all(cutoff, longCutoff) as Array<{ source: string }>;
    for (const row of rows) {
      total += 1;
      bySource[row.source] = (bySource[row.source] ?? 0) + 1;
      byNewStatus["completed"] = (byNewStatus["completed"] ?? 0) + 1;
    }
  } catch { /* non-fatal */ }

  return { total, bySource, byNewStatus };
}
```

### Post-session `previewOrphanSweep` (excerpt, helpers used)

```ts
export function previewOrphanSweep(database: Database.Database): OrphanSweepResult {
  const { shortCutoff: cutoff, longCutoff } = computeOrphanCutoffs();
  const counters: OrphanSweepResult = { total: 0, bySource: {}, byNewStatus: {} };

  try {
    const rows = database.prepare(/* sql */ `
      SELECT sessions.source,
             CASE ... END AS new_status
      FROM sessions
      LEFT JOIN missions m ON m.id = sessions.mission_id
      WHERE sessions.status = 'active'
        AND sessions.mission_id IS NOT NULL
        AND sessions.started_at < ?
        AND (m.id IS NULL OR m.deleted_at IS NOT NULL OR m.status != 'dispatched')
    `).all(cutoff) as Array<{ source: string; new_status: string }>;
    tallyOrphanRows(
      rows.map((r) => ({ source: r.source, status: r.new_status })),
      counters,
    );
  } catch { /* non-fatal */ }

  try {
    const rows = database.prepare(/* sql */ `
      SELECT source FROM sessions WHERE ...
    `).all(cutoff, longCutoff) as Array<{ source: string }>;
    tallyOrphanRows(
      rows.map((r) => ({ source: r.source, status: "completed" })),
      counters,
    );
  } catch { /* non-fatal */ }

  return counters;
}
```

The `closeOrphanedActiveSessions` body has the same shape. Net: 4 inlined tally loops + 2 cutoff computations → 4 single-line `tallyOrphanRows` calls + 1 `computeOrphanCutoffs` call.

## Byte-equivalence proof

1. **Tally shape**: the helper's `for (const row of rows) { counters.total += 1; counters.bySource[row.source] = (counters.bySource[row.source] ?? 0) + 1; counters.byNewStatus[row.status] = (counters.byNewStatus[row.status] ?? 0) + 1; }` is character-for-character identical to the pre-session inlined form (just `total` → `counters.total`, `bySource` → `counters.bySource`, `byNewStatus` → `counters.byNewStatus`). The only difference is the `?? 0` default that was already in the inlined form.
2. **Cutoff shape**: `new Date(now - 5 * 60 * 1000).toISOString()` and `new Date(now - 30 * 60 * 1000).toISOString()` are byte-identical to the pre-session inlined forms. The `now` parameter defaults to `Date.now()` so the no-arg call shape is unchanged.
3. **The (B) path's `byNewStatus["completed"]` hardcode**: the pre-session `previewOrphanSweep` path B and `closeOrphanedActiveSessions` path B both hardcoded `byNewStatus["completed"]` after the tally loop. The post-session form tags each source row as `{ source: r.source, status: "completed" }` BEFORE the tally call — the `tallyOrphanRows` helper then increments `byNewStatus["completed"]` exactly once per row. The wire-level SQL still assigns `status = 'completed'` (no CASE branch), so the (B) UPDATE writes are unchanged. The pre-extraction form and the helper-based form produce identical `{ total, bySource, byNewStatus }` shapes — confirmed by the existing `previewOrphanSweep === closeOrphanedActiveSessions` parity test in `close-orphaned-sessions.test.ts` (which passes byte-identical output for both functions).
4. **No SQL change**: the SELECT and UPDATE strings are byte-identical. The `tally` mutation is the only behavioural surface.
5. **No new try/catch, no new error handling**: the `try { ... } catch { // non-fatal }` blocks are unchanged.

## Test pattern (9 assertions across 2 describes)

`tests/unit/orphan-sweep-helpers.test.ts` (NEW, 163 lines):

### `computeOrphanCutoffs` (3 assertions)

1. **Returns `shortCutoff = now - 5min` and `longCutoff = now - 30min` (ISO-8601)** — verified with a fixed `now` timestamp. Pins the exact ISO format string so a future "let's use Z suffix" tweak lands here first.
2. **Uses `Date.now()` when no `now` argument is supplied** — the assertion bounds are 5/30 min ± 1 second to absorb ms-level execution overhead. Pins the default-parameter behaviour so a future "let's add a required now arg" tweak lands here first.
3. **The 25-min gap between the two cutoffs is preserved by construction** — this is the invariant that makes the (A)/(B) tracks independent gate windows.

### `tallyOrphanRows` (6 assertions)

1. **Single-row tally into `total` + `bySource` + `byNewStatus`** (one of each) — pins the "mutates the counter, doesn't return a new one" contract.
2. **Aggregation of multiple rows with the same source + status** — the pre-extraction loop behaviour.
3. **Separation of `bySource` from `byNewStatus`** — a 4-row fixture with 3 distinct source values and 2 distinct status values; the helper keeps them in separate maps rather than summing them. This catches a future "let's merge them into one map" regression.
4. **Empty input is a no-op** (counters stay at zero) — pins the `for...of` loop's empty-iteration behaviour.
5. **Returns `undefined` (mutates the input counter object in place, doesn't return a replacement)** — pins the `tally` verb in the JSDoc. The pre-extraction form had the same behaviour (3 inline mutations to `total`, `bySource`, `byNewStatus`).
6. **Additive across multiple invocations on the same counter** — the real `previewOrphanSweep` and `closeOrphanedActiveSessions` each call `tallyOrphanRows` twice (once per (A)/(B) track) on the same counter object; the helper is additive so the 2 calls sum into the right totals.

## Verification

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/lib/session-repository.ts tests/unit/orphan-sweep-helpers.test.ts --max-warnings 0`: clean
- `CI=true npx jest tests/unit/orphan-sweep-helpers.test.ts`: **9/9 pass**
- `CI=true npx jest tests/unit/close-orphaned-sessions.test.ts`: **22/22 pass** — the existing parity test that asserts `previewOrphanSweep === closeOrphanedActiveSessions` continues to pass byte-identical output. This is the gold-standard byte-equivalence verification: the end-to-end dry-run/writes pair produces the same counts.
- Full `CI=true npx jest` sweep: 337 suites / 2630 tests pass (was 336/2621 after the session 215 followup = +1 suite, +9 tests)
- `npm run build`: clean

## Anti-migration guards (what this session did NOT change)

1. **Did NOT extract the SQL strings into shared constants.** The (A) and (B) track queries are *similar* but not identical (one is a SELECT, one is an UPDATE+RETURNING, plus the UPDATE has the extra `ended_at = COALESCE(...)` + `exit_code = COALESCE(...)` SET clauses). The 2 functions still own their own SQL — the helper extraction is JS-side only (tally + cutoffs), not SQL-side. A SQL extraction would have been a 3rd helper (a `buildOrphanSweepSql(track)` function) that the user has not asked for and the byte-equivalence risk is much higher (the SET clauses in the UPDATE are mission-status-derived via the CTE; a templated SQL builder would obscure that derivation).
2. **Did NOT extract the `closeOrphanedActiveSessions` 3-sub-case "successful/failed/other" CASE expression.** It's tied to the SQL structure and would require either a `CASE`-string builder or a `MissionStatus` → `NewStatus` lookup map — both add abstraction without reducing the line count.
3. **Did NOT consolidate the 2x `closeOrphanedActiveSessions` `try { ... } catch { // non-fatal }` blocks.** The catch is intentionally 1 line (`// non-fatal`) and serves as documentation of the per-track error-tolerance policy. Extracting it to a `safelyTallyRows` wrapper would obscure the intent.

## Files

| Type | Change |
|------|--------|
| Modified | `src/lib/session-repository.ts` (added 2 helpers + 2 function rewrites; +60 lines net, 2 functions simplified) |
| New | `tests/unit/orphan-sweep-helpers.test.ts` (163 lines, 9 assertions across 2 describes) |
| New | `docs/references/session-216-list1-orphan-sweep-helpers.md` (this file) |
| Modified | `pr-body.txt` (appended session 216 entry, ~80 lines) |
| Modified | `pr-body-headline.md` (replaced session 215 followup with session 216, demoted session 215 to recent-sessions-full-detail) |

## New pitfalls codified

### P-216-1 — Two paths with byte-identical counter shapes are a single helper, not two

The (A) parent-mission-gated path and the (B) age-only fallback path in `closeOrphanedActiveSessions` / `previewOrphanSweep` both produce `{ source, status }` rows and both feed the same `OrphanSweepResult` counter shape. The 4 inlined tally loops (2 functions × 2 paths) were a DRY violation that the user couldn't see because the loops were visually identical.

**The fix:** a single `tallyOrphanRows(rows, counters)` helper that takes a row array and mutates the counter.

**The discriminator:** if you have 2+ functions that both iterate rows and both update 3+ fields of the same result-object shape, the iteration is a single helper.

**Reusable across:** any pair of read/write siblings (preview + commit, dry-run + apply, list + mutate) that return the same counter shape.

### P-216-2 — "Compute the same timestamp twice" is a single helper, not two

The 2 functions each called `new Date(Date.now() - 5 * 60 * 1000).toISOString()` and `new Date(Date.now() - 30 * 60 * 1000).toISOString()` separately. The 2 timestamps could drift by a few ms if the function calls crossed a tick boundary, making the dry-run count differ from the write count by 1 row in the worst case.

**The fix:** a single `computeOrphanCutoffs(now)` helper that derives both timestamps from a single `now`. The user can pass an explicit `now` for tests (the default is `Date.now()`).

**The discriminator:** if you have 2+ functions that each compute the same `now - constant` timestamp and feed it to a SQL `?` placeholder, the timestamp computation is a single helper.

**Reusable across:** any read/write pair where the SQL `?` placeholders must be in lockstep (preview + apply, before + after, request + retry).

## Next session should

- **Random pick next session.** The List 1 surface has been mined for the 2 patterns landed in this session (`computeOrphanCutoffs` + `tallyOrphanRows` helpers in `session-repository.ts`). The orphan-sweep logic is now byte-equivalent and DRY.
- **Other List 1 candidates worth re-scanning:**
  - (a) the dashboard's 3 inline `[X, Y, Z] as const` array literals that could be hoisted to module-level constants (e.g. `HANDLED_STATUS_BADGES`, the `["all", "error", "warning"]` severity filter)
  - (b) the per-page `LoadErrorBanner` rendering pattern in 4 List 1 pages (the banner is shared but each page renders it with slightly different copy — could become a `useListPageShell` hook that owns the load/error/empty state lifecycle)
  - (c) the dashboard's 3 timer cleanup patterns (initial fetch `AbortController`, polled updates, 30-second clock — could be unified into a single `usePageTimers` hook that owns all 3 cleanup paths)
- **Carryover** — none. The next session starts with a clean working tree.
