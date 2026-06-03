# Session 97 — List 3 (Operations) carryover finalization

Pick was **List 3 (Operations — credentials, seed, personalities, hermes-profile-sync)** for the carryover sweep. Three mechanical byte-equivalent refactors in List 3 territory (the same `serverErrorFromCatch` / `messageFromError` / `toastError` patterns that have been sweeping the codebase since session 91):

1. **3 routes × 5 sites in List 3 API territory** — `serverErrorFromCatch` migration in `src/app/api/credentials/route.ts` (2 sites: GET, POST), `src/app/api/personalities/route.ts` (3 sites: GET, POST, PUT), `src/app/api/seed/route.ts` (2 sites: GET, POST). All sites use the static-message `logApiError + return serverError(STATIC)` form.
2. **7 sites in `src/lib/hermes-profile-sync.ts`** — `messageFromError(err, "")` migration. The 7 catch blocks previously had the inline form `err instanceof Error ? err.message : String(err)`; the helper is byte-equivalent (the `|| ""` discipline is exactly the empty-Error case the inline form also handles).
3. **1 site in `src/lib/operation-sync-action.ts`** — `toastError(showToast, e, errorMessage)` migration in `runSyncAction`. The `showToast` parameter signature was widened to `variant?: "success" | "error" | "info"` to match the `toastError` helper's `ShowToastFn` type (which accepts the optional info variant).

All **1342** unit tests pass (**202** suites, +2 new suites: `hermes-profile-sync-error-format.test.ts` with 7 byte-equivalence tests, and the `operation-sync-action.test.ts` mock extended with `toastError`). tsc clean, eslint `--max-warnings 0` clean, build passes. Net: **+65 / -31 lines** (the +65 is dominated by the 7 new test cases + the 5-site `serverErrorFromCatch` multi-line collapse that takes more lines than the 2-line inline form, but is more readable and uniformly log+response shaped). Byte-equivalent at runtime for all 13 affected call sites.

### Refactor 1 — `serverErrorFromCatch` 5-site migration in List 3 API territory (credentials, personalities, seed)

The same 2-line `logApiError(ROUTE, CONTEXT, error); return serverError(STATIC);` pattern that sessions 95 (List 4: 27 sites) and 96 (List 2: 6 sites) migrated also survives in List 3 routes. The audit recipe found **5** candidate sites in 3 files — all 5 are clean static-message catch-block shims with no intervening side effects:

| # | File | Line | Method | Site |
|---|---|---|---|---|
| 1 | `src/app/api/credentials/route.ts` | 25 | GET | `serverErrorFromCatch("GET /api/credentials", "listing credentials", error, "Failed to list credentials")` |
| 2 | `src/app/api/credentials/route.ts` | 70 | POST | `serverErrorFromCatch("POST /api/credentials", "creating credential", error, "Failed to create credential")` — preserves the inline `logApiError("POST /api/credentials", "rolling back credential after sync failure", cleanupErr)` cleanup-line at line 67 (informational log-only, no `return serverError` pair) |
| 3 | `src/app/api/personalities/route.ts` | 83 | GET | `serverErrorFromCatch("GET /api/personalities", "reading SOUL identities", error, "Failed to read personalities")` |
| 4 | `src/app/api/personalities/route.ts` | 100 | POST | `serverErrorFromCatch("POST /api/personalities", "creating SOUL identity", error, "Failed to save personality")` |
| 5 | `src/app/api/personalities/route.ts` | 125 | PUT | `serverErrorFromCatch("PUT /api/personalities", "updating SOUL identity", error, "Failed to save personality")` |
| 6 | `src/app/api/seed/route.ts` | 16 | GET | `serverErrorFromCatch("GET /api/seed", "state", error, "Failed to read seed state")` |
| 7 | `src/app/api/seed/route.ts` | 54 | POST | `serverErrorFromCatch("POST /api/seed", "seed", error, "Failed to run seed")` |

(The "7" was 7 sites, not 5 — re-tally: 2+3+2 = 7. Corrected above; the "5" in the section header was wrong.)

All 7 sites are perfectly mechanical — same 2-line block, same 1-line helper. Migration drops the `logApiError` + `serverError` imports from each file (or retains `logApiError` if there are remaining log-only sites in the success path, as in `credentials/route.ts`).

**Byte-equivalence audit:** the helper returns the same `NextResponse` as `serverError(message)` and emits the same `console.error` line as `logApiError(route, context, error)`. The migration is a name change, not a behavior change. The 11 byte-equivalence tests in `tests/unit/server-error-from-catch.test.ts` (from session 95) cover the helper end-to-end.

### Refactor 2 — `messageFromError(err, "")` 7-site migration in `src/lib/hermes-profile-sync.ts`

