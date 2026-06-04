# List 1 sweep — session 61 (control-hub, 2026-06-03)

Random pick: **List 1** (Dashboard, Sessions, Memory, Logs). The last List 1
session was 57 (cron-schedule finally cleanup + `findFileWithExtension` adoption
+ `isHindsightConnectionError` helper). Sessions 58–60 covered Lists 2, 3, 4
respectively. This session re-audits List 1 after the cross-list factory
additions (sessions 59 + 60 added `notFound` and `serverError` to
`@/lib/api-response.ts`).

## The single big finding

### 13 inline `status: 400/404/500` blocks across List 1 API routes

**Files:** 5 routes — `src/app/api/sessions/route.ts`, `src/app/api/sessions/[id]/route.ts`,
`src/app/api/logs/route.ts`, `src/app/api/memory/route.ts`, `src/app/api/monitor/route.ts`.

The factory helpers from sessions 48 (`badRequest`), 59 (still inline), 60
(`notFound` + `serverError`) were all defined but **not adopted** across the
List 1 surface. This is the gap the session-59 "List-aware audit recipe"
flagged but didn't close:

> `grep -rn "status: 400" src/app/api/ | grep -v "badRequest"` — currently
> 17 hits across skills, fs, mission-categories, logs, memory, stories.
> None on List 4 anymore.

The 17-hits count is now **0** in List 1 (13 sites migrated, all in
sessions/logs/memory/monitor) and the global count is dropping steadily.
Sites migrated this session:

| File | Sites | Status codes |
|---|---|---|
| `src/app/api/sessions/route.ts` | 4 | 2× 404, 1× 500, 1× 503 (kept inline — no factory) |
| `src/app/api/sessions/[id]/route.ts` | 2 | 1× 404, 1× 500 |
| `src/app/api/logs/route.ts` | 5 | 2× 400, 2× 404, 1× 500 |
| `src/app/api/memory/route.ts` | 1 | 1× 400 (deleted `unsupportedWriteResponse` helper, inline 3-line 400 builder → `badRequest()`) |
| `src/app/api/monitor/route.ts` | 1 | 1× 500 |

**Net code removed:** ~25 lines of `NextResponse.json({error}, {status: N})`
boilerplate collapsed to 1-line factory calls. The `ApiResponse<never>` type
generic on each inline block (which was redundant — NextResponse's body type
inference is fine) is also gone.

### Why I rejected the `503` in `sessions/route.ts`

`isChReadOnly()` returns a `503` when the dashboard is in read-only mode
(only used in `POST /api/sessions` and the similar `POST /api/cron` site).
Adding a `serviceUnavailable()` factory to `@/lib/api-response.ts` would be
premature — the **only** 503 in the entire codebase is this one, and a
sibling-pattern would need ≥2 sites per the Rule of Three. If/when a 2nd
503 site appears (e.g. the planned deploy system read-only guard), promote
it then. Kept inline with a comment for now.

### Why I rejected the `memory/hindsight` 500s

`/api/memory/hindsight` has 2 inline catch blocks returning
`{ data: { available: false, error, memories: [] } }` with status 500/503.
This is the soft-fail envelope the session-57 findings explicitly rejected
for the same reason:

> 4× `available: false` envelopes in hindsight — not candidates for
> `badRequest()` because the shape is a soft-fail `200/500` envelope with
> `data: { available: false, ... }`, not a `400 { error }`. Different
> contracts; keep them inline.

The shape IS the API contract — the frontend uses `data?.available` to
decide whether to show the Hindsight UI or the "Hindsight not running" state.
A factory swap would silently break the contract.

## What was rejected

- **`session-detail/page.tsx` `data?.messages` optional-chaining** —
  3 sites all guarded by `if (!data?.messages)` or post-early-return use.
  The `data` narrowing doesn't propagate across `useMemo` hooks (React
  Hooks rule: hooks must be unconditional). The `?.` is correct here,
  not a refactor target.
- **`logs/route.ts` DELETE-loop `resolve(logsDir, '${file.name}.log')`**
  repeated — 1 call per file in a 5-iteration loop. Could be hoisted but
  the existing call is more readable. Left alone.
- **`sessions/page.tsx` `data?.sessions ?? []` (line 334)** — same
  optional-chaining issue; correct because useMemo can't be guarded.
- **`logs/page.tsx` `setRefreshing` finally-block** — the
  `useEffect(() => { if (refreshing && !loading) setRefreshing(false); }, …)`
  follows the session-35 pattern. Already correct (1 setRefreshing call on
  the right path, not 2 like the original session-35 `setSaving(false)` bug
  was). No change needed.
- **Adding `serviceUnavailable` factory for the 503 in `sessions/route.ts`**
  — Rule of Three. See above.

## Verification

- All 1009 unit tests pass (no count change — no new tests added; this
  session is pure refactor)
- `npx tsc --noEmit` clean
- `CI=true npx eslint . --max-warnings 0` clean
- `npm run build` passes
- `grep -nE "status: (400|404|500)" src/app/api/{sessions,logs,memory,monitor}/**/*.ts` — 0 hits
  (was 13)

## Files touched

- `src/app/api/sessions/route.ts` (4 inline blocks → factories)
- `src/app/api/sessions/[id]/route.ts` (2 inline blocks → factories)
- `src/app/api/logs/route.ts` (5 inline blocks → factories; removed `ApiResponse<never>` generic on remaining `NextResponse.json` success sites since the data-type is inferred)
- `src/app/api/memory/route.ts` (deleted `unsupportedWriteResponse` helper; 1 site → `badRequest()`)
- `src/app/api/monitor/route.ts` (1 inline block → factory)
- `references/control-hub-list1-session61-findings.md` (this file)

## Patterns to take forward

1. **List-aware audit recipe** — `grep -nE "status: (400|404|500)" src/app/api/<list>/**/*.ts | grep -v "badRequest" | grep -v "notFound" | grep -v "serverError"` — run this against the picked list every session until 0 hits. The session-60 `notFound`/`serverError` additions were not retro-applied to earlier lists; this is the sweep that closes that gap for List 1. Lists 2–3 still have a few inline 400s to migrate.
2. **Status-code discipline** — keep factories status-code-locked; don't add overloads for "any 4xx" / "any 5xx". The 503 in `sessions/route.ts` stays inline (1 site, no factory) per Rule of Three.
3. **Soft-fail envelopes (`{ data: { available: false, … } }`) stay inline** — they have a different contract than the canonical `{ error }` shape and the frontend keys off the data shape. Session-57 lesson; pinned this round too.
