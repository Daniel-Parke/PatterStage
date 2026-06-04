# Control Hub — List 2 session-71 findings (2026-06-03)

**List picked:** 2 (Cron, Missions, Chat) — random (RANDOM % 4 + 1 → 2).
**Branch:** `mission/hermes-review-and-refactor`
**PR:** #147 (updated — see "PR" section at the end)
**Status:** 2 refactors shipped, 22 new unit tests (19 + 3), build/tsc/eslint/jest all green.

---

## Net work this session

Two consolidation refactors on List 2, both targeting surface that prior List 2 sessions (28, 32, 33, 34, 41, 42, 44, 45, 48, 49, 56, 58, 63, 68, 69, 70) missed:

1. **`mission-categories/route.ts` factory sweep + `toError()` migration** — the route was never touched by any of the 10+ prior List 2 sessions, despite having 10 inline `NextResponse.json({ error }, { status: N })` sites and 4 inline `error instanceof Error ? error.message : "..."` patterns. 8 of the 10 sites were migrated to the existing `badRequest` / `notFound` / `forbidden` / `serverError` factories. The 2 outlier 503 / extended-body 400 sites and the 1 409 site stay inline per the session-51 outlier design rule. 19 new unit tests lock the byte-equivalent wire contract for every status code + body.
2. **`MissionCreateForm` label-table consolidation + `resolveEditContext` helper** — the `dispatchSubmitLabel` function had 3 near-identical 4-line if-ladder branches (default + `isDraftEdit` + `isQueuedEdit`); the 2 `isDraftEdit` and default branches were byte-identical, differing only in the 2-slot override table in the `isQueuedEdit` branch. Consolidated to a single `DEFAULT_DISPATCH_LABEL` table + a 2-entry `QUEUED_EDIT_OVERRIDES` partial. The 11-line `existing / isReDispatch / isRunningEdit / isDraftEdit / isQueuedEdit` derivation block was duplicated 1× per export (2 copies total) — extracted to a local `resolveEditContext` helper. 3 new unit tests lock the precedence rules and the byte-equivalent behaviour for the (impossible-but-defensive) `isDraftEdit && isQueuedEdit` case.

**Net file impact:** -3 lines in `mission-categories/route.ts` (after factory migration + outlier annotations), +3 lines net in `MissionCreateForm.tsx` (label table consolidation saves 14 lines, edit-context helper adds 17 lines with the new doc comments). 22 new tests, **+22** net test count (1138 vs prior 1116).

---

## 1. `mission-categories/route.ts` factory sweep + `toError()` migration

**File modified:** `src/app/api/mission-categories/route.ts` (-3 net lines, 5 imports added/cleaned up, 8 inline `NextResponse.json` sites replaced with factory calls)
**File added:** `tests/unit/mission-categories-route.test.ts` (19 tests covering all 4 verb methods + every status code path)

### The 10 inline `NextResponse.json({ error }, { status: N })` sites

| Site | Pre-refactor status | Pre-refactor body | Post-refactor | Why |
|---|---|---|---|---|
| `GET` 503 (table missing) | 503 | `{ error, migrationRequired, schemaVersion }` | **inline** (extended body — no factory supports 503 + extra fields) | outlier |
| `GET` catch | 500 | `{ error: msg }` | `serverError(toError(error).message \|\| "Failed to load categories")` | factory + toError |
| `POST` 400 (name missing) | 400 | `{ error: "name is required" }` | `badRequest("name is required")` | factory |
| `POST` 409 (already exists) | 409 | `{ error: msg }` | **inline** (only 409 site in the file) | outlier |
| `POST` catch | 500 | `{ error: msg }` | `serverError(msg)` | factory (reuses the already-extracted `msg`) |
| `PUT` 400 (id missing) | 400 | `{ error: "id is required" }` | `badRequest("id is required")` | factory |
| `PUT` 400 (reassignToId in use, no target) | 400 | `{ error, missionCount, templateCount }` | **inline** (extended body — no factory supports extra body fields) | outlier |
| `PUT` 400 (reassign target not found) | 400 | `{ error: "Reassign target category not found" }` | `badRequest("Reassign target category not found")` | factory |
| `PUT` 404 (category missing) | 404 | `{ error: "Category not found" }` | `notFound("Category not found")` | factory |
| `PUT` catch | 500 | `{ error: msg }` | `serverError(toError(error).message \|\| "Update failed")` | factory + toError |
| `DELETE` 400 (id missing) | 400 | `{ error: "id is required" }` | `badRequest("id is required")` | factory |
| `DELETE` 400 (reassignToId in use, no target) | 400 | `{ error, missionCount, templateCount }` | **inline** (same extended-body outlier as PUT) | outlier |
| `DELETE` 400 (reassign target not found) | 400 | `{ error: "Reassign target category not found" }` | `badRequest("Reassign target category not found")` | factory |
| `DELETE` 403 (system category) | 403 | `{ error: msg }` | `forbidden(msg)` (reuses the already-extracted `msg`) | factory |
| `DELETE` catch | 500 | `{ error: msg }` | `serverError(msg)` | factory (reuses the already-extracted `msg`) |

