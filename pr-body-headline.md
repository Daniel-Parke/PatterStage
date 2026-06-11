# refactor: rolling mission branch

**Full archive:** `pr-body.txt` at HEAD on the `mission/...` branch.

## Recent sessions
- **Session 161** — List 3: `filterByCaseInsensitiveSubstring` helper + 2-site migration (skills + personalities) + `scheduleDisplayFromParsed` carryover closure

## Session 154 — List 1 (Dashboard, Sessions, Memory, Logs) — drop 9 redundant `as RequestInit` casts in `safeApiCallData`/`safeApiCall` calls


---

## Session 152 — List 2 (Cron, Missions, Chat) — `parseCategoryIdOrError` carryover completion

### What shipped


**1 commit (`b837898`), 2 files, +243 / -15 = +228 net LOC (mostly JSDoc + test file):**

| # | File | LOC | Notes |
|---|------|-----|-------|
| 1 | `src/app/api/missions/route.ts` | +34 / -15 = +19 | 3 callsite migrations (9 lines of inline boilerplate → 6 lines of uniform `if (x instanceof NextResponse) return x;`); new helper `parseCategoryIdOrError` at line 125-133; JSDoc block |
| 2 | `tests/unit/parse-category-id-or-error.test.ts` | +209 (new) | 6 unit tests via `@/app/api/missions/route` POST handler; mocks: `next/server` (real class for `instanceof`), `api-logger` (serverErrorFromCatch), `api-auth` (requireAuth + isChReadOnly), `audit-log`, `mission-repository` (with buildMissionPrompt), `mission-cron-sync`, `sync`, `mission-category-repository` |

### Carryover pickup


Picks up the session 151 carryover: `parseCategoryIdOrError` helper was added (line 125-133 of `src/app/api/missions/route.ts`) and 1 of 3 callsites migrated in session 151 before the tool-call budget hit. This session:

1. Migrated the 2 remaining callsites (promote branch at lines 405-440, update branch at lines 470-503) — same 3-line → 2-line pattern collapse.
2. Renamed the local discriminant `categoryParsed` → `categoryId` at the 2 newly-migrated sites (Mode C.1 break-point: the old name now has 0 references in user-land scopes; the 3 remaining `parseCategoryId` references are: helper def at 96, JSDoc at 118, and the wrapper at 128).
3. Added `tests/unit/parse-category-id-or-error.test.ts` with 6 unit tests covering the full return contract.

### Verification


- `npx tsc --noEmit`: clean
- `npx eslint . --max-warnings 0`: clean
- `npx jest`: 246 suites, 1761 tests pass (up from 245/1755 = +1 suite, +6 tests)
- `npm run build`: clean

### Behaviour change


None. The helper is pure plumbing: same 400 status, same error strings (`"Category not found"`, `"categoryId must be a string"`), same passthrough values.

### Next session should


