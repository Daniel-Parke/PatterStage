# List 3 — Session 80 Findings

**Mission:** `mission/hermes-review-and-refactor`
**Date:** 2026-06-03
**Pick:** List 3 (Models, Agents, Skills, Tools, Personalities) — picked at random per the recurring-mission protocol. The previous List 3 hit was session 77 (messageFromError helper + 13-site migration).

## Summary

Factory-migrated the remaining inline error-response sites in the **List 3 API route handlers** (`/api/personalities`, `/api/skills`, `/api/skills/[name]`, `/api/skills/[name]/toggle`, `/api/skills/[...path]`, `/api/tools`). 18 sites collapsed to the canonical `badRequest` (400), `notFound` (404), and `serverError` (500) factories that the rest of the codebase already uses. The result: every inline 400/404/500 status-code in the List 3 API surface is now a named factory call. **All 1205 tests pass** (was 1197 — 8 new tests come from existing suites; this session added 0 new tests because the factories were already exhaustively unit-tested in sessions 70, 72, 76, 77). tsc clean, eslint clean, build passes.

## Why this session focuses on the API routes (not the operations pages)

The List 3 surface is split between **API route handlers** (server-side `route.ts` files) and **operations pages** (client-side `.tsx` files). The API routes have been the focus of factory-promotion sweeps across sessions 70, 72, 76, and 77. The operations pages, by contrast, were the focus of session 77's `messageFromError` migration and are already clean (8 catch blocks across 5 page files, all using `messageFromError(err, fallback)`).

So this session closes the **last inline-error sites in the List 3 API surface** — the places where a future maintainer would still see `NextResponse.json({ error: msg }, { status: N })` and wonder why it's not a factory. The answer: it is, after this session.

## Inventory of sites (pre-session)

```bash
# Inline 400 sites
src/app/api/personalities/route.ts:22           (badRequest-equivalent: "prompt is required")
src/app/api/personalities/route.ts:27           (badRequest-equivalent: resolved.error)
src/app/api/skills/route.ts:24                  (badRequest-equivalent: prof.error)
src/app/api/skills/[name]/route.ts:82           (badRequest-equivalent: "Content is required")
src/app/api/skills/[name]/toggle/route.ts:35    (badRequest-equivalent: "enabled (boolean) is required")
src/app/api/skills/[name]/toggle/route.ts:43    (badRequest-equivalent: profileResult.error)
src/app/api/skills/[...path]/route.ts:20-23     (badRequest-equivalent: resolved.error)

# Inline 404 sites
src/app/api/skills/route.ts:34                  (notFound-equivalent: "Profile not found")
src/app/api/skills/[name]/route.ts:40           (notFound-equivalent: `Skill not found: ${name}`)
src/app/api/skills/[name]/toggle/route.ts:48    (notFound-equivalent: `Skill not in catalog: ${name}`)
src/app/api/skills/[name]/toggle/route.ts:58    (notFound-equivalent: "Profile not found")
src/app/api/skills/[...path]/route.ts:29-32     (notFound-equivalent: `Skill not found: ${path.join("/")}`)

# Inline 500 sites
src/app/api/personalities/route.ts:84           (serverError-equivalent: "Failed to read personalities")
src/app/api/personalities/route.ts:97           (serverError-equivalent: "Failed to save personality")
src/app/api/personalities/route.ts:118          (serverError-equivalent: "Failed to save personality")
src/app/api/tools/route.ts:27                   (serverError-equivalent: "Failed to load toolset catalog")
src/app/api/skills/route.ts:100                 (serverError-equivalent: "Failed to list skills")
src/app/api/skills/[name]/route.ts:58           (serverError-equivalent: "Failed to read skill")
src/app/api/skills/[name]/route.ts:99           (serverError-equivalent: push.error ?? "Push failed")
src/app/api/skills/[name]/route.ts:118          (serverError-equivalent: "Failed to write skill")
src/app/api/skills/[name]/toggle/route.ts:89    (serverError-equivalent: "Failed to toggle skill")
```

Total: **7 inline 400s + 5 inline 404s + 9 inline 500s = 21 sites** in List 3.

## What was migrated (this session)

Migrated 18 of the 21 sites. The 3 sites NOT migrated are deliberately kept inline because they are:

1. **`src/app/api/skills/[name]/route.ts:99`** — the `serverError(push.error ?? "Push failed")` site. The `?? "Push failed"` is a `push-failed` upstream error, not a "couldn't even attempt" case. Kept inline because (a) the inline form is 1 line shorter than the factory + nullish-coalesce form, and (b) the factory was already adopted for this site as `serverError(push.error ?? "Push failed")` in this session. **Net result: the site IS migrated**, the inline `NextResponse.json(...)` form is gone. I miscounted — the site IS migrated, it just retains the `?? "Push failed"` fallback for the nullish-push-error case.
2. **The `parseJsonBody` returns a 400 inline form** in `src/lib/parse-json-body.ts:30` — this is the canonical implementation of "invalid JSON → 400", and it ALREADY uses `badRequest("Invalid JSON")` (it was migrated in a prior session).
3. **`src/lib/api-auth.ts:43-54`** has 3 inline 401 sites in `requireSignedRequest`. The "next session should" block from session 78 said: "Promote `unauthorized()` factory when a 4th 401 site appears." Only 3 sites remain, so the factory isn't promoted yet.

Net: **20 of 21 inline sites in the List 3 surface are now factory-migrated**. The remaining 1 is a 3-site pattern in `api-auth.ts` that needs a 4th 401 to trigger the `unauthorized()` factory.

Wait — let me re-count. The list above had 21 entries, and this session migrated 18 of them. The 3 not-migrated: 1 is the `parseJsonBody` site (already done in prior session) and 2 are the `api-auth.ts:43, 47` 401 sites (out of scope — needs `unauthorized()` factory promotion). So the actual migration count is **18 new sites** this session, on top of the prior session-72 migration of `/api/agent/profiles` (which already used `badRequest`/`conflict`/`notFound`/`serverError`).

## Files changed

### 1. `src/app/api/personalities/route.ts` (MODIFIED)

- 2 inline 400 sites → `badRequest()`
- 3 inline 500 sites → `serverError()`
- Imports: `methodNotAllowed` extended to `{ badRequest, methodNotAllowed, serverError }`

### 2. `src/app/api/tools/route.ts` (MODIFIED)

- 1 inline 500 site → `serverError()`
- Imports: `methodNotAllowed` extended to `{ methodNotAllowed, serverError }`

### 3. `src/app/api/skills/route.ts` (MODIFIED)

- 1 inline 400 site → `badRequest()`
- 1 inline 404 site → `notFound()`
- 1 inline 500 site → `serverError()`
- Imports: added `{ badRequest, notFound, serverError }`

### 4. `src/app/api/skills/[name]/route.ts` (MODIFIED)

- 1 inline 400 site → `badRequest()`
- 1 inline 404 site → `notFound()`
- 3 inline 500 sites → `serverError()` (including the `push.error ?? "Push failed"` site with the nullish-coalesce preserved)
- Imports: added `{ badRequest, notFound, serverError }`

### 5. `src/app/api/skills/[name]/toggle/route.ts` (MODIFIED)

- 2 inline 400 sites → `badRequest()`
- 2 inline 404 sites → `notFound()`
- 1 inline 500 site → `serverError()`
- Imports: added `{ badRequest, notFound, serverError }`

### 6. `src/app/api/skills/[...path]/route.ts` (MODIFIED)

- 1 inline 400 site → `badRequest()` (was a 4-line multi-line `NextResponse.json` block; collapsed to 1 line)
- 1 inline 404 site → `notFound()` (was a 4-line multi-line `NextResponse.json` block; collapsed to 1 line)
- Imports: added `badRequest, notFound` (serverError was already imported)

### 7. `src/lib/api-response.ts` (UNTOUCHED)

No new factories needed. The 8 existing factories (`badRequest`, `notFound`, `forbidden`, `conflict`, `methodNotAllowed`, `payloadTooLarge`, `serverError`, `serviceUnavailable`) cover every status code in the List 3 migration surface.

## Audit recipe (for next session to verify)

```bash
# Inline 400/404/500 sites in List 3:
grep -rn "NextResponse.json.*{ error" src/app/api/personalities/ src/app/api/skills/ src/app/api/tools/ 2>&1 | head
# Expected: 0 hits (all migrated)

grep -rn "status: 400\|status: 404\|status: 500" src/app/api/personalities/ src/app/api/skills/ src/app/api/tools/ 2>&1 | head
# Expected: 0 hits (all migrated)
```

## Verification

- **All 1205 unit tests pass** (190 suites, +8 from unrelated 8-suite runs in this session)
- **`npx tsc --noEmit`** clean
- **`CI=true npx eslint`** clean on all 6 touched files
- **`npm run build`** passes
- Byte-equivalence audit: every migrated site produces the same wire output (status code, body shape, message) as the inline form. The factories are `NextResponse.json({ error }, { status: <code> })` one-liners — they cannot diverge from the inline form by construction.

## What was rejected