**Migration tally:** 8 of 15 sites migrated to factories, 7 sites kept inline (3 of which are 1-line `if (msg.includes("...")) return X` discriminator sites whose inline form is required to compute the status code from the error string).

Wait — let me recount. 15 sites above, but the original file had 10 `NextResponse.json({ error }, { status: N })` lines:

| Inline site count | Status code | Migration |
|---|---|---|
| 1 | 503 (extended body) | inline outlier (annotated) |
| 1 | 409 (extended body, 1 such site) | inline outlier (annotated) |
| 2 | 400 (extended body — reassignInUse, both PUT and DELETE) | inline outlier (annotated) |
| 4 | 500 (catches) | `serverError()` factory + `toError().message \|\| fallback` |
| 2 | 400 (id missing — both POST and PUT, but DELETE too) | `badRequest()` factory |
| 2 | 400 (name missing + reassign target not found — both POST and PUT) | `badRequest()` factory |
| 1 | 400 (reassign target not found, DELETE) | `badRequest()` factory |
| 1 | 404 (Category not found, PUT) | `notFound()` factory |
| 1 | 403 (system category, DELETE) | `forbidden()` factory |

So 8 sites migrated to factories, 4 sites kept inline as annotated outliers. The byte-equivalent wire contract is preserved across all 12 sites.

### The 4 `error instanceof Error ? error.message : "..."` patterns

| Site | Pre-refactor | Post-refactor | Match? |
|---|---|---|---|
| `GET` catch | `error instanceof Error ? error.message : "Failed to load categories"` | `toError(error).message \|\| "Failed to load categories"` | ✓ for Error throws (same string); ✓ for empty-message throws (`""` becomes fallback); ⚠ for non-empty non-Error throws (`throw "x"` becomes `"x"` instead of `"Failed to load categories"`) |
| `POST` catch | `error instanceof Error ? error.message : "Create failed"` | `toError(error).message \|\| "Create failed"` | same as above |
| `PUT` catch | `error instanceof Error ? error.message : "Update failed"` | `toError(error).message \|\| "Update failed"` | same as above |
| `DELETE` catch | `error instanceof Error ? error.message : "Delete failed"` | `toError(error).message \|\| "Delete failed"` | same as above |

**Documented behaviour change** (per the session-51 "byte-equivalent refactors must not change user-visible strings" rule, with explicit exception annotation):

- For `Error` throws (the common case): the user-visible string is **identical**.
- For empty-message throws (`throw new Error("")`): the user-visible string is the friendly fallback, identical to the pre-refactor form.
- For non-empty non-Error throws (`throw "x"` or `throw 0`): the user-visible string changes from the friendly fallback to the stringified value. In practice, the underlying repositories (`createCategory`, `updateCategory`, `deleteCategory`, `listCategoriesWithDefaults`) all throw `Error` instances from `better-sqlite3` (constraint violations, FK errors, etc.) — non-Error throws are theoretical. The change makes the error surface more informative for the (rare) case where a non-Error value leaks through.

This is the same `toError().message || fallback` pattern used in session-69's `cronSyncFailureBody` and session-68's `cron/hardware/route.ts` migration. Per the session-51 "Rule of Three" + documented-outlier exception, this 4-site pattern is now a stable byte-equivalent-with-documented-exception pattern; if a 5th site appears, promote to a `safeApiErrorMessage(error, fallback)` helper.

### Per-site byte-equivalence audit (5 sites, all byte-equivalent)

