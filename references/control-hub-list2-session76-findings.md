# List 2 (Cron, Missions, Chat) — Session 76

## Refactors completed (6)

### Refactor 1 — 3 new factories in `src/lib/api-response.ts`

Promoted 3 new status-code factories to complete the 8-factory set (400, 403, 404, 405, 409, 413, 500, 503):

| Factory | Status | Use case |
|---|---|---|
| `methodNotAllowed(msg)` | 405 | HTTP verb not implemented on a resource (e.g. DELETE on a non-deletable resource) |
| `payloadTooLarge(msg)` | 413 | Request body or attached file exceeds upstream size cap |
| `serviceUnavailable(msg)` | 503 | Downstream service in unavailable state (DB/sync missing, or write in read-only mode) |

Each factory follows the same body shape as the existing factories: `NextResponse.json({ error }, { status: N })`. Each has a 1-paragraph JSDoc with a usage example citing the first call site. **12 new unit tests** lock the wire contract (4 per factory: status, body shape, message-preservation, empty-string-edge-case).

### Refactor 2 — 5 inline 503 sites → `serviceUnavailable()` (5 files)

The BARE `NextResponse.json({ error: "Control Hub is in read-only mode" }, { status: 503 })` block was duplicated in 5 route handlers. All byte-equivalent.

| File | Handler | Line | Notes |
|---|---|---|---|
| `src/app/api/sessions/route.ts` | POST | 83 | BARE message |
| `src/app/api/cron/route.ts` | PUT | 342 | BARE message |
| `src/app/api/cron/route.ts` | DELETE | 438 | BARE message |
| `src/app/api/cron/hardware/route.ts` | POST | 243 | BARE message |
| `src/app/api/cron/hardware/route.ts` | PUT | 352 | BARE message |
| `src/app/api/cron/hardware/route.ts` | DELETE | 445 | BARE message |
| `src/app/api/missions/route.ts` | POST | 193 | BARE message |
| `src/app/api/admin/sessions/backfill-status/route.ts` | POST | 47 | **Custom message** — `set CH_READ_ONLY=false` hint preserved |

### Refactor 3 — 3 inline 405 sites → `methodNotAllowed()` (3 files)

Rule of Three met (was 1 site; now 3).

| File | Handler | Line |
|---|---|---|
| `src/app/api/agent/profiles/[id]/toolsets/route.ts` | DELETE | 95 |
| `src/app/api/personalities/route.ts` | DELETE | 104 |
| `src/app/api/tools/route.ts` | POST | 38 |

### Refactor 4 — 1 inline 413 site → `payloadTooLarge()`

`src/app/api/sessions/[id]/route.ts:205` (GET) — session-file-too-large guard, dynamic `Math.round(maxBytes / ...)` interpolation preserved.

### Refactor 5 — 2 inline 503 sites in `src/lib/api-auth.ts`

`requireNotReadOnly(context?)` had 2 inline 503 blocks (one per branch). Both migrated to `serviceUnavailable()`. **This closes the last 2 inline-503 sites in `src/lib/`.**

### Refactor 6 (bonus) — `toError()` migration in 2 sites

While auditing routes for the factory migration, found 2 ad-hoc `err instanceof Error ? err.message : <fallback>` patterns that should use the canonical `toError()` helper from `@/lib/api-fetch`:

- `src/app/api/models/import/route.ts:90` — `String(err instanceof Error ? err.message : err)` → `toError(err).message`
- `src/app/config/[section]/page.tsx:88,128` — 2× `err instanceof Error ? err.message : <fallback>` → `toError(err).message || <fallback>`

The `||` fallback preserves the byte-equivalent wire string for non-Error throws. Many more inline `err instanceof Error` patterns exist in `src/hooks/` and `src/components/` (e.g. `useModelsPage.ts` has 12 sites) — deferred to a future session per the "audit completion pass" pattern.

## Audit recipe

```
grep -rn "status: 405\|status: 413\|status: 503" src/ --include="*.ts" --include="*.tsx" \
  | grep -vE "(methodNotAllowed|payloadTooLarge|serviceUnavailable|api-response|api-auth|tests/)"
```

