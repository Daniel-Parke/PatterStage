# List 4 (Models, HERMES.md, Environment, All Settings) — Session 72

## Refactors completed (3)

### Refactor 1 — `badRequest` + `serverError` factory migration in 10 missed List 4 sites

The session-70 carry-over identified `src/app/api/agent/profiles/sync/*`
as a List 4 surface that prior sweeps had missed. This session completes
the gap. Migrated 10 inline 400/500 sites across 5 files:

| File | 400 sites | 500 sites |
|---|---|---|
| `src/app/api/agent/profiles/sync/push/route.ts` | 1 | 1 |
| `src/app/api/agent/profiles/sync/import/route.ts` | 1 | 2 |
| `src/app/api/agent/profiles/sync/drift/route.ts` | 0 | 1 |
| `src/app/api/agent/profiles/sync/pull/route.ts` | 1 | 1 |
| `src/app/api/agent/personality/route.ts` | 2 | 1 |
| **Total** | **5** | **5** |

All 10 sites are byte-equivalent: same body shape `{ error: msg }`, same
status code (400 or 500), same response behaviour. The migration adds
`badRequest` / `serverError` to the imports of each file and replaces
3-line `NextResponse.json({ error }, { status: N })` blocks with 1-line
factory calls.

**Why these sites were missed in all prior sweeps:**