- Pick a different list. List 2 has been hit 17+ times; session 151 reference names the open surfaces and they are all OOS for the 1-3 commit budget.
- The `isChReadOnly()` 6-site consolidation (session 151 "Next session should" #4) is still open but is a behaviour change (canonical vs bare message) — needs explicit user direction.
- pr-body.txt is now 508+ KB. Future sessions should use the body-compression table pattern (session 137 P-137-1) to keep the rolling body under the 65 KB `gh pr edit --body-file` limit.
- Re-run the union of 9 test-mock pitfall audit recipes on every route that adopts a new test pattern (the new 9th member is the runtime-imports audit).


---

## Session 148 — List 2 (Cron, Missions, Chat) — 2 more silent-catch sites in useMissionsPage

### What shipped


**2 sites migrated, 1 commit (`3417772`), +4 / -4 = 0 net LOC:**

| # | File | Line | Before | After |
|---|------|------|--------|-------|
| 1 | `src/hooks/useMissionsPage.ts` | 765 | `catch { showToast("Network error — please try again", "error") }` | `catch (err) { toastError(showToast, err, "Network error — please try again") }` |
| 2 | `src/hooks/useMissionsPage.ts` | 1062 | `catch { showToast("Network error — could not cancel mission", "error") }` | `catch (err) { toastError(showToast, err, "Network error — could not cancel mission") }` |

Behaviour change: `feature is not working` exception applies — users now see the real fetch error (e.g. "Failed to fetch: ECONNREFUSED") instead of a static placeholder. The `toastError` helper was already imported (session 55) and already used at 2 sibling sites in session 147.

### Verification


- `npx tsc --noEmit`: clean
- `npx eslint`: clean

### Next session should


- `useMissionsPage` is now **mined clean** of `toastError` migration opportunities (6 sibling sites all migrated across sessions 147 + 148).
- **List 3** is the next-ripe surface — last touched session 142 (`toastError` in 5 catch blocks). Pre-audit candidate surfaces for the next List 3 pick: (a) any new `catch { showToast(static) }` anti-patterns in `src/app/operations/{models,agents,skills,tools,personalities}/`, (b) `requireSafeProfileName` audit in models/tools/personalities routes (currently only profiles + skills adopted), (c) `useMemo` opportunities in `src/app/operations/{models,agents,skills,tools,personalities}/page.tsx` (per session 51 P-4 + P-5 lessons).


---

## Session 147 — List 2 (Cron, Missions, Chat) + List 4 (Settings) — `setErrorFromCaught`/`toastError` silent-catch sweep + `requireSafeProfileName` helper

### What shipped


**3 commits, 11 files, +140 / -52 = +88 net LOC (3 new helper files, 5 new test blocks):**

| # | Commit | Scope | Files | LOC | Notes |
|---|--------|-------|-------|-----|-------|
| 1 | `b0a5d93` | List 2: `setErrorFromCaught`/`toastError` in 3 silent-catch sites | 3 | +12/-9 | `DirectoryPickerModal`, `ModelPicker`, `useMissionsPage` (2 sites) |
| 2 | `c6441e6` | List 4: `requireSafeProfileName` helper + 1 site migration | 2 | +47/-9 | New helper in `path-security.ts`, 5 new unit tests |
| 3 | `f8879dc` | List 4: `requireSafeProfileName` adoption in 6 routes + 3 test mocks | 6 | +81/-34 | Migration finalization |

**What was migrated:**

- **List 2 (3 sites):** `src/components/missions/DirectoryPickerModal.tsx`, `src/components/missions/ModelPicker.tsx`, `src/hooks/useMissionsPage.ts` (2 sites). All `.catch(() => setX("Network error"))` patterns → `setErrorFromCaught(setX, err, "Network error")`. Behaviour change: users now see the real fetch error message instead of a static placeholder.
- **List 4 (7 sites):** `requireSafeProfileName` helper in `src/lib/path-security.ts:84-103` consolidates the 4-line `const slug = name; if (/pattern/.test(slug)) return badRequest(...); if (slug.includes('/')) return badRequest(...); ...` prelude. Adopted in `agent/profiles/route.ts`, `agent/profiles/[id]/route.ts` (×2), `agent/profiles/[id]/toolsets/route.ts` (×2), `personalities/route.ts`, `skills/[name]/toggle/route.ts`, `skills/route.ts` (slug-from-name variant). 5 new unit tests in `tests/unit/path-security.test.ts` cover null input, valid name, path traversal, slashes, leading-hyphen.

**Test mock updates:**

- `tests/unit/profiles-api.test.ts`: added `serverErrorFromCatch` mock (pre-existing Mode E bug from session 147 commit) + `requireSafeProfileName` to `path-security` mock.
- `tests/unit/skills-toggle-auth.test.ts`: added `requireSafeProfileName` to `path-security` mock.

**Outliers kept inline (per P-147-7):**

- `agent/profiles/[id]/route.ts` keeps `resolveSafeProfileName` for the inner rename branch (consumes the `{ok, profile}` union, not the `{profile}|NextResponse` narrowing shape).
- `agent/files/[key]/route.ts` (3 callsites) keeps the graceful fallback (`prof.ok ? prof.profile : 'default'`) — doesn't fit the 400-on-invalid helper shape.

### Verification


- `npx tsc --noEmit`: clean
- `npx eslint`: clean (10 files touched)
- `npx jest`: 1755/1755 pass (38 in 5 carryover-affected suites)

### Next session should


- **List 2** is now mined clean for the `toastError`/`setErrorFromCaught` family. Pick a different surface.
- **List 4** is mined clean for `requireSafeProfileName` (6 sites migrated, 4 kept inline per P-147-7).
- The 3 remaining List 4 candidate surfaces (per session-145): (a) `providerSchema` zod v4 widening cast in `api-schemas.ts:21` (eliminates 4 downstream `as HermesProvider` casts), (b) `TASK_TYPES.filter((t) => t !== "agent")` promotion to `AUXILIARY_TASK_TYPES` (3 sites), (c) the `useMissionsPage` "Missions are not working" loadError treatment.


---

## Session 144 — List 1 (Dashboard, Sessions, Memory, Logs) — `toastError` migration in 4 silent-catch sites

### What shipped


**4 sites migrated, +11 / -10 = +1 net LOC, 1 commit (`ff33d61`):**

| # | File | Line | Before | After |
|---|------|------|--------|-------|
| 1 | `src/app/page.tsx` | 272 | `catch { showToast("Failed to cancel mission", "error") }` | `catch (err) { toastError(showToast, err, "Failed to cancel mission") }` |
| 2 | `src/app/page.tsx` | 317 | `catch { showToast("Failed to update cron schedule", "error") }` | `catch (err) { toastError(showToast, err, "Failed to update cron schedule") }` |
| 3 | `src/app/(main)/logs/page.tsx` | 91 | `catch { setActionMessage("Delete failed (network error)") }` | `catch (err) { setActionMessage(messageFromError(err, "Delete failed (network error)")) }` |
| 4 | `src/app/(main)/sessions/page.tsx` | 329 | `if (loadError) showToast("Failed to load sessions", "error")` | `if (loadError) showToast(loadError, "error")` |

The dashboard sites use the existing `toastError(showToast, err, fallback)` helper from `@/lib/api-fetch` (composes `messageFromError`). The logs page uses `messageFromError` directly because `setActionMessage` is the page's own `useState` setter (not the `showToast` signature). The sessions page uses `useApiData`'s `loadError` string directly (the hook already applies `setErrorFromCaught` internally, so `loadError` is a real diagnostic string or `null` — the previous "Failed to load sessions" replacement was throwing away the real value).

### Behaviour change


Documented per session 142 P-142-1's "feature is not working" exception. Sites 1-3 (dashboard, logs) and site 4 (sessions) all surface the real fetch error to the user instead of a static placeholder. Strict improvement (always-broken → works), not a semantic shift. Each site is a regression target via the `toastError` / `messageFromError` helper unit tests (already in `tests/unit/api-fetch.test.ts`); the `loadError` site is locked by the `useApiData` contract (any change to the hook that re-introduces the static-placeholder smell would need to also update the page consumers, which the source-pattern test pins).

### Verification


- `npx tsc --noEmit` — clean
- `CI=true npx eslint src/app/page.tsx src/app/(main)/logs/page.tsx src/app/(main)/sessions/page.tsx --max-warnings 0` — clean
- `npx jest` — **244 suites / 1715 tests pass** (no regressions)
- `npm run build` — clean
- `git push origin mission/hermes-review-and-refactor` — succeeded (`3243c41..ff33d61`)

### Next session should


Random pick next session: pick AT RANDOM. Session 144 already swept the most actionable List 1 surface; future List 1 picks should re-audit with the current 2-line audit recipe `rg -nB 1 'showToast\("Failed to' src/app/ -g "*.tsx" | rg -B 1 'loadError'` to confirm zero hits, then either pick another list OR find new refactor opportunities outside the `toastError`/`messageFromError`/`setErrorFromCaught` family. Per the session 144 carryover, the next session is also expected to:

1. Complete the carryover docs phase first (per carryover protocol).
2. Then do 1 small-bore refactor in whatever list gets picked.
3. End at ≤ 3 commits total per session.

---


---

## Session 143 — List 2 (Cron, Missions, Chat) — `applyDisabledChange` helper consolidates 3 sites in `api/cron/hardware/route.ts`

### What shipped


**1 file, +18 / -6 net (helper + 3 call-site consolidations):**

`src/app/api/cron/hardware/route.ts`:
- Added `applyDisabledChange(disabledIds, id, enabled)` helper (composes the existing `setDisabled` tri-state mutation with `saveDisabledIds` disk write) — sister-helper of session 35's `applyEnabledChange`
- PUT toggle-only branch (line 442-443): 2 lines → 1 line
- PUT post-write sync (line 456-458): 4 lines (if-guard + 2 lines) → 2 lines (if-guard + 1 line)
- DELETE (line 508-509): 2 lines (delete + save) → 1 line (`applyDisabledChange(disabledIds, id, true)`)

The DELETE migration uses the same helper with `enabled: true` — `setDisabled(disabledIds, id, true)` hits the `else` branch which is `disabledIds.delete(id)`, byte-equivalent to the original `disabledIds.delete(id)` + `saveDisabledIds(disabledIds)`.

**Byte-equivalence proof:** every call site:
- Before: `setDisabled(d, i, e); saveDisabledIds(d);` (or the DELETE variant `d.delete(i); saveDisabledIds(d);` which is `setDisabled(d, i, true); saveDisabledIds(d);`)
- After: `applyDisabledChange(d, i, e);` → expands to `setDisabled(d, i, e); saveDisabledIds(d);`
- The `if (enabled !== undefined)` guard on the PUT post-write sync site is preserved — when undefined, the helper is not called (matches the original `if (enabled !== undefined) { setDisabled(...); saveDisabledIds(...); }` block).

### Verification


- `npx tsc --noEmit` — clean
- `CI=true npx eslint src/app/api/cron/hardware/route.ts --max-warnings 0` — clean
- `npx jest tests/unit/cron-hardware-api.test.ts tests/unit/server-error-from-error-source-patterns.test.ts` — 2 suites / 9 tests pass
- `npx jest` — **244 suites / 1715 tests pass** (no regressions)
- `npm run build` — clean

### Behaviour change


None. Every call site is byte-equivalent to the original 2-line pattern.

### Next session should


List 2 byte-equivalent surface is largely mined clean after session 128 (`serverErrorFromError`), session 135 (cast cleanup), and this session (`applyDisabledChange`). Other List 2 areas worth a re-audit:
- `useMissionsPage.ts` (1324 LOC) — the cast-cleanup pass is done; further byte-equivalent work is limited to the chat page's `updateSessionField` helper (defer until 3rd consumer) and `formatModelName`/`loadSessions` test coverage (defer to a dedicated chat-utils test session).
- `api/missions/route.ts` `serverError(result.error ?? "unknown error")` × 3 sites at lines 348/434/491 — the `bareServerError` pattern from session 131 P-3. Could be extracted to a `serverErrorFromHelperResult(result, fallback)` sister-helper.
- The `useMissionsPage.ts` decomposition is still out of scope for byte-equivalent refactors (would need a dedicated decomposition session).

---


---

## Session 142 — List 3 (Models, Agents, Skills, Tools, Personalities) — `toastError` migration in 5 operation-page catch blocks

### What shipped


**5 catch-block migrations, 0 net LOC:**

| File | Line | Before | After |
|------|------|--------|-------|
| `src/app/operations/agents/page.tsx` | 167 | `catch { showToast("Failed to load profiles", "error") }` | `catch (err) { toastError(showToast, err, "Failed to load profiles") }` |
| `src/app/operations/agents/page.tsx` | 296 | `catch { showToast("Failed to save file", "error") }` | `catch (err) { toastError(showToast, err, "Failed to save file") }` |
| `src/app/operations/skills/page.tsx` | 149 | `catch { showToast("Failed to load skills", "error") }` | `catch (err) { toastError(showToast, err, "Failed to load skills") }` |
| `src/app/operations/skills/page.tsx` | 234 | `catch { showToast("Failed to load skill", "error") }` | `catch (err) { toastError(showToast, err, "Failed to load skill") }` |
| `src/app/operations/personalities/page.tsx` | 269 | `catch { showToast("Failed to load personalities", "error") }` | `catch (err) { toastError(showToast, err, "Failed to load personalities") }` |

All 5 sites adopt the `toastError(showToast, err, fallback)` helper from `@/lib/api-fetch` (composes `messageFromError(err, fallback)`).

### Verification


- `npx tsc --noEmit` — clean
- `CI=true npx eslint src/app/operations/{agents,skills,personalities}/page.tsx --max-warnings 0` — clean
- `npx jest` — 244 suites / 1715 tests pass (no regressions)
- `npm run build` — clean

### Next session should


These 5 sites were the only remaining inline `catch { showToast("Failed to X") }` pattern in `src/app/operations/*`. Other List 3 areas to consider:
- `src/app/api/agents/route.ts:61-64` — single dynamic-message `serverError` site (the `String(err)` variant flagged in session 130's carryover). Migrate to `serverErrorFromError("GET /api/agents", "querying Hermes processes", err, "Failed to query Hermes processes")`.
- `src/app/api/models/fallbacks/sync/route.ts` — the bare-msg migration flagged in session 130.
- `useModelsPage` / `useSkillsPage` / `usePersonalities` hooks for any remaining byte-equivalent refactors.

---


---

## Session 137 — List 1 (Dashboard, Sessions, Memory, Logs) — `safeApiCall<{ data?: { ... } }>` double-envelope migration in HindsightBrowser + source-pattern test


## Older sessions (one-line summary)

- **Session 135 — List 2 (Cron, Missions, Chat) — `safeApiCall<{ data?: { ... } }>` double-envelope migration in 6 List 2 files — `safeApiCall<{ data?: { ... } }>` double-envelope migration in 6 List 2 files
- **Session 135 — List 2 (Cron, Missions, Chat) — `safeApiCall<{ data?: { ... } }>` double-envelope migration in 6 List 2 files — `safeApiCall<{ data?: { ... } }>` double-envelope migration in 6 List 2 files
- **Session 129 — List 1 (Dashboard, Sessions, Memory, Logs) — `serverErrorFromCatch` migration in `api/sessions/[id]/route.ts` (1 site) — `serverErrorFromCatch` migration in `api/sessions/[id]/route.ts` (1 site)
- **Session 128 cron carryover — `serverErrorFromError` helper + 4-site migration in `api/cron/hardware/route.ts` — ## Session 128 cron carryover — `serverErrorFromError` helper + 4-site migrat...
- **Session 128 — List 1 (Dashboard, Sessions, Memory, Logs) — `messageFromError` migration in `/api/memory/hindsight` + HindsightBrowser form-reset consolidation — `messageFromError` migration in `/api/memory/hindsight` + HindsightBrowser fo...
- **Session 127 — List 3 (Models, Agents, Skills, Tools, Personalities) — `serverErrorFromCatch` 6-site List 3 migration + List 3 source-pattern surface assertion — `serverErrorFromCatch` 6-site List 3 migration + List 3 source-pattern surfac...
- **Session 126 — List 2 (Cron, Missions, Chat) — `logCronSyncFailure` helper + 2 site migration + `useApiData` `setErrorFromCaught` — `logCronSyncFailure` helper + 2 site migration + `useApiData` `setErrorFromCa...
- **Session 125 — List 1 (Dashboard, Sessions, Memory, Logs) — `serverErrorFromCatch` sweep in `api/{sessions,logs,monitor}/` — `serverErrorFromCatch` sweep in `api/{sessions,logs,monitor}/`
- **Session 124 — List 4 (Models, HERMES.md, Environment, All Settings) — `serverErrorFromCatch` in `fs/git/branches/route.ts` — `serverErrorFromCatch` in `fs/git/branches/route.ts`
- **Session 123 — List 4 `ok()` factory migration + 4th list-surface test (carryover commit) — ## Session 123 — List 4 `ok()` factory migration + 4th list-surface test (car...
- **Session 120 — List 4 (Models, HERMES.md, Environment, All Settings) — `backupFile` helper adoption in config PUT + `CardLink` primitive + `raw fetch → apiFetch` migration — `backupFile` helper adoption in config PUT + `CardLink` primitive + `raw fetc...
- **Session 121 (List 4 carryover cleanup + fresh List 1 audit) — `parseAndValidateJsonBody` helper migration across 15 List 4 routes + 4 test-mock updates + new List 1 audit — ## Session 121 (List 4 carryover cleanup + fresh List 1 audit) — `parseAndVal...
- **Session 122 — List 1 (Dashboard, Sessions, Memory, Logs) — `useApiData` adoption in session detail page (final List 1 surface refactor) — `useApiData` adoption in session detail page (final List 1 surface refactor)
- **Session 119 — List 3 (Models, Agents, Skills, Tools, Personalities) — `applyProfileOrRootPatch` delegation + `openCreate` callback + `effectiveSkillEnabled` helper — `applyProfileOrRootPatch` delegation + `openCreate` callback + `effectiveSkil...
- **Session 118 carryover (committed at the start of this session) — `openSearchInput` / `closeSearchInput` / `jumpToLatestLines` / `dismissActionMessage` / `openAddModal` / `closeAddModal` / `openDirectiveModal` / `closeDirectiveModal` / `openModelModal` / `closeModelModal` / `closeEditDirective` / `closeEditModel` / `clearRoleFilter` / `handleRoleBadgeClick` (List 1 — logs + memory + sessions) — ## Session 118 carryover (committed at the start of this session) — `openSear...
- **Session 117 — List 1 (Dashboard, Sessions, Memory, Logs) — `ok()` factory migration of 3 sites in `api/memory/hindsight/route.ts` — `ok()` factory migration of 3 sites in `api/memory/hindsight/route.ts`
- **Session 116 carryover (committed at the start of this session) — ## Session 116 carryover (committed at the start of this session)
- **Session 113 — List 1 (Dashboard, Sessions, Memory, Logs) — `ok()` factory migration of 10 sites across 3 files + List 1 source-pattern test — `ok()` factory migration of 10 sites across 3 files + List 1 source-pattern test
- **Session 112 carryover — multi-line `ok()` site migration + balanced-brace scanner + closeEditor helper — ## Session 112 carryover — multi-line `ok()` site migration + balanced-brace ...
- **Session 111 — List 3 (Models, Agents, Skills, Tools, Personalities) — `ok()` factory migration of 31 sites across 18 files — `ok()` factory migration of 31 sites across 18 files
- **Session 109 — List 4 (Models, HERMES.md, Environment, All Settings) — `pluralise` carryover completion + 12-site migration — `pluralise` carryover completion + 12-site migration
- **Session 108 — List 2 (Cron, Missions, Chat) — `pluralise` helper extraction + 6-site migration — `pluralise` helper extraction + 6-site migration
- **Session 107 — List 3 (Models, Agents, Skills, Tools, Personalities) — `reloadAll` callback consolidation in tools page — `reloadAll` callback consolidation in tools page
- **Session 106 — List 1 (Dashboard, Sessions, Memory, Logs) — `isMissionActive` helper adoption + dashboard `setDataFields` direct-call → `setData` partial-setter consolidation — `isMissionActive` helper adoption + dashboard `setDataFields` direct-call → `...
- **Session 103 — List 3 (Models, Agents, Skills, Tools, Personalities) — `closeSkillEditor` + `closeDelete` + `openAddModel` 1-setter callbacks + ModelEditor `setSaving(false)` finally-block bug fix + useModelsPage `messageFromError` migration — `closeSkillEditor` + `closeDelete` + `openAddModel` 1-setter callbacks + Mode...
- **Session 100 — List 2 (Cron, Missions) — `closeAgentModal` + `closeSystemModal` + `closeComposer` page-local callbacks + `setErrorFromCaught` 1-site — `closeAgentModal` + `closeSystemModal` + `closeComposer` page-local callbacks...
- **Session 99 — Truncated mid-audit; no refactor shipped (List 4 re-pick) — ## Session 99 — Truncated mid-audit; no refactor shipped (List 4 re-pick)
- **Session 98 — List 4 (Models, HERMES.md, Environment, All Settings) — `messageFromError` sweep + 27-site `serverErrorFromCatch` completion — `messageFromError` sweep + 27-site `serverErrorFromCatch` completion
- **Session 97 — List 3 (Operations) carryover finalization — ## Session 97 — List 3 (Operations) carryover finalization
- **Session 96 — List 2 (Cron, Missions, Chat) — `serverErrorFromCatch` 6-site migration + `setErrorFromCaught` 1-site + `rememberLastCategory` + `handleCloseCreate` — `serverErrorFromCatch` 6-site migration + `setErrorFromCaught` 1-site + `reme...
- **Session 95 — List 4 (Models, HERMES.md, Environment, All Settings) — `serverErrorFromCatch` helper + 27-site migration — `serverErrorFromCatch` helper + 27-site migration
- **Session 94 — List 2 (Cron, Missions, Chat) — `parseDispatchMode` + `scheduleForDispatch` + `joinCrontabLines` helpers — `parseDispatchMode` + `scheduleForDispatch` + `joinCrontabLines` helpers
- **Session 93 — List 1 (Dashboard, Sessions, Memory, Logs) — `dbSessionFields` + `parseAssistantLines` helpers + `MessageBubble` `fnName` reuse — `dbSessionFields` + `parseAssistantLines` helpers + `MessageBubble` `fnName` ...
- **Session 92 — List 4 (Models, HERMES.md, Environment, All Settings) — `pushDiff` closure refactor in 2 routes — `pushDiff` closure refactor in 2 routes
- **Session 91 — List 3 (Models, Agents, Skills, Tools, Personalities) — `setErrorFromCaught` helper + 9-site migration — `setErrorFromCaught` helper + 9-site migration
- **Session 90 — List 3 (Models, Agents, Skills, Tools, Personalities) — 4-site `toastError` migration in operations pages — 4-site `toastError` migration in operations pages
- **Session 132 — List 3 (Models, Agents, Skills, Tools, Personalities) — `ok()` factory migration of 3 missed sites + filter-scope-mismatch fix — `ok()` factory migration of 3 missed sites + filter-scope-mismatch fix
- **Session 134 — `fs/list` route factory migration (carryover from previous cron run) — ## Session 134 — `fs/list` route factory migration (carryover from previous c...
- **Session 133 — List 3 (Models, Agents, Skills, Tools, Personalities) — `safeApiCallData` migration in `useModelsPage.ts` + source-pattern test — `safeApiCallData` migration in `useModelsPage.ts` + source-pattern test