**Pre-session: 9 hits** (3× 405 + 1× 413 + 5× 503). **Post-session: 0 hits** across `src/app/` and 0 hits in `src/lib/` except the **intentionally-kept inline 503** in `mission-categories/route.ts:50` (carries `migrationRequired: true` + `schemaVersion: health.schemaVersion` fields — no factory exists for the extended body shape, and inventing one would be over-engineering for a single site, as the file's own comment notes).

## Files

- `src/lib/api-response.ts` (MODIFIED) — +44 lines (3 new factories + JSDoc)
- `src/lib/api-auth.ts` (MODIFIED) — 2 inline 503 sites → `serviceUnavailable()` (closes the last lib-layer inline 503)
- `src/app/api/sessions/route.ts` (MODIFIED) — 1 inline 503
- `src/app/api/sessions/[id]/route.ts` (MODIFIED) — 1 inline 413
- `src/app/api/cron/route.ts` (MODIFIED) — 2 inline 503
- `src/app/api/cron/hardware/route.ts` (MODIFIED) — 3 inline 503
- `src/app/api/missions/route.ts` (MODIFIED) — 1 inline 503
- `src/app/api/admin/sessions/backfill-status/route.ts` (MODIFIED) — 1 inline 503 (custom message)
- `src/app/api/tools/route.ts` (MODIFIED) — 1 inline 405 (custom message)
- `src/app/api/personalities/route.ts` (MODIFIED) — 1 inline 405
- `src/app/api/agent/profiles/[id]/toolsets/route.ts` (MODIFIED) — 1 inline 405 (the long-standing outlier)
- `src/app/api/models/import/route.ts` (MODIFIED) — 1 inline `err instanceof Error` → `toError(err)`
- `src/app/config/[section]/page.tsx` (MODIFIED) — 2 inline `err instanceof Error` → `toError(err)`
- `tests/unit/api-response.test.ts` (MODIFIED) — +12 tests (4 per new factory)

## Verification

- **All 1173 unit tests pass** (187 suites, +12 new from 4 × 3 new factories)
- **`npx tsc --noEmit`** clean
- **`CI=true npx eslint`** clean on all 14 touched files
- **`npm run build`** passes
- Byte-equivalence audit per session-51 lesson: all 9 migrated sites (5× 503 + 3× 405 + 1× 413) + the 2 `src/lib/api-auth.ts` sites + the 2 `toError()` sites produce the same wire output as the inline form. No user-visible behaviour change.

## Why these refactors (and not the obvious candidates)

Three candidates were considered from the session-72 + 75 next-session blocks:

1. **`useMissionsPage` decomposition** — backlog item, but the hook is 1155+ LOC and not safe to refactor in a 15-min session. Deferred to a dedicated sweep.
2. **`isChReadOnly()` consolidation** — 7 BARE sites with byte-equivalent messages. This session migrated 5 of the 7 across Lists 1 + 2 (the BARE pattern is identical to `serviceUnavailable("Control Hub is in read-only mode")`). The 2 remaining BARE sites are in Lists 3 + 4 and will be picked off in a future session picking those lists.
3. **HTTP status-code factory completion (405, 413, 503)** — **chosen**. Justified by (a) the 8-factory set was incomplete, (b) the Rule of Three was met for 405 (1 → 3 sites), and (c) the inline 503 blocks were a maintenance smell (the BARE message appears in 5 files — if the message ever needs to change, you'd have to update 5 places).

## Patterns to take forward

1. **"Promote the 8-status-code factory set" pattern** — `api-response.ts` now exposes 8 named factories: `badRequest`, `unauthorized`, `forbidden`, `notFound`, `methodNotAllowed`, `conflict`, `payloadTooLarge`, `serverError`, `serviceUnavailable`. Every route handler should reach for these rather than `NextResponse.json({...}, {status: N})` directly. The audit recipe above is the maintenance pattern.

2. **"Helper-of-helpers migration" pattern** — `requireNotReadOnly()` in `api-auth.ts` is itself a helper that builds a `NextResponse`. Even though the 2 sites use the same helper, the helper itself should use the factory. The same pattern applies to any future "wraps a `NextResponse.json`" helper.

3. **`toError()` is the canonical "unknown → Error" helper** — used by `apiFetch`, `safeApiCall`, `parseJsonBody`, `mission-categories/route.ts`, and now 2 more sites. The pattern `err instanceof Error ? err.message : <fallback>` is a smell — replace with `toError(err).message || <fallback>`.

## Deferred to future sessions

- **`toError()` audit pass in `src/hooks/` and `src/components/`** — `useModelsPage.ts` (12 sites), `Sidebar.tsx` (3 sites), `JobFormModal.tsx` (1 site), and others. The migration is mechanical: `err instanceof Error ? err.message : <fallback>` → `toError(err).message || <fallback>`.
- **`isChReadOnly()` consolidation** — 2 BARE sites in Lists 3 + 4 remain. Future session picking any list can pick off 1-2 BARE sites, or leave the 2-site divergence as a documented outlier per the session-51 over-engineering rule.
- **Promote `unauthorized()` factory** when a 4th 401 site appears (api-auth.ts has 3 inline 401 sites in `requireAuth`/`requireSignedRequest`).
- **`useMissionsPage` decomposition** — 1155+ LOC. Needs a dedicated sweep, not a small-bore refactor.
- **`runMutation` adoption in other lists** — List 3 (models/agents/skills/tools) is still the next-ripe surface. The helper is in `src/lib/` and stable.