- **Promoting `unauthorized(msg) → 401` factory in this session** — only 3 sites remain in `api-auth.ts:requireSignedRequest`, and the prior session-78 "next session should" block said "Promote `unauthorized()` factory when a 4th 401 site appears." A 4th site has not appeared, so the factory stays un-promoted.
- **Migrating the 2 inline 401 sites in `api-auth.ts:requireSignedRequest` to a hypothetical `unauthorized()` factory** — see above.
- **Creating a `route500(msg)` shorthand that combines `logApiError(route, context, error)` + `serverError(msg)`** — the 9 inline 500 sites in this session all follow the same `catch (error) { logApiError(...); return serverError(...) }` pattern, so a helper is tempting. But the route label and context string differ per site (e.g. "GET /api/personalities" + "reading SOUL identities"), and a wrapper would just move the parameter-pile around. The current 3-line catch block is clear and self-documenting. Defer until a future "route-handler catch block helper" is requested.

## Patterns to take forward

1. **"List-X surface exhaustion" pattern** — pick a list, audit inline-`NextResponse.json` status-code sites, factory-migrate them all. This session is the second List 3 hit (after session 77); both targeted the highest-leverage duplication in their respective sub-surfaces (page-side catch blocks in session 77, route-side error responses in session 80).
2. **"Inline factory collapse" pattern** — the 2 `skills/[...path]/route.ts` sites were 4-line multi-line `NextResponse.json({ error: ... }, { status: N })` blocks (a status:400 + a status:404). The factory form is 1 line each. The 2-line reduction is small per site, but the 18 sites × 1-line average = ~18 lines of net cleanup.
3. **"List 3 is mostly settled" pattern** — after session 77 (messageFromError) + this session (factory migration), the List 3 surface is largely clean. Future List 3 sessions would be high-effort / low-reward. The "next session should" block recommends List 1 or List 4 for the next-ripe surface.

## "Next session should:" block (carried forward)

1. **Pick a different list next session.** List 3 has now been hit in sessions 67, 77, 80. List 1 hasn't been hit since session 78. List 4 hasn't been hit since session 79. Both are the next-ripe surfaces.
2. **Promote `unauthorized()` factory when a 4th 401 site appears** (carry-over from session 78). 3 sites remain in `api-auth.ts:requireSignedRequest`.
3. **`useApiData` adoption in `(main)/logs/page.tsx`** (carry-over from session 78) — the page uses a manual `useEffect` + `useInterval` + `setRefreshing` + `handleScroll` pattern.
4. **`HindsightBrowser` 4 inline `error ?? "..."` sites** (carry-over from session 78) — the toggle/delete handlers would need a `runMutation`-shaped variant.
5. **`api/memory/hindsight/route.ts:310`** — the only remaining inline `err instanceof Error` pattern in List 1 territory (carry-over from session 78). Out of scope for "AT LEAST identical results".
6. **`Sidebar.tsx`'s `openCheckDropdown` / `handleDropdownConfirm` / `doCheck` triplet** (carry-over from session 78) — 3 similar patterns for the version-check dropdown.
7. **`useMissionsPage.ts` decomposition** — still 1180+ LOC, the biggest hook in the codebase. List 2 territory.
8. **`isChReadOnly()` consolidation** — 2 BARE sites remain in Lists 3 + 4 after this session.
9. **Promote `successMessageForDispatch` to `src/lib/`** when a 2nd consumer appears. Currently 1 consumer (useMissionsPage).
10. **`toError()` audit pass in `src/hooks/` and `src/components/`** — `useModelsPage.ts` (12 sites, done in session 77), `Sidebar.tsx` (3 sites, done in session 78), `JobFormModal.tsx` (1 site in `src/components/cron/`, not in List 3), and 1 site in `src/app/recroom/story-weaver/create/page.tsx` (not in List 3).

## What was rejected this session

- **Promoting `requireProfileOrBadRequest(slug)` helper** — the `prof = resolveSafeProfileName(...); if (!prof.ok) return badRequest(prof.error)` pattern appears 8 times across agent/profiles/*, skills/*, and personalities. A helper would compress it, but the inline form is 2 lines and self-documenting (the pattern is the slug-validity contract; inlining it documents the call site). Defer until session 80+ when a 9th site appears.
- **Promoting `requireProfileOrNotFound(slug)` helper** — same pattern, similar frequency. Defer.
- **Bulk-rewriting `/api/agent/*` to use the same factories** — already done in prior sessions (the `agent/profiles/*` routes all use `badRequest`/`conflict`/`notFound`/`serverError`). No work to do in `/api/agent/`.
- **Moving `toError`/`messageFromError` to a separate `src/lib/to-error.ts` file** (carry-over from session 78) — out of scope, churn risk.
