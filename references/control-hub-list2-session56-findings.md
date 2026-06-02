# Control Hub — List 2 session-56 findings (2026-06-02)

**List picked:** 2 (Cron, Missions, Chat) — random.
**Carry-over from prior cron run:** 5 modified files + 3 untracked files (squashed into `7afc35f`).
**Net work this session:** 1 carry-over commit + 1 refactor commit + 1 PR body update.

---

## Carry-over commit (`7afc35f`)

Inherited 5 modified + 3 untracked files from the prior cron run. All carry-over was solid refactor work; squashed into a single commit:

- `src/lib/sessions-api-helpers.ts` (NEW) — extracted `pickEnum`, `triggerSyncOnce`, `parseSessionQuery` from `/api/sessions` GET. `ALL_AGENT_TYPES` and `ALL_SOURCES` promoted to module-scope exports.
- `src/lib/session-filters.ts` — hoisted `1024` and `60_000` magic numbers to `API_NOISE_MAX_BYTES` and `API_NOISE_MAX_AGE_MS`. `searchSessionsByQuery` now delegates to `sessionMatchesQuery` (single source of truth for case-insensitive matching).
- `src/app/api/memory/route.ts` — POST/PUT/DELETE all share a single `unsupportedWriteHandler`; each verb is a one-liner export. 18 lines collapsed to 9.
- `src/components/session/constants.tsx` — dropped re-export of `formatSessionTitle` (every consumer migrated to `src/lib/session-title`).
- `src/app/(main)/sessions/page.tsx` — import `formatSessionTitle` from canonical `src/lib/session-title`.
- `tests/unit/sessions-api-helpers.test.ts` (NEW) — 16 tests for the extracted helpers.
- `tests/unit/memory-unsupported-write.test.ts` (NEW) — 8 tests pinning the 400 + auth-check contract for POST/PUT/DELETE.

**All 24 new tests pass.** No user-visible behaviour change.

---

## Refactor commit (`374fc29`) — `badRequest()` adoption in 4 List 2 routes

Found that `badRequest()` in `src/lib/api-response.ts` (added in session 48, locked by `tests/unit/api-response.test.ts` with 4 tests) was only adopted by 3 routes — sessions, memory/hindsight, and sessions/[id]. **14 inline `return NextResponse.json({ error: ... }, { status: 400 })` calls remained in the 4 List 2 routes**, all with the byte-identical `{ error: <string> }` body shape.

### Migrated 14 sites across 4 routes

| File | Sites | Notes |
|------|-------|-------|
| `src/app/api/cron/route.ts` | 5 | `parseScheduleOrError` (1), POST validation (2: name/schedule required), PUT/DELETE id-required (2). |
| `src/app/api/cron/hardware/route.ts` | 5 | `rejectIfBadScriptsCommand` (1), POST validation (2: schedule+command, 5-fields), PUT/DELETE id-required (2). |
| `src/app/api/missions/route.ts` | 9 | `requireMissionId` (1), category parse error (3x — `replace_all`), instruction required (1), dispatchMode required (1), instruction cannot be empty (1), use-promote-for-drafts (1), unknown action (1). |
| `src/app/api/orchestration/chat/route.ts` | 1 | messages array required. |

Net: **4 files changed, 25 insertions, 36 deletions.**

### Per session-51 carry-over audit: byte-equivalence verified

Each migration was diffed for response-body string byte-equivalence. All 14 sites preserved the same `{ error: <string> }` body and the same 400 status. **No user-visible behaviour change.** All 967 unit tests pass (170 suites).

### Scope discipline: skipped the `isChReadOnly()` inline migration

The 5 remaining `isChReadOnly()` + inline `NextResponse.json` 503 sites in the codebase (in `cron/route.ts`, `cron/hardware/route.ts`, `admin/sessions/backfill-status/route.ts`, `missions/route.ts`, `sessions/route.ts`) use the **BARE** message `"Control Hub is in read-only mode"` (no env-var hint). `requireNotReadOnly()` (session 51) without context returns the **CANONICAL-WITH-HINT** version (`"Control Hub is in read-only mode (set CH_READ_ONLY=true to allow writes)."`). Migrating would silently change the user-visible error string — a violation of the "AT LEAST identical results" constraint.

Adding a 3rd `requireNotReadOnly()` mode to absorb the bare-message outliers is the same over-engineering session-51 explicitly rejected (the 6 outliers would need a 3rd "bare" mode, but the helper already has the 2-mode API for em-dash and canonical). **Leave inline.** This is the documented "Rule of Three / extract the shared core, keep divergent parts inline" guidance applied to the helper-API design.

### Considered and rejected

- **`chat/page.tsx` `setSessions` map pattern** (3 sites doing `prev.map(s => s.id === id ? {...s, <key>: <val>} : s)`). The 3 sites have **divergent** bodies: one sets `{ messages: updater(s.messages), updated_at: Date.now() }` (compound, with derived `updated_at`), the other two set single fields. A generic `updateSessionField(id, key, value)` helper would either need a type-narrowed `keyof ChatSession` (over-constrained for the compound case) or `Partial<ChatSession>` (still wouldn't help the compound case). Rule of Three / extract the shared core, keep divergent parts inline — **skipped**.

- **`cron/route.ts` `parseScheduleOrError` deeper refactor.** Migrated to `badRequest()`; the helper itself stays because the call sites use the discriminated-union return shape. No further extraction warranted.

- **The `useMemo` in chat page** `[activeSession?.messages ?? [], [activeSession]]` looks under-narrowed (activeSession is a fresh ref on every `sessions` change), but the dep is **correct** — the memo IS invalidated on every change, which is what we want. The session-49 fix (model effect) is the canonical "narrow the dep to the field you read" case; this one is the opposite. **Skipped.**

### Next-session candidates (List 2 followup)

- **`badRequest()` migration in other lists**: 17+ files still use inline `status: 400` — but List 2 is the only one in scope for this session. Future session picking List 1/3/4 should do the same.
- **`isChReadOnly()` consolidation** needs a 3rd helper mode OR a 2-mode design with a different name (e.g. `requireNotReadOnlyBare()`) to absorb the 5+6=11 sites. **Defer** — this is a refactor, not a behaviour change, but the 11-site tally makes the helper-API design more compelling.
- **The `cron/route.ts` PUT handler has a long `if action === ...` ladder** (pause, resume, run, field updates). The "field updates" branch has 11 inline `if (updates.X !== undefined) updatePayload.X = updates.X as Y` statements that could be a `buildFieldUpdatePayload(updates)` helper. **Defer** — single-call helper, Rule of Three not met yet.
- **The chat page 6 setSessions call-sites** could be partly consolidated by `updateSessionField` once a 4th caller appears.

### Stats

- 2 commits, 12 files changed (4 new + 8 modified), 431 insertions, 142 deletions, +24 new tests.
- All 967 unit tests pass (170 suites), tsc clean, no external behaviour changes.
- Branch: `mission/hermes-review-and-refactor`, PR #144 body updated.