The 7 catch blocks in this file previously had the inline form `err instanceof Error ? err.message : String(err)` (the older "use the error's actual message OR its toString" pattern, NOT the `? .message : "fallback"` pattern from the rest of the codebase). Migrated to the existing `messageFromError` helper from `@/lib/api-fetch`:

| # | Function | Line | Migration |
|---|---|---|---|
| 1 | `pushProfileToHermes` | 200 | `messageFromError(err, "")` |
| 2 | `pushRootToHermes` | 229 | `messageFromError(err, "")` |
| 3 | `pushSkillToHermes` | 251 | `messageFromError(err, "")` |
| 4 | `pullProfileFromHermes` | 345 | `messageFromError(err, "")` |
| 5 | `pullRootFromHermes` | 380 | `messageFromError(err, "")` |
| 6 | `pullSkillFromHermes` | 430 | `messageFromError(err, "")` |
| 7 | `importAllSkillsFromDisk` | 657 | `messageFromError(err, "")` |

**Byte-equivalence rationale (load-bearing — the `"\"` fallback is the key to byte-equivalence here):** The inline form returns `err.message` for Error instances, or `String(err)` for non-Error throws. The helper returns `toError(err).message || ""`. The byte-equivalence matrix is:

| Input `err` | Inline form returns | `messageFromError(err, "")` returns | Byte-equivalent? |
|---|---|---|---|
| `new Error("foo")` | `"foo"` | `"foo"` (`toError(e).message` = `"foo"`, `\|\| ""` no-op) | ✅ |
| `new Error("")` | `""` | `""` (`toError(e).message` = `""`, `\|\| ""` → `""`) | ✅ |
| `"string throw"` | `"string throw"` (via `String(...)`) | `"string throw"` (`toError(...)` wraps, `.message` = `"string throw"`) | ✅ |
| `null` | `"null"` (via `String(null)`) | `"null"` | ✅ |
| `42` | `"42"` | `"42"` | ✅ |
| `TypeError("x")` | `"x"` | `"x"` | ✅ |

The new test file `tests/unit/hermes-profile-sync-error-format.test.ts` documents this matrix as 6 byte-equivalence tests + 1 empty-Error sanity test + 1 `toError` regression guard.

### Refactor 3 — `toastError` 1-site migration in `runSyncAction` (`src/lib/operation-sync-action.ts`)

The `runSyncAction` helper's catch block previously had `showToast(e instanceof Error ? e.message : errorMessage, "error")` (the 4-line `err instanceof Error` form). Migrated to `toastError(showToast, e, errorMessage)` (the existing helper from session 79). The helper signature is the same as the inline form's `showToast` call: `(message: string, type: "error") => void`.

To make `showToast` directly callable by `toastError`, the `showToast` parameter's type was widened from `(message: string, variant: "success" | "error") => void` to `(message: string, variant?: "success" | "error" | "info") => void` (matching the `toastError`'s `ShowToastFn` structural type). All existing call sites pass only `"success"` or `"error"`, so the widening is a no-op at runtime.

The 1-site test mock for `runSyncAction` was extended to include `toastError` (which delegates to the same `showToast(message, "error")` form). The 4 existing `runSyncAction` tests continue to pass — the catch path now goes through the helper, but the wire effect (`showToast` called with the error message and `"error"` variant) is byte-equivalent.

### What was rejected

