# List 1 sweep — session 57 (control-hub, 2026-06-02)

Random pick: **List 1** (Dashboard, Sessions, Memory, Logs). Last List 1 session
was 54 (`logValidationError` helper). The surface is largely picked clean across
the 9 prior List 1 sessions; the productive work this time was small-bore
refactors + a behaviour-cleanup bug. Three findings, all small.

## Findings

### 1. `handleCronScheduleChange` calls `void refreshMonitor()` 3× on the failure path

**File:** `src/app/page.tsx`

The dashboard's `handleCronScheduleChange` does an optimistic local state
update, then a PUT to `/api/cron`. The original error-rolling-back code was:

```ts
try {
  const { ok, error } = await safeApiCall("/api/cron", { method: "PUT", body: {...} });
  if (!ok) {
    showToast(error || "Failed to update cron schedule", "error");
    void refreshMonitor();  // ← call A
    return;
  }
  showToast("Schedule updated", "success");
} catch {
  showToast("Failed to update cron schedule", "error");
  void refreshMonitor();    // ← call B
} finally {
  void refreshMonitor();    // ← call C — runs on all paths
}
```

The `finally` block (call C) already covers all three paths (success,
`!ok` return, thrown). Calls A and B are redundant — on the failure path
`refreshMonitor()` was running twice in a row, hammering `/api/monitor`
for no reason.

**Fix:** drop the two inline `void refreshMonitor()` calls and keep only the
`finally` block. Behavior preserved: one refresh on every path (was one
refresh on success, two on failure).

This is the **session-35 pattern** (`setSaving(false) finally-block cleanup`)
applied to a `refreshMonitor()` call instead of a state setter. Session 35
covered the same shape in `EditPersonalityModal.handleSubmit`; the same
shape reappeared here.

**Detection recipe:** `rg -nA 10 "useCallback.*async" src/app/ | rg "void \w+\(\)"`
and audit the surrounding `try/catch/finally` for redundant pre-finally calls.

### 2. Mission-output file lookup in `/api/sessions/[id]` is a 2x `existsSync` ladder

**File:** `src/app/api/sessions/[id]/route.ts:134`

The original code had:

```ts
const missionFile = join(PATHS.missions, `${dbSession.missionId}.session`);
const missionLog  = join(PATHS.missions, `${dbSession.missionId}.output.log`);
const sessionPath = existsSync(missionFile) ? missionFile : existsSync(missionLog) ? missionLog : null;
```

This is exactly the `findFileWithExtension(dir, baseName, extensions)` pattern
extracted in session 48 and already imported in this same file for the
legacy JSON/JSONL session lookup at line 124. The route was inconsistent —
used the helper for the legacy file lookup, hand-rolled the 2x `existsSync`
ladder for the mission-output branch.

**Fix:** replace with `findFileWithExtension(PATHS.missions, dbSession.missionId, [".session", ".output.log"])`.
Hoisted the extension list to a module constant `MISSION_FILE_EXTENSIONS`
so the preference order is documented in one place. Net -3 lines in the
route + 1 module constant.

**Byte-equivalence audit (session-51 discipline):** the original code preferred
`.session` over `.output.log`; the helper iterates `extensions` in order, so
passing `MISSION_FILE_EXTENSIONS = [".session", ".output.log"]` preserves the
preference order exactly. No behaviour change.

**Detection recipe:** `rg -n "existsSync\(.*\) \?" src/app/api/` — any inline
ternary ladder matching `existsSync(fileA) ? fileA : existsSync(fileB) ? fileB : null`
is a `findFileWithExtension` candidate. The only hit in List 1 was this one
(the helper is already used in 2 other places in the same file).

### 3. `isConnectionError` substring heuristic in `/api/memory/hindsight` is inline

**File:** `src/app/api/memory/hindsight/route.ts` (GET catch)

The catch branch had a 6-line substring match on `error.message` to decide
between 503 (upstream not responding) and 500 (other code error):

```ts
const isConnectionError =
  error instanceof Error &&
  (error.message.includes("connect") ||
   error.message.includes("ECONNREFUSED") ||
   error.message.includes("refused") ||
   error.message.includes("timed out"));
return NextResponse.json({...}, { status: isConnectionError ? 503 : 500 });
```

The same heuristic isn't used anywhere else in the codebase, so it's
not a Rule-of-Three consolidation candidate. The win from extracting
is **testability** — the heuristic was untested (no test could assert
"a timeout returns 503") and the substring tokens were not documented.

**Fix:** extracted to `isHindsightConnectionError(error: unknown): boolean`
in the same route file, exported. **10 new unit tests** in
`tests/unit/hindsight-connection-error.test.ts` cover the 4 positive
substrings (`"connect"`, `"ECONNREFUSED"`, `"refused"`, `"timed out"`),
the negative case (an unrelated Error), the empty-message case, the
non-Error values (string, undefined, null, number, plain object), a
substring-in-the-middle case (the Hindsight bridge's actual error
format), and a documented false-positive (`"refused to start"` matches
because the substring is `refused` — pinned so a future tightening
to a word-boundary match is a deliberate change).

## What was rejected

- **4× `available: false` envelopes in hindsight** — not candidates for
  `badRequest()` because the shape is a soft-fail `200/500` envelope with
  `data: { available: false, ... }`, not a `400 { error }`. Different
  contracts; keep them inline.
- **Batched initial-load 8× `safeApiCall` in `useEffect`** — would need
  a new "batch-unwrap" helper. The `unwrapPollPath` helper is the
  polling equivalent but is not used in the one-time batch; the seven
  `?.data?.data ?? X` extractions differ only in the default (4 use `?? null`,
  4 use `|| []`). 8 lines of repetition, not enough to justify a new
  helper. Left alone.
- **`LogsPage` `useToast` vs `actionMessage`** — the page has its own
  `actionMessage` state instead of `useToast`. The reason is that
  `actionMessage` is a status banner that persists until the user
  dismisses it (toast is transient), and the success message
  ("Cleared N log file(s)") is content, not a flash notification.
  Different UX semantics; not a refactor target.

## Verification

- 977 tests pass (was 967, +10 from `isHindsightConnectionError` tests)
- `npx tsc --noEmit` clean
- `npx eslint` clean on all 4 touched files
- `npx next build` succeeds (no new warnings; the pre-existing
  Turbopack NFT warning is unchanged)

## Files touched

- `src/app/api/sessions/[id]/route.ts` — refactor 2 (-3 net lines, +1 module constant)
- `src/app/api/memory/hindsight/route.ts` — refactor 3 (-4 inline lines, +1 exported helper, +8 JSDoc lines)
- `src/app/page.tsx` — refactor 1 (-4 inline lines, +3 comment lines)
- `tests/unit/hindsight-connection-error.test.ts` — new file, 10 tests
