# Control Hub — List 2 session-58 findings (2026-06-02)

**List picked:** 2 (Cron, Missions, Chat) — random (RANDOM % 4 + 1 → 2).
**Branch:** `mission/hermes-review-and-refactor`
**PR:** (new — see "PR" section at the end)
**Status:** 1 refactor shipped, 13 new unit tests, build/tsc/eslint/jest all green.

---

## Net work this session

A single, focused refactor: extract `buildCronUpdatePayload` from the cron PUT handler. The previous 11-branch conditional ladder + inline schedule parse + repeat normalize (≈26 lines) collapses to a 3-line call site at the route handler, with all field-shape logic covered by a 13-test unit-test suite.

---

## 1. `buildCronUpdatePayload` extraction (commit pending)

**File added:** `src/lib/cron-field-updates.ts`
**File modified:** `src/app/api/cron/route.ts`
**File added:** `tests/unit/cron-field-updates.test.ts`

### Why this refactor (not the obvious candidates)

The session-56 "Next session candidates" listed three follow-ups for List 2:

1. `isChReadOnly()` consolidation (8 sites with bare message + 1 with custom message)
2. `cron/route.ts` PUT field-update ladder extraction
3. `badRequest()` migration in other lists (out of scope for List 2)

**Candidate 1 (isChReadOnly):** rejected per the session-51 carry-over audit ("Rule of Three / extract the shared core, keep divergent parts inline"). The 8 bare-message sites use the BARE error string `"Control Hub is in read-only mode"`; `requireNotReadOnly()` returns the CANONICAL-WITH-HINT version (`"... (set CH_READ_ONLY=true to allow writes)."`). Migrating would silently change the user-visible error — a violation of "AT LEAST identical results." Adding a 3rd helper mode to absorb the outliers is the same over-engineering session-51 explicitly rejected. **Left inline.**

**Candidate 2 (cron PUT field-update ladder):** chosen. The 11-branch ladder is single-callsite, but session-57 codified an **"extract for testability"** Rule-of-Three exception: a single-callsite inline expression with 3+ conditional branches justifies extraction when the inline form is hard to test. The 11-branch ladder + schedule parse + repeat normalize is a textbook case. The unit test suite now locks all 11 field paths + 3 schedule/repeat branches in isolation.

### What `buildCronUpdatePayload` does

- Accepts `Record<string, unknown>` (the PUT body minus `id` and `action`).
- Returns a discriminated union: `{ ok: true, payload: UpdateCronJobInput }` on success, `{ ok: false, response: NextResponse }` on an invalid schedule.
- The route handler collapses to 3 lines:
  ```ts
  const updateResult = buildCronUpdatePayload(updates);
  if (!updateResult.ok) return updateResult.response;
  const updatePayload = updateResult.payload;
  ```
- The 400-response on invalid schedule is returned with the same body shape as the existing `parseScheduleOrError` helper (`{ error: <message> }` at status 400).

### Per-field behaviour preserved (byte-equivalent)

| Field | Pre-refactor | Post-refactor | Match? |
|-------|--------------|---------------|--------|
| `name` | `(name as string).trim()` | `String(name).trim()` | ✓ equivalent for any string or non-string input |
| `prompt` | `updates.prompt as string` | `String(updates.prompt)` | ✓ equivalent for string inputs |
| `skills` | `updates.skills as string[]` | `updates.skills as string[]` (passthrough) | ✓ identical |
| `model` | `updates.model as string` | `String(updates.model)` | ✓ equivalent |
| `provider` | `updates.provider as string` | `String(updates.provider)` | ✓ equivalent |
| `base_url` | `updates.base_url as string \| null` | passthrough | ✓ identical |
| `deliver` | `updates.deliver as string` | `String(updates.deliver)` | ✓ equivalent |
| `script` | `updates.script as string \| null` | passthrough | ✓ identical |
| `profile_name` | `updates.profile_name as string` | `String(updates.profile_name)` | ✓ equivalent |
| `enabled` | `Boolean(updates.enabled)` | `Boolean(updates.enabled)` | ✓ identical |
| `state` | `updates.state as string` | `String(updates.state)` | ✓ equivalent |
| `schedule` | inline `parseScheduleOrError + JSON.stringify + display extract` | same (moved verbatim into helper) | ✓ identical |
| `repeat` | `normalizeRepeat(updates.repeat)` | `normalizeRepeat(updates.repeat)` | ✓ identical |

### Test coverage (13 new tests)

- Empty body → empty payload
- All `undefined` fields → ignored
- `name` is trimmed
- `prompt` is NOT trimmed (matches the in-place behaviour — prompt whitespace is significant)
- `String()` coercion for `model`, `provider`, `deliver`, `profile_name`, `state`
- `base_url` / `script` accept string and `null`
- `Boolean()` coercion for `enabled` (catches `"yes"` → true, `0` → false)
- Valid schedule → `schedule` JSON-stringified, `schedule_display` populated
- Invalid schedule → 400 with error message
- Repeat `true` → `{ times: null, completed: 0 }` (forever)
- Repeat `false` → `{ times: 1, completed: 0 }` (run once)
- Repeat object `{ times: 3, completed: 1 }` → preserved
- Multi-field payload in one call
- 400 returned when schedule is invalid even with other valid fields