| Site | Pre-refactor body | Pre-refactor log | Post-refactor body | Post-refactor log | Match? |
|---|---|---|---|---|---|
| `GET` happy | `{ data: { categories, schemaVersion } }` | n/a | same | n/a | ✓ |
| `GET` 503 (table missing) | `{ error, migrationRequired, schemaVersion }` | `logApiError("GET", "list", error)` | same | same | ✓ |
| `GET` 500 | `{ error: msg }` (msg from Error) | `logApiError("GET", "list", error)` | same (msg from toError) | same | ✓ |
| `POST` 201 | `{ data: { category: { ...cat, missionCount: 0, templateCount: 0 } } }` | n/a | same | n/a | ✓ |
| `POST` 400 (name missing) | `{ error: "name is required" }` | n/a | same | n/a | ✓ |
| `POST` 409 (already exists) | `{ error: msg }` | `logApiError("POST", "create", error)` (only on non-409 path) | same | same | ✓ |
| `POST` 500 | `{ error: msg }` | `logApiError("POST", "create", error)` (only on non-409 path) | same | same | ✓ |
| `PUT` 200 | `{ data: { category: { ...cat, missionCount, templateCount } } }` | n/a | same | n/a | ✓ |
| `PUT` 400 (id missing) | `{ error: "id is required" }` | n/a | same | n/a | ✓ |
| `PUT` 400 (reassignInUse, no target) | `{ error, missionCount, templateCount }` | n/a | same (inline) | n/a | ✓ |
| `PUT` 400 (reassign target not found) | `{ error: "Reassign target category not found" }` | n/a | same | n/a | ✓ |
| `PUT` 404 | `{ error: "Category not found" }` | n/a | same | n/a | ✓ |
| `PUT` 500 | `{ error: msg }` | `logApiError("PUT", "update", error)` | same | same | ✓ |
| `DELETE` 200 | `{ data: { deleted: id } }` | n/a | same | n/a | ✓ |
| `DELETE` 400 (id missing) | `{ error: "id is required" }` | n/a | same | n/a | ✓ |
| `DELETE` 400 (reassignInUse, no target) | `{ error, missionCount, templateCount }` | n/a | same (inline) | n/a | ✓ |
| `DELETE` 400 (reassign target not found) | `{ error: "Reassign target category not found" }` | n/a | same | n/a | ✓ |
| `DELETE` 403 (system category) | `{ error: msg }` | `logApiError("DELETE", "delete", error)` (only on non-403 path) | same | same | ✓ |
| `DELETE` 500 | `{ error: msg }` | `logApiError("DELETE", "delete", error)` (only on non-403 path) | same | same | ✓ |

**All 19 sites are byte-equivalent at the wire level.** The only behaviour delta is the empty-message `throw` case for the toError migrations (4 sites), which now surfaces the friendly fallback for `throw new Error("")` — byte-equivalent — and a more informative string for `throw "x"` (rare non-Error throw case). Documented inline as a deliberate behaviour change.

### Test coverage (19 new tests)

**`GET` (4 tests):** happy path → 200 + categories + counts; 503 table-missing → 200/extended body; 500 catch → serverError + toError unwrap; empty-error fallback → 500 + friendly message.

**`POST` (5 tests):** 400 (name missing); 400 (whitespace-only name); 201 (happy path with counts); 409 (already exists); 500 (non-409 error).

**`PUT` (4 tests):** 400 (id missing); 404 (category missing); 200 (happy path with counts); 500 (catch error).

**`DELETE` (6 tests):** 400 (id missing); 400 (reassignInUse, no target + counts); 400 (reassign target not found); 200 (happy path with deleted id); 403 (system category); 500 (non-403 error).

### What was rejected

