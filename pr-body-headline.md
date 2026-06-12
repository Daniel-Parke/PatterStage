# refactor: rolling mission branch

**Full archive:** `pr-body.txt` at HEAD on the `mission/hermes-review-and-refactor` branch. This on-PR body is the headline summary (most recent 5 sessions in full + one-line summary of older sessions).

## Recent sessions (full detail)

## Session 175 — List 1 (Dashboard, Sessions, Memory, Logs) — close session 174 carryover (4 dashboard helpers + safeApiCallData migration in logs)

### What shipped

### Why this is byte-equivalent

The 3 test-file changes are all PURE test changes — no production code was touched in this session. The 2 `topNTemplates` test fixes update fixtures (more inputs) and expected outputs (verified with plain `node`); the 2 source-pattern test flips update assertions to match the post-migration shape. None of the 5 source files touched in session 174 changed in this session.
### Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint . --max-warnings 0`: clean
- `npx jest`: **280 suites / 2091 tests pass** (up from 279/2071 = +1 suite, +20 tests)
- `npm run build`: clean
### Reference doc

Full session writeup: `references/session-175-list1-dashboard-helpers-closeout.md` under the `refactor-sweep-mission` skill.
### Next session should

- **Random pick next session** — the List 1 surface is mined clean at the 4-helper + safeApiCallData envelope-unwrap scope. Other surfaces (Lists 2, 3, 4) have open carryover rows in the rolling PR; the next pick can go to any of them.
- The 3 inline `useEffect` blocks in List 1 are not worth extracting individually (1-page-local, no shared shape). They stay inline.
- If a future pick lands on List 1, the natural next surfaces are: (a) the per-page `useApiData` extension for paginated sessions (session 144 carryover), (b) the inline `console.error` redundancy rule applied to `(main)/logs/page.tsx` and `(main)/sessions/page.tsx` (session 131 P-131-4 carryover), (c) the chat-utils consolidation in `(main)/sessions/[id]/page.tsx` if it has a 3+ sites repeat pattern.

---

## Session 173 — List 3 (Models, Agents, Skills, Tools, Personalities) — `*OrFail` combined-helper extraction across 5 routes + per-surface source-pattern scanner

### What shipped

### Why this is byte-equivalent