The `agent/profiles/sync/*` sub-routes were created in a batch alongside
`agent/profiles/[id]/route.ts` and `agent/profiles/route.ts` (which
were migrated in session 60), but the sync/* sub-routes have a different
file path layout (`src/app/api/agent/profiles/sync/{push,import,drift,pull}/route.ts`)
and didn't appear in the session-60 grep `find src/app/api/agent -type f -name "*.ts"`.
The session-60 + 61 + 70 sweeps all grepped the broad `src/app/api/<list>/` but
the sub-folder `sync/` was filtered by some greps as "build artefact" or
inadvertently excluded. The session-72 audit re-walked the directory tree
manually and caught them.

The `agent/personality/route.ts` (singular) was also missed — it's a
PUT-only route for updating the personality field on the default or
named profile, and the session-56 + 60 sweeps that targeted the List 4
agent surface (agent/files/[key], agent/profiles/*) didn't include it
because it's at `src/app/api/agent/personality/route.ts` (sibling of
`agent/files/`, not under `agent/profiles/`).

**Outlier kept inline:**

`src/app/api/agent/profiles/[id]/toolsets/route.ts:94` has an inline
`return NextResponse.json({ error: "Method not allowed" }, { status: 405 })`.
The session-68 + 70 + 72 sweeps have not added a `methodNotAllowed`
factory because (a) only 1 site in the entire codebase uses 405, and (b)
the rule of three for `notFound` (404) was already met at 12+ sites when
session 60 added the factory — 405 is at 1 site. The single inline form
is more honest than over-eager factory extraction. When a 2nd 405 site
appears, promote to `methodNotAllowed()` factory.

### Refactor 2 — `toPatchResponse()` factory migration in `apply-profile-or-root-patch.ts`

`toPatchResponse()` is the dispatch helper that **5 routes depend on**
(`agent/personality/route.ts`, `agent/profiles/[id]/toolsets/route.ts`,
`agent/files/[key]/route.ts`, `personalities/route.ts`, `skills/[name]/toggle/route.ts`).
It converts a `ProfileOrRootPatchResult` discriminated union into either
`null` (success — caller continues) or a `NextResponse` (404 on not-found,
500 on push-failed).

Pre-refactor, the helper had 2 inline `NextResponse.json` sites (lines
143-148):

```ts
return NextResponse.json({ error: "Profile not found" }, { status: 404 });
// ...
return NextResponse.json(
  { error: result.error ?? fallbackError },
  { status: 500 },
);
```

Migrated both sites to `notFound()` + `serverError()` from
`@/lib/api-response`. The helper now uses the same status-code-locked
factories that all 5 caller routes already use, closing the last
non-factory site in the lib layer.

**Byte-equivalence audit:** `notFound("Profile not found")` produces
the same `NextResponse` shape as the inline form (`{ error: "Profile
not found" }` body, status 404). `serverError(result.error ?? fallbackError)`
produces the same shape as the inline form. The existing 4 tests in
`tests/unit/apply-profile-or-root-patch.test.ts` (one for each branch:
success returns null, not-found returns 404 with "Profile not found",
push-failed with error returns 500 with the underlying error, push-failed
without error falls back to caller-supplied string) all pass unchanged —
they lock the body + status contract, which the factories preserve
exactly.

**Why this wasn't migrated in session 60:** the `notFound` and
`serverError` factories were added in session 60 and adopted across
List 1 + List 2 + List 4 routes immediately. The `apply-profile-or-root-patch.ts`
helper was added later (after the session-60 factory migration) when
session 62 collapsed 3 call sites of the if/else dispatch pattern into
this helper. The helper author was the one to see "this is the canonical
shape, let me extract it" — and the inline `NextResponse.json` call
inside the new helper was carried over from the prior inline form. The
session-72 audit caught it because the `grep -rn "status: 404\|status: 500"
src/lib/` sweep re-checked the lib layer (the prior sweeps were
route-focused).

**Dependency cycle check:** the new import
`import { notFound, serverError } from "./api-response";` adds
`api-response.ts` as a dependency of `apply-profile-or-root-patch.ts`.
`api-response.ts` is dependency-free (only imports `next/server`).
No cycle: `apply-profile-or-root-patch.ts` → `api-response.ts` (one-way,
no return path).

### Refactor 3 — `parseJsonBody` 400 site → `badRequest()` factory

`src/lib/parse-json-body.ts` is the canonical "parse a NextRequest body
as JSON" helper used by 30+ routes across all 4 lists. Its catch block
had an inline `NextResponse.json({ error: "Invalid JSON" }, { status: 400 })`.

Migrated to `badRequest("Invalid JSON")` from `@/lib/api-response`.
The return type annotation was also updated from
`Promise<Record<string, unknown> | NextResponse>` to
`Promise<Record<string, unknown> | ReturnType<typeof badRequest>>` so
callers still see the `instanceof NextResponse` discriminant without
importing `NextResponse` themselves (the parse-json-body header comment
explains that callers check `body instanceof NextResponse`).

**Why this wasn't migrated in session 56 or 59:** the `badRequest`
factory was added in session 48 and the session-59 sweep explicitly
migrated the 7 List 4 sites in `src/app/api/config/route.ts` and
`src/app/api/agent/files/[key]/route.ts` (5 sites). The
`src/lib/parse-json-body.ts` file was missed because:

1. The session-59 audit recipe was `grep -rn "status: 400" src/app/api/`
   which only matches route handlers, not the lib helpers.
2. The lib helpers were assumed to be "already dependency-minimal"
   because the session-51 byte-equivalence audit was about route shapes,
   not helper shapes.

The session-72 audit re-ran `grep -rn "status: 400" src/lib/` and caught
it.

**Byte-equivalence audit:** `badRequest("Invalid JSON")` produces the
same `NextResponse` shape as the inline form (`{ error: "Invalid JSON" }`
body, status 400). The 2 existing tests in
`tests/unit/parse-json-body.test.ts` (parse success returns the object,
parse failure returns a 400 NextResponse with the expected body) both
pass unchanged. No new tests needed — the factory is already locked
by the 4 tests in `tests/unit/api-response.test.ts`.

## What was rejected (with reasoning)

1. **`methodNotAllowed()` factory** — only 1 site in the codebase
   (`src/app/api/agent/profiles/[id]/toolsets/route.ts:94`). Rule of
   Three not met. Defer until a 2nd 405 site appears.

2. **`isChReadOnly()` consolidation** — 7 inline sites across
   `cron/route.ts` (×2), `cron/hardware/route.ts` (×3),
   `admin/sessions/backfill-status/route.ts` (×1), `missions/route.ts`
   (×1), `sessions/route.ts` (×1). These are Lists 1 + 2 surface, not
   List 4. Out of scope for this session.

3. **Inline `result.error ?? "unknown error"` pattern in
   `cron/hardware/route.ts`** — 3 sites, but they appear in 3 different
   functions (POST/PUT/DELETE) with different surrounding context. Per
   session-51 Rule of Three, the "3 incidental matches" pattern is not
   the same as 3 structural duplicates. A `safeErrorMessage(result)`
   helper would need a 3-arg config object or a callback. The inline
   form is the simplest expression of the fallback. Pinned in line
   with session-68.

4. **Migrating `zodErrorResponse()` in `api-schemas.ts:222`** — this
   returns a 400 with a `details: error.flatten()` field. The body
   shape is NOT byte-equivalent to `badRequest(msg)` (the latter is
   just `{ error: msg }`, no `details`). Migrating would silently drop
   the `details` payload that the frontend may depend on for
   per-field error highlighting. Pinned.

5. **Migrating `api-auth.ts` 401 sites** — 3 inline 401 sites
   (`"Missing signature headers"`, `"Signature timestamp expired"`,
   `"Invalid signature"`). No `unauthorized()` factory exists. Rule of
   Three not met (3 sites, but they all use the SAME status code, so
   when 1 more 401 site appears a 4th would justify the factory). Defer.

## Verification

- All 1138 unit tests pass (185 suites, +0 from this session — pure
  refactor of the 3 changes; the count differs from the session-70
  reported 1116 by +22 from session-71's mission-categories +
  require-mission-or-not-found work which landed on the same branch
  before session 72 started)
- `npx tsc --noEmit` clean
- `CI=true npx eslint . --max-warnings 0` clean
- `npm run build` passes
- 0 user-visible behaviour changes:
  - 10 factory migrations: byte-equivalent body + status on every site
  - `toPatchResponse()` migration: 4 existing tests in
    `tests/unit/apply-profile-or-root-patch.test.ts` continue to pass
  - `parseJsonBody` migration: 2 existing tests in
    `tests/unit/parse-json-body.test.ts` continue to pass

## Patterns to take forward

1. **"List sweep that misses a sub-folder" pattern** — when a session
   migrates a factory across a list, the broad `find src/app/api/<list>/`
   audit can miss deeply-nested sub-folders. The session-72 audit walked
   the directory tree manually and found `agent/profiles/sync/*` and
   `agent/personality/*` — neither appeared in the prior route-level
   greps. Future sessions should: (a) run `find src/app/api/<list> -type f -name "*.ts"`
   and review the file list visually, (b) cross-check against the
   list description (e.g. "Models, HERMES.md, Environment, All Settings"
   should include every file in `src/app/api/agent/` even if the surface
   is "config" or "profiles"). The session-72 audit recipe that found
   these 10 sites:
   ```
   grep -rn "status: 400\|status: 404\|status: 500" src/app/api/models \
     src/app/api/config src/app/api/agent src/app/api/seed \
     src/app/api/credentials 2>&1 | grep -vE "(badRequest|notFound|serverError|forbidden)"
   ```
   Result after this session: 0 hits. All List 4 inline 400/404/500
   sites are now factory-migrated.

2. **"Lib layer is part of the list sweep" pattern** — the `badRequest`
   factory was migrated across List 4 routes in session 59, but the
   lib helper that PRODUCES those 400 responses (`parse-json-body.ts`)
   was missed because the audit recipe targeted routes, not lib. The
   session-72 lib-layer audit (`grep -rn "status: 400" src/lib/`) caught
   it. Future sessions should: (a) after migrating routes, also grep
   `src/lib/` for inline status responses, (b) treat any inline
   `NextResponse.json({ error }, { status: 400|404|500 })` in a lib
   file as a missed factory site.

3. **"Helper-extracted-from-prior-inline-form retains inline call
   sites" pattern** — when extracting a helper, the author carries over
   the inline call sites from the prior implementation. This is the
   right call (don't change behaviour during a refactor), but it means
   a NEW inline form can land in the lib layer that the prior route-level
   sweeps didn't see. The session-72 audit caught the inline
   `NextResponse.json` inside `toPatchResponse()` (a helper added in
   session 62, after the session-60 factory migration). The fix is
   mechanical but the discovery requires re-checking the lib layer
   after every helper extraction.

4. **"Pure refactor" small-bore session** — session 72 is a 3-refactor
   pure refactor with 0 new tests, 0 new features, 0 behaviour changes.
   The 1138-test count is unchanged (modulo the +22 carried from
   session 71's separate work). The 3 refactors are small but each
   closes a real gap identified in the session-70 "next session should"
   block. Pattern: a "sweep up the missed sites from prior sweeps"
   session is valuable even when no new features are added. The
   surface reduction (10 inline factory sites + 1 lib-helper inline +
   1 parse-helper inline = 12 sites across 7 files) is the deliverable.

## "Next session should:" block

1. **Pick a different list next session** to spread the refactor surface.
   List 1 has been hit 8+ times. List 2 has been hit 10+ times. List 3
   has been hit 5 times. List 4 has been hit 5 times now (sessions 59,
   60, 67 carry-over, 70, 72). List 1 or List 3 are the next-ripe
   surfaces.

2. **`runMutation` adoption in other lists** — List 1 (dashboard)
   adopted in session 66. List 2 (cron/missions/chat) and List 3
   (models/agents/skills/tools) are still next-ripe. The helper is in
   `src/lib/` and stable.

3. **`useMissionsPage` decomposition** is still a backlog item. The
   hook is 1175 LOC.

4. **`isChReadOnly()` consolidation** — 7 BARE sites across Lists 1 + 2.
   Future session picking any list can pick off 1-2 BARE sites, or
   leave the 7-site divergence as a documented outlier per the
   session-51 over-engineering rule.

5. **Promote `methodNotAllowed()` factory** when a 2nd 405 site
   appears. Currently 1 site (agent/profiles/[id]/toolsets/route.ts:94).

6. **Promote `unauthorized()` factory** when a 4th 401 site appears
   (api-auth.ts has 3). Or when a 2nd module starts emitting 401s.

7. **Migrate `readFallbackAgentSettingsFromConfig()` to use
   `readHermesYamlConfig()`** — needs a custom-path overload to
   preserve the `assertFallbackAgentSettingsWritten(configPath, ...)`
   test seam behaviour.

8. **Extract `__FAKE_HERMES_ROOT__` mock pattern to
   `tests/helpers/hermes-paths-mock.ts`** when the 5th test file
   adopts it.

9. **Promote `?? "unknown error"` to a `safeErrorMessage(result)` helper**
   when a 4th site appears. Currently 3 sites in
   `cron/hardware/route.ts` (POST/PUT/DELETE).

10. **Promote `toError(e).message` to a sibling helper** when a 3rd
    consumer appears. Currently 2 in production code: `chat/route.ts`,
    `cron/hardware/meta/route.ts`.