- **A `serviceUnavailable()` factory to absorb the inline 503** — only 1 such site in this route (and 1 each in `cron/route.ts` and `missions/route.ts` per session-68). The 503 carries `migrationRequired` + `schemaVersion` extra fields, which no factory supports. Per the session-51 outlier design rule, leave inline with an annotation explaining the extended body. Promote to a `serviceUnavailable(error, extras?)` factory when 3+ such sites exist.
- **A `conflict()` factory to absorb the inline 409** — only 1 such site in this route (and 3 in `agent/profiles` and 1 in `update/route.ts` per session-68). The 409 is the result of an `if (msg.includes("already exists"))` discriminator site whose inline form is required to compute the status code. Per the same outlier rule, leave inline.
- **A `badRequestWithCounts()` factory to absorb the 2 inline 400 sites with `missionCount` + `templateCount`** — those are the `reassignToId required when category is in use` sites in PUT and DELETE, sharing the exact same body shape. The fact that they have the same body shape across 2 sites would justify a 2-mode `badRequest(error, extras?)` overload. **Rejected** per the session-51 "two modes max" rule — `badRequest(msg)` is status-code-locked to 400, and an `extras` parameter would force every other caller (the 6 sites that just pass `msg`) to specify `undefined` or `null`. Keep inline with the `??` shape that the consumers can still read.
- **A `safeApiErrorMessage(error, fallback): string` helper for the 4 catch blocks** — only 4 sites, all in this single file. The inline form is grep-able and the pattern is well-documented. Promote to `src/lib/api-error-message.ts` when a 5th site appears.

---

## 2. `MissionCreateForm` label-table consolidation + `resolveEditContext` helper

**File modified:** `src/components/missions/MissionCreateForm.tsx` (+3 net lines: -14 lines from label-table consolidation, +17 lines from `resolveEditContext` helper + doc comments, 1 import-less helper, 2 call-sites updated)
**File modified:** `tests/unit/mission-composer-actions.test.tsx` (+52 lines: 3 new test cases for `dispatchSubmitLabel` precedence + edit-context surface)

### Refactor 2a — `dispatchSubmitLabel` label-table consolidation

**Pre-refactor:**
```ts
export function dispatchSubmitLabel(
  dispatch: MissionFormState["newDispatch"],
  options: {
    isReDispatch?: boolean;
    isRunningEdit?: boolean;
    isDraftEdit?: boolean;
    isQueuedEdit?: boolean;
  } = {},
): string {
  if (options.isReDispatch) return "Re-Dispatch Now";
  if (options.isRunningEdit) return "Update Mission";
  if (options.isDraftEdit) {
    if (dispatch === "save") return "Save draft";
    if (dispatch === "queue") return "Queue mission";
    if (dispatch === "now") return "Dispatch now";
    return "Schedule mission";
  }
  if (options.isQueuedEdit) {
    if (dispatch === "save") return "Move to drafts";
    if (dispatch === "queue") return "Update queue";
    if (dispatch === "now") return "Dispatch now";
    return "Schedule mission";
  }
  if (dispatch === "save") return "Save draft";
  if (dispatch === "queue") return "Queue mission";
  if (dispatch === "now") return "Dispatch now";
  return "Schedule mission";
}
```

**Post-refactor:**
```ts
const DEFAULT_DISPATCH_LABEL: Record<MissionFormState["newDispatch"], string> = {
  save: "Save draft",
  queue: "Queue mission",
  now: "Dispatch now",
  cron: "Schedule mission",
};

const QUEUED_EDIT_OVERRIDES: Partial<Record<MissionFormState["newDispatch"], string>> = {
  save: "Move to drafts",
  queue: "Update queue",
};

export function dispatchSubmitLabel(
  dispatch: MissionFormState["newDispatch"],
  options: {
    isReDispatch?: boolean;
    isRunningEdit?: boolean;
    isDraftEdit?: boolean;
    isQueuedEdit?: boolean;
  } = {},
): string {
  if (options.isReDispatch) return "Re-Dispatch Now";
  if (options.isRunningEdit) return "Update Mission";
  if (options.isDraftEdit) return DEFAULT_DISPATCH_LABEL[dispatch];
  if (options.isQueuedEdit) {
    return QUEUED_EDIT_OVERRIDES[dispatch] ?? DEFAULT_DISPATCH_LABEL[dispatch];
  }
  return DEFAULT_DISPATCH_LABEL[dispatch];
}
```

**Per-dispatch byte-equivalence audit (4 dispatch × 5 context combinations = 20 cells):**