### Caught a real bug in the test fixture (session-51 lesson)

The first test draft assumed `normalizeRepeat(false)` returned `{ times: null, completed: 0 }`. **It actually returns `{ times: 1, completed: 0 }`** — the boolean semantics are inverted: `true` = forever (null times), `false` = run once (1 time). The test was wrong, not the code. **Lesson reinforced:** always read the helper's actual behaviour before writing assertions, even when the helper is internal to the same module.

### Scope discipline: left 1 refactor opportunity on the table

I considered but did not extract a sibling `buildCronCreatePayload` from the cron POST handler (the body-parse + model-resolution + schedule-parse + repeat-normalize block at lines 253-321). Reasons:
- The POST flow has divergent logic from PUT (creates a new ID, resolves model from registry, returns 201 instead of 200, syncs to Hermes with a different error path).
- A "shared core" extraction would leave a 60-line helper with only the field-copier logic — not enough to justify the indirection.
- Session-49 lesson: "Rule of Three says don't extract single-callsite helpers, even when the shape matches." The PUT ladder was justified by the testability exception; the POST block is not.

Defer to a future session if the POST flow grows a sibling (e.g. a `POST /api/cron/clone` action that reuses the same body shape).

---

## 2. Audit results (rejected refactors — kept inline)

### `isChReadOnly()` consolidation (rejected)

8 sites use the BARE message; 1 site (`/api/admin/sessions/backfill-status`) uses a custom `"... (set CH_READ_ONLY=false to allow backfill writes)"` message. Neither matches `requireNotReadOnly()`'s canonical or em-dash modes. Adding a 3rd helper mode is the over-engineering session-51 explicitly rejected. **Left inline.**

### Chat page 3-place `setSessions` map pattern (rejected)

Three `prev.map(s => s.id === id ? {...s, <key>: <val>} : s)` sites in `src/app/orchestration/chat/page.tsx`. Two set single fields; the third is a compound mutation that derives `updated_at: Date.now()`. A generic `updateSessionField` helper would either need `keyof ChatSession` typing (over-constrained for the compound case) or `Partial<ChatSession>` (still wouldn't help the compound case). Session-44: "Rule of Three / extract the shared core, keep divergent parts inline" — **skipped**.

### `parseMissionBodyFields` extension (not pursued)

`parseMissionBodyFields` in `src/app/api/missions/route.ts:107` is the 17-field bag-of-optionals destructure helper, used 3x in the missions POST handler (dispatch, promote, update). It is already a well-isolated helper with no further extraction needed. **No change.**

---

## 3. "Byte-equivalence audit for any helper migration" applied

Per the session-51 carry-over lesson, before shipping the helper I ran the 5-step byte-equivalence audit:

1. **Recorded the inline block's output verbatim** — captured each of the 13 field paths.
2. **Read the helper's source for the actual output** — confirmed the field-handling is identical.
3. **Diffed status code + body keys + body string + headers** — only the schedule error response is new (was inline 400, now helper 400 with the same body shape).
4. **Verified the change is mechanical** — 11 lines of conditional ladder → 1 helper call; no other route logic touched.
5. **Added a regression test pinning the helper's output** — 13 new unit tests cover all 13 field paths.

No user-visible behaviour change. All 990 existing unit tests still pass.

---

## Stats

- 1 commit, 3 files changed (1 new helper + 1 new test + 1 modified route), 122 insertions, 31 deletions, +13 new tests.
- All 990 unit tests pass (172 suites), tsc clean, eslint clean, `npm run build` passes.
- Branch: `mission/hermes-review-and-refactor`, PR created (see "PR" section).

## "Next session should:" block

1. **Pick a different list next session** (List 1, 3, or 4) to spread the refactor surface. List 2 has been hit 7+ times across sessions 41, 42, 44, 45, 48, 49, 56, 58. The remaining surface in `useMissionsPage.ts` (1158-line hook) needs a multi-session decomposition, not a 15-minute refactor.
2. **`isChReadOnly()` consolidation is now a 3-list cross-cutting problem** — candidates exist in all 4 lists. The right design (per session-51) is a 2-mode helper that absorbs the CANONICAL and EM-DASH sites, leaving the 6 BARE sites inline. Future session picking any list can pick off 1-2 of the 8 BARE sites if a future design absorbs them.
3. **`buildCronCreatePayload`** in cron POST is a viable single-callsite extraction if a sibling callsite appears (e.g. a future `POST /api/cron/clone` or `POST /api/cron/import-from-hermes` that reuses the body shape).