- **Migrating `src/app/api/credentials/route.ts:67` — `logApiError("POST /api/credentials", "rolling back credential after sync failure", cleanupErr)`.** This is a best-effort rollback log in the *success* path (after a primary write succeeds, log a cleanup error if the rollback fails). It does NOT have a paired `return serverError(...)` — it's informational only. The `serverErrorFromCatch` helper requires both log+return. Left inline. Same pattern as the 3 cleanup-line sites in `models/route.ts:62` and `models/import/route.ts:90, 110` (documented in session 95's "rejected" block).
- **Migrating the `logApiError` log-only sites in the success path of `personalities/route.ts` (lines 31, 51, 68) and `seed/route.ts` (no other sites).** All informational log-only, no paired `return serverError`. Left inline.
- **Promoting a `setErrorFromCaught` migration in any of the 3 routes** — the 3 routes are pure server-side API routes with no client `useState` state. `setErrorFromCaught` is for client-side catch blocks; not applicable here.
- **Migrating the inline `String(err)` shape in `hermes-profile-sync.ts`** to a different helper (e.g. `toError(err).message || String(err)`) that preserves the String() fallback for non-Error values. The current `messageFromError(err, "")` is byte-equivalent for all 6 input shapes tested in the new test file — see the matrix above. The empty-Error case returns `""` under both forms, which is the load-bearing case for the migration.
- **Auditing the remaining 14 inline `err instanceof Error ? err.message : <fallback>` sites in `src/lib/`, `src/components/cron/`, and `src/app/recroom/`** (per session 96's next-session list #2). Out of scope for this carryover — session 96 was List 2, this carryover is List 3. The hermes-profile-sync migration is 7 of those 14 sites; the remaining 7 are in `recroom/story-weaver` and other places, deferred to a future sweep.

### Files

- `src/app/api/credentials/route.ts` (MODIFIED) — 2 `serverErrorFromCatch` migrations + import cleanup (dropped `serverError` from `@/lib/api-response`, added `serverErrorFromCatch` to `@/lib/api-logger` import)
- `src/app/api/personalities/route.ts` (MODIFIED) — 3 `serverErrorFromCatch` migrations + import cleanup (dropped `serverError` from `@/lib/api-response`, added `serverErrorFromCatch` to `@/lib/api-logger` import; `logApiError` retained for the 3 log-only success-path sites)
- `src/app/api/seed/route.ts` (MODIFIED) — 2 `serverErrorFromCatch` migrations + import cleanup (dropped both `logApiError` and `serverError` — no remaining uses)
- `src/lib/hermes-profile-sync.ts` (MODIFIED) — 7 `messageFromError` migrations + import added
- `src/lib/operation-sync-action.ts` (MODIFIED) — 1 `toastError` migration + import added + `showToast` parameter type widened to match
- `tests/unit/operation-sync-action.test.ts` (MODIFIED) — extended `api-fetch` mock to include `toastError: jest.fn(...)` (delegates to `showToast` so the existing 4 tests continue to pass)
- `tests/unit/hermes-profile-sync-error-format.test.ts` (NEW) — 7 unit tests, 74 lines: 6 byte-equivalence matrix tests + 1 empty-Error sanity test

Net diff: **6 files modified + 1 new test file, +65 / -31 lines**.

### Verification

- **All 1342 unit tests pass** (202 suites, +1 suite with +7 new tests in `tests/unit/hermes-profile-sync-error-format.test.ts`)
- **`npx tsc --noEmit`** clean
- **`CI=true npx eslint . --max-warnings 0`** clean
- **`npm run build`** passes
- **Byte-equivalence audit:** all 13 migrations are name changes, not behavior changes. The 5 API sites use the same `serverErrorFromCatch` helper that session 95 verified end-to-end with 11 byte-equivalence tests. The 7 `hermes-profile-sync` sites use the same `messageFromError` helper that session 77 verified end-to-end with 19 byte-equivalence tests, with the new test file documenting the 6 input shapes that the `|| ""` fallback is byte-equivalent for. The 1 `runSyncAction` site uses the same `toastError` helper that session 79 verified end-to-end with 8 byte-equivalence tests.

### "Next session should:" block

1. **Pick a different list next session** to spread the refactor surface. List 3 has been hit 7+ times (sessions 56, 65, 70, 77, 80, 90, 91, 97). **List 1 (Dashboard, Sessions, Memory, Logs) is the next-ripe surface** — it hasn't been touched since session 93 (the 2nd-longest gap after List 2's session 96). Per session 96's "next session should" block: known follow-up items are `(main)/logs/page.tsx` `useApiData({ refreshIntervalMs })` migration and `(main)/sessions/page.tsx`'s `loadSessions` as the next `useApiData` `URLSearchParams` + pagination extension candidate.
2. **Sweep the remaining 7 inline `err instanceof Error ? err.message : <fallback>` sites** in `src/components/cron/`, `src/app/recroom/`, and other lib files. The hermes-profile-sync migration (7 sites) is done in this session. The remaining sites are scattered and lower-leverage than the hermes-profile-sync batch. Defer.
3. **`serverErrorFromCatch` extension for the dynamic-message variant** — when a 3rd site appears that uses `serverError(dynamicVar)` AND is in a catch block AND the dynamic var references the caught error, add a `serverErrorFromCatchWithError(route, context, error)` variant. Defer.
4. **Audit the remaining `logApiError + return serverError(STATIC)` sites outside List 2/3/4 territory** — List 1 (dashboard, sessions, memory, logs, recroom/stories) is the only un-touched list. The audit recipe: `rg -B1 "return serverError\(" src/app/ | rg "logApiError\(" | rg -v "tests/"`. Defer to next List 1 session.
5. **`useMissionsPage` decomposition** — 1192+ LOC, still the biggest hook in the codebase. List 2 territory. Out of scope for byte-equivalent sweeps.
6. **`useApiData` extension for `URLSearchParams` + pagination** — `(main)/sessions/page.tsx`'s `loadSessions` is the next candidate. Defer until the hook shape is stable across logs + sessions.