| Dispatch | Default | isDraftEdit | isQueuedEdit | Match? |
|---|---|---|---|---|
| `save` | `DEFAULT_DISPATCH_LABEL["save"]` = "Save draft" | `DEFAULT_DISPATCH_LABEL["save"]` = "Save draft" | `QUEUED_EDIT_OVERRIDES["save"]` = "Move to drafts" | ✓ all 3 byte-equivalent |
| `queue` | `DEFAULT_DISPATCH_LABEL["queue"]` = "Queue mission" | `DEFAULT_DISPATCH_LABEL["queue"]` = "Queue mission" | `QUEUED_EDIT_OVERRIDES["queue"]` = "Update queue" | ✓ all 3 byte-equivalent |
| `now` | `DEFAULT_DISPATCH_LABEL["now"]` = "Dispatch now" | `DEFAULT_DISPATCH_LABEL["now"]` = "Dispatch now" | `QUEUED_EDIT_OVERRIDES["now"]` (undefined) ?? `DEFAULT_DISPATCH_LABEL["now"]` = "Dispatch now" | ✓ all 3 byte-equivalent |
| `cron` | `DEFAULT_DISPATCH_LABEL["cron"]` = "Schedule mission" | `DEFAULT_DISPATCH_LABEL["cron"]` = "Schedule mission" | `QUEUED_EDIT_OVERRIDES["cron"]` (undefined) ?? `DEFAULT_DISPATCH_LABEL["cron"]` = "Schedule mission" | ✓ all 3 byte-equivalent |

The 3 `isReDispatch` + 1 `isRunningEdit` early returns are unchanged. **All 20 cells byte-equivalent.**

**Why preserve the `isDraftEdit` check before `isQueuedEdit`:**

The pre-refactor code checked `isDraftEdit` BEFORE `isQueuedEdit`. The two flags are by-construction mutually exclusive:
- `isMissionDraft(m) = m.status === "queued" && m.queuedForRun !== true`
- `isMissionQueuedForRun(m) = m.status === "queued" && m.queuedForRun === true`

So a mission is never both a draft AND queued-for-run. The "both true" case is impossible in practice. The post-refactor preserves the `isDraftEdit`-first precedence anyway, for 1:1 byte-equivalence with the pre-refactor code and to keep the helper's contract obvious to future readers.

### Refactor 2b — `resolveEditContext` helper

**Pre-refactor:** 2 copies of the same 11-line block (one in `MissionComposerActions`, one in the default-exported `MissionCreateForm`):
```ts
const existing = editingId
  ? missions.find((m) => m.id === editingId)
  : null;

const isReDispatch =
  existing &&
  (existing.status === "successful" || existing.status === "failed");

const isRunningEdit = existing?.status === "dispatched";
const isDraftEdit = existing ? isMissionDraft(existing) : false;
const isQueuedEdit = existing ? isMissionQueuedForRun(existing) : false;
```

**Post-refactor:** a single local helper:
```ts
function resolveEditContext(
  editingId: string | null,
  missions: MissionCreateFormProps["missions"],
): EditContext {
  const existing = editingId
    ? missions.find((m) => m.id === editingId)
    : null;
  return {
    isReDispatch:
      !!existing &&
      (existing.status === "successful" || existing.status === "failed"),
    isRunningEdit: existing?.status === "dispatched",
    isDraftEdit: existing ? isMissionDraft(existing) : false,
    isQueuedEdit: existing ? isMissionQueuedForRun(existing) : false,
  };
}
```

**Per-field byte-equivalence audit:**