`applyProfileOrRootPatchOrFail` is literally `applyProfileOrRootPatch + toPatchResponse + assertPatchSucceeded + return { profile: result.profile }`. The wire shape is preserved across all 3 paths:
- **Success** → `{ profile: "..." }`, same field read as the prior `result.profile`.
- **Not-found** → `NextResponse` with 404 + `{ error: "Profile not found" }`.
- **Push-failed** → `NextResponse` with 500 + either the underlying error string or "Push failed" (set by `pushProfileOrRoot`'s `?? "Push failed"`).
One minor side-effect: the `personalities` route lost a redundant `logApiError` call that was unique to that one route. The push-failed path is still logged via `setProfileSyncStatus` in `pushProfileOrRoot`/`pushRootToHermes`, so the operator-visible diagnostic is preserved.
### Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint . --max-warnings 0`: clean
- `npx jest`: **279 suites / 2071 tests pass** (up from 278/2038 = +1 suite, +33 tests)
- `npm run build`: clean
### Carryover resolution

This session started with a Mode B (verified-but-uncommitted) carryover from the prior session: 5 source files modified + 1 new test file, all green under tsc + eslint + jest + build. The prior session wrote the reference doc (`references/control-hub-list3-or-fail-helper-session-173.md`) but hit the tool-call cap before commit/push. Standard 4-step commit-when-verified protocol applied: verify → commit → push → docs commit.
### Reference doc

Full session writeup: `references/control-hub-list3-or-fail-helper-session-173.md` under the `overnight-refactor-patterns` skill.
### Next session should

- Any list is fair game — this is a clean-exit session with no carryover.
- The `*OrFail` combined-helper pattern is now proven on List 3 — consider applying the same approach to any other "apply helper + check error + assert + return" dance in the codebase (e.g. the `safeApiCall` + `messageFromError` + manual error-string-construction pattern in some client-side code; the `applyMission + pushMission + handleMissionError` pattern in `src/lib/backends/hermes.ts:555` if it has the same shape).

---

## Session 171 — List 1 (Dashboard, Sessions, Memory, Logs) — shared `<LoadErrorBanner>` component + 2-site migration

### What shipped

### Why this is byte-equivalent

The success path is identical (no banner rendered when `loadError` is null). The failure path adds a Retry button — a new affordance, not a behavior change. The error string rendering is byte-equivalent to the inline form (the same `{loadError}` interpolation, the same `text-red-200` colour, the same `border-red-500/30 bg-red-500/10` chrome). The icon swap (`AlertCircle` → `AlertTriangle`) is invisible at the failing-load UX level (both render a 5×5 warning icon at the leading edge of the banner).
### Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint . --max-warnings 0`: clean
- `npx jest`: **277 suites / 2029 tests pass** (up from 272/1977 = +5 suites, +52 tests)
- `npm run build`: clean
### Reference doc

Full session writeup: `references/control-hub-list1-refactor-session-171.md` under the `overnight-refactor-patterns` skill.
### Next session should

- Any list is fair game — this is a clean-exit session with no carryover.
- **List 3 has a real migration opportunity**: the original 3 sites from session 139's umbrella-skill writeup (Skills, Personalities, Config) are all on the operations surface (List 3 territory). A List 3 pick should consider migrating those 3 sites to the same `LoadErrorBanner` component introduced in this session — the contract already pins the import + usage shape, so the migration is a straight `replace_all` once the per-page "open-coded form" is removed.
- Other List 1 follow-ups (deferred):
  - `src/app/(main)/sessions/[id]/page.tsx` — full-page "Session Not Found" UX could be split into load-failure (banner + Retry) vs not-found (full-page)
  - `src/app/page.tsx` (Dashboard) — the multi-section `Promise.allSettled` banner from session 139 P-14 is a different component contract. A future session could extract the per-section banner into a shared component (similar shape to `LoadErrorBanner` but takes a `Record<string, string>` of section errors).
---

---

## Session 170 — List 4 (Models, HERMES.md, Environment, All Settings) — `buildDriftDetails` helper extraction in `/api/models/sync/drift`

### Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint . --max-warnings 0`: clean
- `CI=true npx jest`: **275 suites / 2007 tests pass** (was 274/1999 = +1 suite, +8 tests, matching the 8 new `buildDriftDetails` unit tests)
- `CI=true npx --yes pnpm@10.33.0 build`: clean
### Behaviour change

None. The route handler's response (`{ hasDrift, driftDetails }`) is byte-equivalent to the pre-refactor inline form. The `string[]` ordering (primary first, then Hermes-only, then DB-only) is preserved exactly, as is the exact text format (including the `:` separator in the primary line and the "but not in / not pushed to" wording in the list lines).

---

## Session 169 — List 3 (Models, Agents, Skills, Tools, Personalities) — `skillFilePath` helper extraction + 5-site migration

### Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint src/... --max-warnings 0`: clean
- `npx jest`: **274 suites / 1999 tests pass** (was 273/1995 = +1 suite, +4 tests, matching the 4 new `skillFilePath` unit tests)
- `CI=true npx --yes pnpm@10.33.0 build`: clean
### Behaviour change

None. Every call site is byte-equivalent to the inline form. The `replace(/\\/g, "/")` is a no-op on Linux where catalog keys are forward-slash only.

---

## Older sessions (one-line summary)

- **Session 168** (List 2) — ## Session 168 — List 2 (Cron, Missions, Chat) — `COPY_BTN_CLASS` + `COPY_BTN_DATA_ATTR` magic-strin
- **Session 167** (List 4) — ## Session 167 — List 4 (Models, HERMES.md, Environment, All Settings) — `seedPostSchema` + `parseAn
- **Session 166** (List 3) — ## Session 166 — List 3 (Models, Agents, Skills, Tools, Personalities) — `safeApiCallData<{ profiles
- **Session 165** (List 3) — ## Session 165 — List 3 (Models, Agents, Skills, Tools, Personalities) — Mode I fresh-audit returns 
- **Session 163** (List 3) — ## Session 163 — List 3 (Models, Agents, Skills, Tools, Personalities) — `toastError` migration in `
- **Session 161** (List 3) — ## Session 161 — List 3 (Models, Agents, Skills, Tools, Personalities) — `filterByCaseInsensitiveSub
- **Session 159** (List 1) — ## Session 159 — List 1 (Dashboard, Sessions, Memory, Logs) — close stale `setX(messageFromError)` s
- **Session 158** (List 2) — ## Session 158 — List 2 (Cron, Missions, Chat) — Mode I.1 audit exit: 3 named surfaces OOS for budge
- **Session 155** (List 4) — ## Session 155 — List 4 (Models, HERMES.md, Environment, All Settings) — fix `/api/config` deep-merg
- **Session ?** (List ?) — ## Session 156 — close-out: docs carryover from session 155, no new refactor work
- **Session 154** (List 1) — ## Session 154 — List 1 (Dashboard, Sessions, Memory, Logs) — drop 9 redundant `as RequestInit` cast
- **Session 152** (List 2) — ## Session 152 — List 2 (Cron, Missions, Chat) — `parseCategoryIdOrError` carryover completion
- **Session 148** (List 2) — ## Session 148 — List 2 (Cron, Missions, Chat) — 2 more silent-catch sites in useMissionsPage
- **Session 147** (List 2) — ## Session 147 — List 2 (Cron, Missions, Chat) + List 4 (Settings) — `setErrorFromCaught`/`toastErro
- **Session 144** (List 1) — ## Session 144 — List 1 (Dashboard, Sessions, Memory, Logs) — `toastError` migration in 4 silent-cat
- **Session 143** (List 2) — ## Session 143 — List 2 (Cron, Missions, Chat) — `applyDisabledChange` helper consolidates 3 sites i
- **Session 142** (List 3) — ## Session 142 — List 3 (Models, Agents, Skills, Tools, Personalities) — `toastError` migration in 5
- **Session 137** (List 1) — ## Session 137 — List 1 (Dashboard, Sessions, Memory, Logs) — `safeApiCall<{ data?: { ... } }>` doub
- **Session 135** (List 2) — ## Session 135 — List 2 (Cron, Missions, Chat) — `safeApiCall<{ data?: { ... } }>` double-envelope m
- **Session 135** (List 2) — ## Session 135 — List 2 (Cron, Missions, Chat) — `safeApiCall<{ data?: { ... } }>` double-envelope m
- **Session 129** (List 1) — ## Session 129 — List 1 (Dashboard, Sessions, Memory, Logs) — `serverErrorFromCatch` migration in `a
- **Session ?** (List ?) — ## Session 128 cron carryover — `serverErrorFromError` helper + 4-site migration in `api/cron/hardwa
- **Session 128** (List 1) — ## Session 128 — List 1 (Dashboard, Sessions, Memory, Logs) — `messageFromError` migration in `/api/
- **Session 127** (List 3) — ## Session 127 — List 3 (Models, Agents, Skills, Tools, Personalities) — `serverErrorFromCatch` 6-si
- **Session 126** (List 2) — ## Session 126 — List 2 (Cron, Missions, Chat) — `logCronSyncFailure` helper + 2 site migration + `u
- **Session 125** (List 1) — ## Session 125 — List 1 (Dashboard, Sessions, Memory, Logs) — `serverErrorFromCatch` sweep in `api/{
- **Session 124** (List 4) — ## Session 124 — List 4 (Models, HERMES.md, Environment, All Settings) — `serverErrorFromCatch` in `
- **Session 123** (List 4) — ## Session 123 — List 4 `ok()` factory migration + 4th list-surface test (carryover commit)
- **Session 120** (List 4) — ## Session 120 — List 4 (Models, HERMES.md, Environment, All Settings) — `backupFile` helper adoptio
- **Session ?** (List ?) — ## Session 121 (List 4 carryover cleanup + fresh List 1 audit) — `parseAndValidateJsonBody` helper m
- **Session 122** (List 1) — ## Session 122 — List 1 (Dashboard, Sessions, Memory, Logs) — `useApiData` adoption in session detai
- **Session 119** (List 3) — ## Session 119 — List 3 (Models, Agents, Skills, Tools, Personalities) — `applyProfileOrRootPatch` d
- **Session ?** (List ?) — ## Session 118 carryover (committed at the start of this session) — `openSearchInput` / `closeSearch
- **Session 117** (List 1) — ## Session 117 — List 1 (Dashboard, Sessions, Memory, Logs) — `ok()` factory migration of 3 sites in
- **Session ?** (List ?) — ## Session 116 carryover (committed at the start of this session)
- **Session 113** (List 1) — ## Session 113 — List 1 (Dashboard, Sessions, Memory, Logs) — `ok()` factory migration of 10 sites a
- **Session ?** (List ?) — ## Session 112 carryover — multi-line `ok()` site migration + balanced-brace scanner + closeEditor h
- **Session 111** (List 3) — ## Session 111 — List 3 (Models, Agents, Skills, Tools, Personalities) — `ok()` factory migration of
- **Session 109** (List 4) — ## Session 109 — List 4 (Models, HERMES.md, Environment, All Settings) — `pluralise` carryover compl
- **Session 108** (List 2) — ## Session 108 — List 2 (Cron, Missions, Chat) — `pluralise` helper extraction + 6-site migration
- **Session 107** (List 3) — ## Session 107 — List 3 (Models, Agents, Skills, Tools, Personalities) — `reloadAll` callback consol
- **Session 106** (List 1) — ## Session 106 — List 1 (Dashboard, Sessions, Memory, Logs) — `isMissionActive` helper adoption + da
- **Session 103** (List 3) — ## Session 103 — List 3 (Models, Agents, Skills, Tools, Personalities) — `closeSkillEditor` + `close
- **Session 100** (List 2) — ## Session 100 — List 2 (Cron, Missions) — `closeAgentModal` + `closeSystemModal` + `closeComposer` 
- **Session ?** (List ?) — ## Session 99 — Truncated mid-audit; no refactor shipped (List 4 re-pick)
- **Session 98** (List 4) — ## Session 98 — List 4 (Models, HERMES.md, Environment, All Settings) — `messageFromError` sweep + 2
- **Session 97** (List 3) — ## Session 97 — List 3 (Operations) carryover finalization
- **Session 96** (List 2) — ## Session 96 — List 2 (Cron, Missions, Chat) — `serverErrorFromCatch` 6-site migration + `setErrorF
- **Session 95** (List 4) — ## Session 95 — List 4 (Models, HERMES.md, Environment, All Settings) — `serverErrorFromCatch` helpe
- **Session 94** (List 2) — ## Session 94 — List 2 (Cron, Missions, Chat) — `parseDispatchMode` + `scheduleForDispatch` + `joinC
- **Session 93** (List 1) — ## Session 93 — List 1 (Dashboard, Sessions, Memory, Logs) — `dbSessionFields` + `parseAssistantLine
- **Session 92** (List 4) — ## Session 92 — List 4 (Models, HERMES.md, Environment, All Settings) — `pushDiff` closure refactor 
- **Session 91** (List 3) — ## Session 91 — List 3 (Models, Agents, Skills, Tools, Personalities) — `setErrorFromCaught` helper 
- **Session 90** (List 3) — ## Session 90 — List 3 (Models, Agents, Skills, Tools, Personalities) — 4-site `toastError` migratio
- **Session 132** (List 3) — ## Session 132 — List 3 (Models, Agents, Skills, Tools, Personalities) — `ok()` factory migration of
- **Session ?** (List ?) — ## Session 134 — `fs/list` route factory migration (carryover from previous cron run)
- **Session 133** (List 3) — ## Session 133 — List 3 (Models, Agents, Skills, Tools, Personalities) — `safeApiCallData` migration

---

**Total sessions on this PR:** 62
**Full archive size:** 644178 bytes (`pr-body.txt` at branch HEAD)
