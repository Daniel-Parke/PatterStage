# Session 198 — List 2 — `dispatchPayload` schedule integration in `useMissionsPage`

**Date:** 2026-06-13
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 2 (List 2: Cron, Missions, Chat).
**Status:** committed + pushed as `400abf8` (carryover closure from the prior session's tool-call budget exhaustion).

## What this refactor did

Moved the `schedule: scheduleForDispatch(newDispatch, newSchedule)` derivation from the 3 call-site overrides in `useMissionsPage.handleCreate` into the `dispatchPayload` helper body. The 3 call sites collapsed to `dispatchPayload()` / `dispatchPayload({ dispatchMode: newDispatch })`.

## The pattern: "always-the-same override is boilerplate"

When a helper takes a `Record<string, unknown>` overrides bag and multiple call sites pass the SAME expression as an override, the override is not a configuration — it's a re-computation. The override key was NOT adapting to per-call-site state; it was the EXACT same expression repeated at every call site.

### The discriminator

If you find yourself copy-pasting the same `key: <expr(closure)>` override at multiple call sites of a helper that already closes over the same state, the override is boilerplate — fold it into the body.

### When to use this pattern

- **YES**: a helper that takes an overrides bag AND multiple call sites pass the same mode-derived, state-derived, or closure-derived value.
- **NO**: a helper that takes an overrides bag AND call sites pass DIFFERENT values (the override is a real per-call-site configuration).

## The byte-equivalence argument

The 3 call sites passed `schedule: scheduleForDispatch(newDispatch, newSchedule)`. The helper closes over `newDispatch` and `newSchedule` via its `useCallback` deps. Moving the expression into the helper body (and adding the 2 keys to the deps array) produces:

- For cron mode: the wire payload includes `schedule: <expr>` (same as before).
- For non-cron modes: the `schedule: undefined` value is omitted by `JSON.stringify` (same as before — the pre-session override also produced `undefined` for non-cron modes, which `JSON.stringify` also drops).

The deps array gained 2 keys (`newDispatch, newSchedule`), so the helper's reference identity changes when those values change. The pre-session helpers that didn't close over `newDispatch`/`newSchedule` (only the 19 form-state slots) had a different deps array, so the helper's reference identity changes more often now. **However**, the 3 call sites don't depend on `dispatchPayload`'s identity directly — they call it inline in handler closures. The dependency change is internal to the helper, not external to the call sites. Byte-equivalent at the call-site level.

## What this session did NOT do

- Did not change `scheduleForDispatch`'s implementation — the helper is the canonical source of truth from `@/lib/dispatch-mode` and remains unchanged.
- Did not change the wire format of the `/api/missions` POST route — the route's `parseDispatchMode(dispatchMode, scheduleVal)` receives the same `scheduleVal` value.
- Did not migrate any of the 5+ `result.data?.data?.X` envelope double-unwrap sites in List 2 — that requires a new `safeApiCallEnvelope<T>` helper which is a different refactor.

## Verification

- `npx tsc --noEmit`: clean
- `CI=true npx eslint src/hooks/useMissionsPage.ts tests/unit/dispatch-payload-schedule-integration.test.ts --max-warnings 0`: clean
- `CI=true npx jest tests/unit/dispatch-payload-schedule-integration.test.ts`: 6/6 pass
- Full `CI=true npx jest` sweep: 317 suites / 2371 tests pass (up from 316/2365 = +1 suite, +6 tests)
- `CI=true npx --yes pnpm@10.33.0 build`: clean