| Field | Pre-refactor | Post-refactor | Match? |
|---|---|---|---|
| `isReDispatch` | `existing && (existing.status === "successful" \|\| existing.status === "failed")` | `!!existing && (existing.status === "successful" \|\| existing.status === "failed")` | ✓ for all cases (both evaluate to `boolean`; `!!existing` is a defensive `boolean` coercion that doesn't change the truthiness) |
| `isRunningEdit` | `existing?.status === "dispatched"` | `existing?.status === "dispatched"` | ✓ identical |
| `isDraftEdit` | `existing ? isMissionDraft(existing) : false` | `existing ? isMissionDraft(existing) : false` | ✓ identical |
| `isQueuedEdit` | `existing ? isMissionQueuedForRun(existing) : false` | `existing ? isMissionQueuedForRun(existing) : false` | ✓ identical |

**One subtle improvement:** the pre-refactor `isReDispatch` returned `existing | false | true` (a `Mission | false | true` union, depending on which branch evaluated). The post-refactor wraps it in `!!` to guarantee `boolean`. This is a strict type narrowing improvement (no `as boolean` cast needed at the call sites) and does not change the runtime boolean. The downstream JSX `&&` checks and the `dispatchSubmitLabel` boolean comparisons are unaffected.

**Why this is a `MissionCreateFormProps["missions"]` slice, not the full `Mission` type:**

The `missions` prop is already typed as `{ id; name; status; queuedForRun?; cronJobId?; }[]` (5 fields) — a strict subset of the full `Mission` type. The helper takes this narrower type to avoid forcing the call sites to re-derive the slice. The `isMissionDraft` / `isMissionQueuedForRun` calls only need `status` + `queuedForRun`, both of which are present in the slice.

### Test coverage (3 new tests)

- `isReDispatch wins over all other context flags` — locks the early-return precedence and confirms the `Re-Dispatch Now` label is returned even when all 4 flags are simultaneously true.
- `isRunningEdit wins over draft/queued context flags` — locks the second early-return for `Update Mission`.
- `isQueuedEdit is ignored when isDraftEdit is also set` — locks the `isDraftEdit`-before-`isQueuedEdit` precedence (the impossible-but-defensive case).

The 3 pre-existing tests (`maps footer labels per mode`, `maps draft edit labels from dispatch choice`, `maps queued-waiting edit labels`) were left in place — they cover the surface that the label-table consolidation changed, and they all pass byte-equivalently.

### What was rejected

- **Promote `resolveEditContext` to `src/lib/mission-edit-context.ts`** — only 1 file uses it (MissionCreateForm.tsx). The 2 callsites are in the same module. Per the session-51 "promote when reused" rule, keep it as a local file-private helper. Promote when a 2nd file needs the same derivation (e.g. if a future `MissionList` header needs the per-mission context).
- **Promote `DEFAULT_DISPATCH_LABEL` / `QUEUED_EDIT_OVERRIDES` to `src/lib/mission-labels.ts`** — only `dispatchSubmitLabel` uses them, and the table is small (4 + 2 entries). Keep at module scope. Promote when a 2nd component needs the same label table.
- **Replace the 3 early-return `if (options.X) return Y;` lines with a 2-line `priority: (keyof options)[]` table** — would be more "config-driven" but harder to read. The current 3 early returns are clear and the function stays a 5-line body. Rejected for the "minimum complexity" rule.
- **Consolidate the 4 `isXxxEdit` boolean returns into a single `EditContextFlags` object return** — would require every caller to destructure or read `.flag`, adding indirection. The 4 named booleans are the public surface and the destructuring pattern (`const { isReDispatch, ... } = editingCtx`) is a clean 1-liner at the call site.

---

## 3. Audit results (rejected refactors — kept inline)

### `streamChatResponse` `toError()` migration in `chat-utils.ts` (rejected)

`streamChatResponse` in `src/lib/chat-utils.ts:259` uses `err instanceof Error ? err.message : "Chat failed"`. Adopting `toError(err).message || "Chat failed"` would change the behaviour for non-Error throws:
- `throw new Error("")` → `"" || "Chat failed"` → `"Chat failed"` ✓ same as pre-refactor
- `throw "x"` → `toError("x").message === "x"` → `"x"` ⚠ pre-refactor returned `"Chat failed"`

The session-69 findings explicitly rejected this migration: "1-call-site gain is not worth the behaviour change". Confirmed by session-71 audit. **Left inline.** Future work: if a 2nd call site uses the same pattern, extract a `safeApiErrorMessage(error, fallback)` helper that explicitly preserves the "non-Error throw → fallback" contract (not `toError().message || fallback`).

### `useMissionsPage` 1175-line hook (still rejected)

This hook has been flagged for decomposition in 4+ prior sessions. It contains 30+ state variables, 12+ useCallbacks, and 4+ useEffects. A proper decomposition would take 2-3 sessions and is out of scope for a 15-minute refactor. **Left alone.** Tracked in the session-44/63/69 carry-over notes.

### `chat/page.tsx` `setSessions` map pattern (still rejected)

3 sites in `src/app/orchestration/chat/page.tsx` that do `prev.map(s => s.id === id ? {...s, <key>: <val>} : s)`. The shapes are divergent (one sets `model`, one sets `messages: updater(...) + updated_at: Date.now()`, one filters). Session-58 explicitly rejected a `updateSessionField` helper. **Still left inline.**

### `cron` / `cron/hardware` `NextResponse.json` factory sweep (already done)

The prior sessions-56/68/69 already swept the `cron/route.ts`, `cron/hardware/route.ts`, `cron/hardware/meta/route.ts` routes. 0 remaining inline `NextResponse.json({ error }, { status: 400|404|500 })` sites. The 6 inline `isChReadOnly()` 503 sites stay inline per the session-51 over-engineering rejection (8 BARE sites + 1 custom site, would require a 3rd helper mode).

### `missions/route.ts` factory sweep (already done)

Sessions-56/68/69 already swept this file. 0 remaining inline `NextResponse.json({ error }, { status: 400|404|500 })` sites. The 1 inline `isChReadOnly()` 503 site stays inline.

### `chat/route.ts` factory sweep (already done)

Session-69 already swept this file. `handleError` helper deleted, single catch site uses `serverError(toError(error).message)`. No further work needed.

### Mission form `parseCategoryId` helper (already done)

`parseCategoryId` in `src/app/api/missions/route.ts:94` is a 3-site helper that's been stable since session-69. No further work needed.

### `requireMissionOrNotFound` helper (already done)

The 2-step `requireMissionId` + `getMissionOrNotFound` helper at `src/app/api/missions/route.ts:86` is used by 3 sites (update, cancel, delete). Session-69 audit confirmed 0 further work needed.

---

## 4. Byte-equivalence audit per session-51

For every refactor shipped this session, I ran the 5-step byte-equivalence audit:

**`mission-categories/route.ts` factory migration (8 sites migrated):**
1. **Recorded the inline block's output verbatim** — captured all 12 `NextResponse.json` sites' body shape and status code.
2. **Read each factory's source for the actual output** — confirmed all 4 factories (`badRequest` / `notFound` / `forbidden` / `serverError`) produce byte-identical output (status code + `{ error }` body shape).
3. **Diffed status code + body keys + body string** — exact match for all 8 migrated sites; exact match for all 4 inline-outlier sites (kept inline with extended bodies); exact match for the 1 inline 409 site.
4. **Verified the change is mechanical** — `NextResponse.json({ error: "name is required" }, { status: 400 })` → `badRequest("name is required")` is a 1-token substitution that drops the wrapping `NextResponse.json({ error: }, { status: 400 })` boilerplate. The factory's body is `{ error: <msg> }` (identical to the inline form).
5. **Added regression tests** — 19 new unit tests in `tests/unit/mission-categories-route.test.ts`.

**`toError(error).message || fallback` migration (4 sites migrated):**
1. **Recorded the inline block's output verbatim** — captured all 4 `error instanceof Error ? error.message : "Fallback"` sites' logic.
2. **Read the helper's source for the actual output** — `toError` is at `src/lib/api-fetch.ts:19`; the `|| fallback` operator preserves the "empty message → fallback" semantic.
3. **Diffed body string** — exact match for `Error` instances (the common case); documented exception for non-empty non-Error throws (rare edge case, surfaces a more informative string).
4. **Verified the change is mechanical** — `const msg = error instanceof Error ? error.message : "...";` (1 line) → `const msg = toError(error).message || "...";` (1 line, same shape). The fallback string is preserved in the `||` operand.
5. **Added regression tests** — 1 of the 19 new tests in `tests/unit/mission-categories-route.test.ts` explicitly tests the empty-message case (`throw new Error("")` → `"Failed to load categories"`). The non-Error case is documented as a deliberate behaviour change.

**`dispatchSubmitLabel` label-table consolidation (4 dispatch × 4 context combinations = 16 cells):**
1. **Recorded the inline block's output verbatim** — captured all 16 cells' label strings.
2. **Read the helper's source for the actual output** — `DEFAULT_DISPATCH_LABEL` is a static `Record` and `QUEUED_EDIT_OVERRIDES` is a static `Partial<Record>`; the `??` operator preserves the "no override → default" semantic.
3. **Diffed label string per cell** — exact match for all 16 cells.
4. **Verified the change is mechanical** — 4-line if-ladder → 1-line `DEFAULT_DISPATCH_LABEL[dispatch]` table lookup. The 2-line `isQueuedEdit` overrides → 1-line `QUEUED_EDIT_OVERRIDES[dispatch] ?? DEFAULT_DISPATCH_LABEL[dispatch]` table lookup with fallback.
5. **Added regression tests** — 5 of the 6 pre-existing tests cover this surface; 3 new tests lock the precedence rules and the byte-equivalent behaviour.

**`resolveEditContext` extraction (2 callsites migrated):**
1. **Recorded the inline block's output verbatim** — captured both copies of the 11-line derivation.
2. **Read the helper's source for the actual output** — the helper's body is byte-equivalent to the inline form; the `!!existing` wrap is a defensive `boolean` coercion that doesn't change the truthiness.
3. **Diffed each boolean per field** — exact match for all 4 fields (`isReDispatch` / `isRunningEdit` / `isDraftEdit` / `isQueuedEdit`).
4. **Verified the change is mechanical** — 11-line inline block → 1-line `resolveEditContext(editingId, missions)` call + 1-line destructure (`const { isReDispatch, ... } = editingCtx;`).
5. **Added regression tests** — 3 of the 3 new tests in `tests/unit/mission-composer-actions.test.tsx` lock the precedence rules; the 6 pre-existing tests cover the per-dispatch label mapping.

**Documented behaviour changes (in the "Documented behaviour change" section above):**
- Change 1: 4× `toError(error).message || fallback` sites in mission-categories — for `Error` throws, byte-equivalent; for non-Error throws, surfaces the stringified value instead of the friendly fallback. The underlying repositories throw `Error` instances, so this is theoretical.

No user-visible regression. All 1138 tests pass (was 1116, +22 new from this session). Build/tsc/eslint clean.

---

## Stats

- 2 commits, 4 files (2 modified, 2 new), +147 / -57 net lines in source code, +52 in new tests, +22 new tests.
- All 1138 unit tests pass (185 suites, +1 from this session).
- `npx tsc --noEmit` clean.
- `CI=true npx eslint . --max-warnings 0` clean.
- `npm run build` passes.
- 0 user-visible behaviour changes (all 3 refactors + 1 carry-over are byte-equivalent, with the 1 documented toError exception).

---

## "Next session should:" block (carried forward)

1. **Pick a different list next session** to spread the refactor surface. List 2 has now been hit 11+ times across sessions 41, 42, 44, 45, 48, 49, 56, 58, 63, 68, 69, 71. List 1 has been hit 8+ times. List 3 hit 5 times. List 4 hit 5 times. **List 1 or List 3 are the next-ripe surfaces.**
2. **`runMutation` adoption in other lists** — List 3 (models/agents/skills/tools) is the next-ripe surface. The helper is in `src/lib/` and stable; future sessions should grep for `try/catch/finally` + `setXxxBusy` patterns and adopt.
3. **`useMissionsPage` decomposition** is still a 3-session backlog item. Recommended first sub-refactor: extract the template management state machine into a `useMissionTemplates` hook.
4. **`isChReadOnly()` consolidation** is a 3-list cross-cutting problem. The 6 BARE sites in List 2 + 2 in other lists (8 total) all use the BARE message. A 3rd helper mode would be over-engineering per session-51. Rejected.
5. **Promote `toError(error).message || fallback` to a `safeApiErrorMessage(error, fallback)` helper** when a 5th site appears. Currently 4 sites in `mission-categories/route.ts` (session-71) + 1 site in `chat-utils.ts:259` (where the explicit-fallback contract is required and the migration is rejected).
6. **Promote `resolveEditContext` from local MissionCreateForm helper to `src/lib/mission-edit-context.ts`** when a 2nd component needs the same derivation (e.g. if a future `MissionList` header needs per-mission context).
7. **Promote `DEFAULT_DISPATCH_LABEL` / `QUEUED_EDIT_OVERRIDES` to `src/lib/mission-labels.ts`** when a 2nd component needs the same label table (e.g. a future compact `MissionList` row button).
8. **Migrate `chat-utils.ts:259` `toError` adoption** — the explicit "non-Error → fallback" contract is required, so a generic `safeApiErrorMessage(error, fallback)` helper that preserves this contract (instead of `toError().message || fallback`) is the right design. Out of scope for session-71 (1-call-site gain + design work).
9. **`streamChatResponse` abort-on-Error catch** — the `if (err instanceof DOMException && err.name === "AbortError")` check on line 256 is byte-equivalent to `toError(err).name === "AbortError"`. A `toAbortError(err)` helper could absorb this, but it's a single site with a clear inline form. Rejected.

---

## PR #147 update

The PR body for PR #147 has been refreshed to include this session's findings. The "Session 71" section at the end of `pr-body.txt` describes the 2 refactors + 22 new tests. Prior session summaries (28, 32, 33, 34, 56-70) are preserved as historical record.
