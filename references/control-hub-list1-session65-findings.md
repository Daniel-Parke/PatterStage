# List 1 sweep — session 65 (control-hub, 2026-06-03)

Random pick: **List 1** (Dashboard, Sessions, Memory, Logs). The last
List 1 session was 62 (`parseTagsInput` + `setField` + `PollExtractor`
type). Sessions 63-64 covered Lists 2 (toastFromResult + useCronJobMutation
hooks) and 3 (`parseBagFlags` + sync/* migrations) respectively. This
session re-audits the List 1 surface for **handler-shape consolidation** —
the kind of refactor that lands when 5+ handlers in one file share the
exact same try/catch/finally/toast/reset skeleton.

## Findings

### 1. `runMutation(showToast, opts)` helper — 5× → 1

**File:** `src/components/memory/HindsightBrowser.tsx`

The 5 Hindsight mutation handlers (`handleAdd`, `handleCreateDirective`,
`handleSaveDirective`, `handleCreateModel`, `handleSaveModel`) all
followed the exact same shape:

```ts
const handler = async () => {
  if (!validation) return;
  setBusy(true);
  try {
    const tags = parseOptionalTagsInput(x);
    const { ok, error } = await safeApiCall(path, { method: "POST", body });
    if (!ok) { showToast(error ?? fallbackMsg, "error"); return; }
    showToast(successMsg, "success");
    resetForm();
    await reload();
  } catch { showToast(fallbackMsg, "error"); }
  finally { setBusy(false); }
};
```

**17 lines per handler × 5 handlers = 85 lines of identical
boilerplate.** The variable parts were just: validation predicate,
request body, busy setter, success/error messages, and form-reset +
reload actions. **5× identical shape is well past the Rule of Three
twice over** — this is exactly the "5+ call sites" condition from
session-51's audit threshold.

Extracted to `src/components/memory/hindsight/run-mutation.ts` as a
flat data-driven helper:

```ts
const handleAdd = () => runMutation(showToast, {
  isValid: () => newContent.trim().length > 0,
  busy: setAdding,
  build: () => ({ content: newContent, tags: parseOptionalTagsInput(newTags) }),
  path: "/api/memory/hindsight",
  successMsg: "Memory stored",
  errorMsg: "Failed to store memory",
  onSuccess: async () => { ... reset + reload ... },
});
```

Each handler now reads as a 12-15 line data object with no control-flow
noise. The `try/catch/finally` lives in one place, so the
`setBusy(false)` always runs — **session-35 + session-57 found 2 prior
instances of "forgot the finally" bugs** in unrelated handlers; this
shape makes that class of bug structurally impossible.

**Byte-equivalence audit:** each handler's new shape preserves the
exact sequence of (1) validate, (2) busy=true, (3) call safeApiCall,
(4) toast success, (5) run onSuccess, (6) busy=false in finally. The
`onSuccess` is awaited *before* the finally `busy(false)`, matching
the original (the success path awaited the reload before clearing
busy). The only structural change is that the `setShowModal(false)`
+ `setForm(EMPTY)` reset now lives inside `onSuccess` instead of
inline — a strict win (single function-scoped closure instead of two
state setters scattered around the handler body).

**11 new unit tests** in `tests/unit/run-mutation.test.ts` cover:
- happy path: build() called, busy true→false, success toast,
  onSuccess + onSuccessResult invoked
- minimal config (no onSuccess / onSuccessResult)
- isValid guard: returns false, doesn't fire fetch, doesn't set busy
- isValid=true fires the request
- isValid omitted defaults to "valid"
- error path: server error message wins over fallback
- fallback behaviour when no error field (defence-in-depth, currently
  not reachable through real apiFetch)
- !ok path: busy still cleared (finally-block regression net)
- onSuccess ordering: runs after success toast, after fetch
- onSuccess NOT called on !ok
- async onSuccess is awaited before busy(false) (locks down the
  ordering of finally-block relative to async work)

**Supporting change:** added `SafeApiCallResult<T>` exported type to
`@/lib/api-fetch.ts` so `runMutation`'s `onSuccessResult` callback can
read fields beyond `ok`/`error` in a typed way (the prior inline
return shape was anonymous).

### 2. `healthBannerMessage(health)` helper

**File:** `src/components/memory/hindsight/HealthBanner.tsx`

The HealthBanner had a 6-line inline ternary that decided the banner
message from three `health` fields (Redis detection → message field →
error field fallback). It's only 1 callsite, but **3 conditional
branches + a substring heuristic** qualifies for the session-57
testability exception (single callsite + 3+ branches + a non-trivial
detection rule).

Extracted to `src/components/memory/hindsight/health-message.ts` as a
4-branch (Redis-wins, message-set, error-set, fallback) pure helper.
HealthBanner shrinks from 36 lines to 28.

**9 new unit tests** in `tests/unit/health-message.test.ts` cover:
- Redis branch (with the literal "Redis" substring, case-sensitive)
- case-sensitivity is locked down (lowercase "redis" → message
  branch, not Redis branch) — the inline check was `includes("Redis")`
  not `.toLowerCase().includes("redis")`, so a future "fix" to
  lowercase is a deliberate change
- Redis hint wins over a generic `message` field
- message branch: `health.message` is set → `"Hindsight <mode>: <msg>"`
- mode interpolation
- fallback branch: error only, both empty, empty-string error
- odd inputs: undefined error and undefined message together

### 3. `EMPTY_DIR_FORM` + `EMPTY_MODEL_FORM` module constants

**File:** `src/components/memory/HindsightBrowser.tsx`

The blank `{ name: "", content: "", priority: "0", tags: "" }` and
`{ name: "", query: "", tags: "" }` literals were inlined 6 times
each across the directive + mental-model modals:

- 2× useState initializer
- 1× on-close handler (modal close)
- 1× post-save reset

Extracted to module-level `EMPTY_DIR_FORM` and `EMPTY_MODEL_FORM`
constants. Each `setXxx(EMPTY_XXX_FORM)` call is now a 1-token
reference. The benefit isn't lines-saved (it's roughly neutral) — it's
that a future "I added a `description` field to the directive modal"
lands in one place. The session-35 lesson was that 6 inline sites
tend to drift; this rule applies to form-state shapes too.

### 4. `filteredLines` perf fix in logs/page.tsx

**File:** `src/app/(main)/logs/page.tsx`

The log-line search filter at line 129 called `search.toLowerCase()`
**per line in the predicate** — for a 200-line log that's 200
redundant toLowerCase calls on the same string. Hoisted the
toLowerCase out of the predicate so it runs once per `useMemo`
invalidation, not once per line.

**Net behaviour:** byte-identical output, ~99% fewer toLowerCase
calls when search is non-empty. Empty search still short-circuits the
filter. No new test — the change is one line and is exercised
transitively by the existing logs API tests.

## What was rejected

- **`parseInt(priority) || 0` extraction (2 sites)** — only 2
  occurrences in HindsightBrowser (create + edit directive). The
  session-62 audit rejected this for the same reason; still 2 sites.
  Left inline. A future session-66 might revisit if cron/missions
  page adds a 3rd callsite.
- **`if (!x.name.trim() || !x.content.trim()) return;` × 2 sites** —
  pattern in HindsightBrowser.create handlers. Now lives inside
  `runMutation`'s `isValid` callback, so the duplication is gone
  without needing a separate helper.
- **The 6 `safeApiCall` callsites in `src/app/page.tsx` (dashboard)
  initial-load batch + polling** — explicitly rejected by session-57
  ("8 lines of repetition, not enough to justify a new helper"). The
  `unwrapPollPath` helper is the polling equivalent and is already in
  use. The initial-load batch is 8 endpoints that have different
  default-fallback shapes (4 use `?? null`, 4 use `|| []`); not
  uniform enough for a "batch-unwrap" helper. Left as-is.
- **`HindsightBrowser` 4-quadrant modal prop drilling (24 props
  total)** — same as session-62's rejection. The flat prop shape is
  grep-able and the modals are stable contracts. Adding a
  `DirectiveFormContext` would save lines but add indirection.

## Verification

- All 1086 unit tests pass (180 suites, +20 from this session: 11
  `run-mutation` + 9 `health-message`)
- `npx tsc --noEmit` clean
- `CI=true npx eslint . --max-warnings 0` clean
- `npm run build` passes
- `grep -nE "status: (400|404|500)" src/app/api/{sessions,logs,memory,monitor}/**/*.ts` — 0 hits
  (unchanged from session 61)
- `grep -c "setBusy(false)\|setAdding(false)\|setCreatingDirective(false)\|setSavingDirective(false)\|setCreatingModel(false)\|setSavingModel(false)" src/components/memory/HindsightBrowser.tsx` — 0 hits
  (was 6: 1 per mutation handler. The finally block lives in
  `runMutation` now.)

## Files touched

- `src/components/memory/hindsight/run-mutation.ts` (NEW) — 95-line helper
- `src/components/memory/hindsight/health-message.ts` (NEW) — 50-line helper
- `src/lib/api-fetch.ts` (MODIFIED) — exported `SafeApiCallResult<T>` type
- `src/components/memory/HindsightBrowser.tsx` (MODIFIED) — 5 handlers use
  `runMutation`; 6 inline form literals → `EMPTY_DIR_FORM` / `EMPTY_MODEL_FORM`
- `src/components/memory/hindsight/HealthBanner.tsx` (MODIFIED) — 6-line
  inline ternary → `healthBannerMessage(health)` call
- `src/app/(main)/logs/page.tsx` (MODIFIED) — `filteredLines` perf fix
- `tests/unit/run-mutation.test.ts` (NEW) — 11 tests
- `tests/unit/health-message.test.ts` (NEW) — 9 tests
- `references/control-hub-list1-session65-findings.md` (this file)

## Patterns to take forward

1. **`runMutation`-style handlers for repeated toast + try/finally
   boilerplate** — the 5 Hindsight mutation handlers are a prototype.
   When a future page adds 3+ mutation handlers with the same shape,
   extract the same pattern. Common candidates: `cron/page.tsx`,
   `missions/page.tsx`, `models/*` — these have handler chains that
   could collapse to ~12 lines each with this pattern.
2. **Form-state "EMPTY_X" module constants** — when a form has
   ≥3 inlined `{...}` literals (useState init + on-close + post-save
   reset), pull the empty form into a `const EMPTY_X: X = {...}`. The
   6× duplication in HindsightBrowser was the trigger; the
   1-token-reset call is a strict readability win.
3. **Pre-compute filter inputs in `useMemo` predicates** — for any
   `arr.filter(item => item.X.toLowerCase().includes(constant))` pattern,
   hoist the `constant.toLowerCase()` outside the predicate. The
   `logs/page.tsx` fix is a template for future filter pages.
4. **Helper-extraction testability exception** (re-confirmed) — the
   `healthBannerMessage` 1-callsite extraction is the 2nd time the
   session-57 "3+ branches + non-trivial heuristic" testability
   exception has been applied in this codebase (the 1st was
   `isHindsightConnectionError` in session 57 itself). When the helper
   is small + pure + has a 3+ branch decision tree, extract it even
   with 1 callsite.
