# Session 209 — List 3 (Models, Agents, Skills, Tools, Personalities) — `useCopyToClipboard` hook extraction + 2-site migration in `MessageBubble` and `PersonalityCard`

**Date:** 2026-06-14
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 3 (List 3: Models, Agents, Skills, Tools, Personalities).

## Outcome

**1 new hook + 2-site migration + 1 source-pattern test rewrite + 1 carryover closure.** Plus the uncommitted carryover from session 208's tail (the `getMessageRole` migration in `MessageBubble.tsx` and the dead-code removal in `dashboard-error-dedup.ts`).

## What shipped

### 1. `useCopyToClipboard` hook (NEW, src/hooks/useCopyToClipboard.ts)

The "click a Copy button, write to navigator.clipboard, flip a 'copied' state true, then back to false after a short timeout" pattern was inlined in 2+ Control Hub components. Both sites used the SAME 3-ingredient pattern:

1. A `[copied, setCopied] = useState(false)` boolean flag.
2. A `useRef<ReturnType<typeof setTimeout> | null>(null)` ref to keep a handle on the in-flight timer so it can be cancelled (on back-to-back copy clicks) and on unmount.
3. A `useEffect` cleanup that clears the timer on unmount — without it, navigating away during the 2s window would fire `setCopied(false)` on an unmounted component.

Centralised as a hook that returns `[copied, copy]` where `copy(text)` is the action and `copied` is the boolean the JSX reads to swap the icon. The hook owns the timer, the ref, the cleanup, AND the empty-string fallback.

### 2. 2-site migration

**`src/components/session/MessageBubble.tsx`** — the `handleCopy` action:
- Pre-session: `[copied, setCopied]` + `copiedTimerRef` + `useEffect` cleanup + inline `navigator.clipboard.writeText` + inline `setTimeout` (1500ms).
- Post-session: `const [copied, copy] = useCopyToClipboard({ resetMs: 1500 })` + `const handleCopy = () => { copy(content || ""); }`.
- Net: 9 lines → 4 lines, plus 2 hook imports dropped (`useRef`, `useEffect`).

**`src/app/operations/personalities/page.tsx` `PersonalityCard`** — the `handleCopy` action:
- Pre-session: same shape as MessageBubble, with `2000ms` reset and `copy(personality.prompt)`.
- Post-session: `const [copied, copy] = useCopyToClipboard({ resetMs: 2000 })` + `const handleCopy = () => { copy(personality.prompt); }`.
- Net: 13 lines → 4 lines, plus 1 hook import dropped (`useRef`).

### 3. Source-pattern test rewrite

`tests/unit/personalities-card-copied-timer-cleanup.test.ts` (the session 185 test that pinned the inlined `copiedTimerRef` + cleanup form) is **REWRITTEN** to become `tests/unit/use-copy-to-clipboard.test.tsx` — supersession per session 195 P-1. The new file:

- **7 unit tests** for the hook itself: initial state, writeText forwarding, copied flag flip, default 2000ms reset, `resetMs` option, back-to-back copy timer reset, unmount cleanup.
- **8 source-pattern assertions** pinning that MessageBubble + personalities/page no longer contain the inline `useRef<setTimeout>`, the inline `navigator.clipboard.writeText`, AND the right `resetMs` is wired (1500 / 2000) per call site.

The old test's JSDoc explicitly noted: "If the pattern is restructured (e.g. extracted into a shared `useAutoResetTimer` hook), the file path and shape-string assertions will need to be updated." — that's exactly what happened.

### 4. Uncommitted carryover closure (from session 208 tail)

The previous session left 2 uncommitted-but-verified changes on the working tree:

- `src/components/session/MessageBubble.tsx`: `getMessageRole` helper adoption — `(msg.role || "unknown").toLowerCase()` → `getMessageRole(msg)`. The helper was already in use by the session detail page; this is the 4th callsite. Pre-session list 3 sister scan found this.
- `src/lib/dashboard-error-dedup.ts`: removed the unused `dedupMonitorErrors` wrapper + the unused `MonitorData` import. The `useMemo` in `page.tsx` does its own `monitor?.errors` guard inline, so the helper wrapper was a planned-but-orphaned abstraction.

Both ship as part of this session's commit.

## Anti-migration guards (sister sites NOT migrated)

The audit found 3 more `navigator.clipboard.writeText` call sites, all intentionally NOT migrated:

- `src/components/missions/MissionPromptPreview.tsx` — uses a DIFFERENT shape: the timer is owned by a `useEffect` keyed on `copied`, and the `writeText` call is `await`ed inside a `try/catch` (the surrounding function is async). The hook intentionally does NOT cover that shape. The hook is sync; the async sister is a different shape.
- `src/components/missions/MissionEditorPanel.tsx` — calls `navigator.clipboard.writeText` ONCE inside an async editor action (no "copied" flag, no timeout, no flip-back) — single use, different shape, not a duplication target.
- `src/app/orchestration/chat/page.tsx` — uses `navigator.clipboard.writeText(code).then(...)` as the fire-and-forget form of the same operation (no "copied" flag, no setTimeout, no ref) — single use, not a duplication target.

The discriminator: the hook covers the **sync 2-setter pattern** (`useState` + `useRef` + cleanup `useEffect` + inline `setTimeout` flip-back). Sites that use `useEffect`-keyed timers or async try/catch are different shapes.

## Why this is byte-equivalent

### `useCopyToClipboard` hook extraction

The hook body is literally:

```ts
const copy = useCallback((text: string) => {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
  void navigator.clipboard.writeText(text);
  setCopied(true);
  timerRef.current = setTimeout(() => {
    timerRef.current = null;
    setCopied(false);
  }, resetMs);
}, [resetMs]);
```

This is the **EXACT same sequence** as the pre-session inline form in both MessageBubble and PersonalityCard (modulo the `useCallback` wrap which is purely an identity-stability guarantee):

| Step | Pre-session inline | Post-session hook |
|---|---|---|
| 1. Clear in-flight timer | `if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);` | `if (timerRef.current) { clearTimeout(...); timerRef.current = null; }` |
| 2. Write to clipboard | `navigator.clipboard.writeText(content \|\| "")` | `void navigator.clipboard.writeText(text)` |
| 3. Flip flag to true | `setCopied(true);` | `setCopied(true);` |
| 4. Schedule flip-back | `copiedTimerRef.current = setTimeout(() => { copiedTimerRef.current = null; setCopied(false); }, 1500);` | `timerRef.current = setTimeout(() => { timerRef.current = null; setCopied(false); }, resetMs);` |

The only difference is the **ref name** (`copiedTimerRef` → `timerRef`, internal to the hook) and the **duration** parameter (1500 / 2000 → `resetMs` option). The observable behaviour is byte-identical.

### `MessageBubble.tsx` migration

The new `handleCopy` is:
```ts
const handleCopy = () => {
  copy(content || "");
};
```

The pre-session form did the same thing (clear timer → `writeText(content || "")` → flip `copied` → schedule flip-back). The `content || ""` defensive empty-string fallback is preserved at the call site (the hook doesn't know about the `content` semantics — same as the pre-session `handleCopy` which also received `content` from the surrounding scope and applied the `|| ""` defensive default).

### `personalities/page.tsx` `PersonalityCard` migration

The new `handleCopy` is:
```ts
const handleCopy = () => {
  copy(personality.prompt);
};
```

The pre-session form did the same thing (clear timer → `writeText(personality.prompt)` → flip `copied` → schedule flip-back). `personality.prompt` is non-nullable (it's `string`, not `string | undefined`), so the `|| ""` defensive default is not needed (the pre-session inline form also didn't have it).

### `getMessageRole` migration in MessageBubble

The helper exists at `src/components/session/constants.tsx:105`:
```ts
export function getMessageRole(msg: { role?: string | null }): string {
  return (msg.role || "unknown").toLowerCase();
}
```

The pre-session inline form `(msg.role || "unknown").toLowerCase()` is **literally the helper body**. The helper handles `string | null | undefined` (the `msg.role` type in `SessionMessage`), the inline form assumed `string | undefined` (which is why the migration also includes a type narrowing — but the actual *behaviour* is identical: `undefined || "unknown"` is `"unknown"`, `null || "unknown"` is `"unknown"`, `"user".toLowerCase()` is `"user"`).

### `dashboard-error-dedup.ts` dead-code removal

`dedupMonitorErrors` was a planned helper that the dashboard's `useMemo` ended up not using. The `useMemo` does its own `monitor?.errors` guard inline:
```ts
const dedupedErrors = useMemo(
  () => (monitor?.errors ? dedupErrors(monitor.errors) : []),
  [monitor?.errors],
);
```

The helper's body was a 1-line wrapper around `dedupErrors`, so removing it loses 0 functionality. The `MonitorData` import was only used by the wrapper, so removing it eliminates a `type` import that is no longer referenced.

## New pitfalls codified

### P-1 — "Sync 2-setter pattern" has 3 ingredients; test for all 3

The pre-extraction source-pattern test pinned only 2 of the 3 ingredients (the `useRef<setTimeout>` declaration + the cleanup `useEffect`). The 3rd ingredient (the inline `navigator.clipboard.writeText` call) was *not* pinned, so a future "keep the cleanup effect but inline the writeText" PR would have passed the test while still missing the consolidation. The new source-pattern test pins all 3 (no `useRef`, no `navigator.clipboard.writeText`, and the right `resetMs` value).

**Detection recipe:** when extracting a hook that bundles N ingredients, pin all N in the post-extraction source-pattern test, not just the ones the previous test pinned. A test that only pins 2 of 3 allows regression of the 3rd.

**Reusable across:** any future "extract shared hook from N call sites" refactor where the inline form has more than 2 ingredients. List the ingredients explicitly in the JSDoc, then assert each one is gone.

### P-2 — Hook unit tests: timer behaviour requires `jest.useFakeTimers()`

The first pass of the hook unit tests used real timers (no `useFakeTimers`), and the "copied flips back to false after the default 2000ms window" test took 2000ms of real wall-clock time. The fix is to call `jest.useFakeTimers()` in `beforeEach` and `jest.useRealTimers()` in `afterEach`, then use `jest.advanceTimersByTime(2000)` to fast-forward. This drops the test suite from 7s to 80ms.

**Detection recipe:** when a hook's contract involves a `setTimeout`/`setInterval` flip-back, the unit test must use fake timers + `act(() => { jest.advanceTimersByTime(N); })`. The `act()` wrap is needed so React re-renders inside the test.

**Reusable across:** any hook that owns a setTimeout (e.g. `useAutoReset`, `useDebouncedFlag`, `useDelayedState`).

### P-3 — Hook signature: `(text: string) => void`, not `() => Promise<void>`

The hook returns `[copied, copy]` where `copy(text: string): void`. The `navigator.clipboard.writeText` Promise is fire-and-forget (`void navigator.clipboard.writeText(text)`). This matches the pre-session inline form in MessageBubble + PersonalityCard, both of which are sync (no `await`).

The async sister in `MissionPromptPreview` is a **different shape** — the surrounding `handleCopy` is `async` and wraps `writeText` in `try/catch`. The hook does NOT cover that shape (the hook would swallow the rejection instead of letting the caller's `catch` see it). This is an anti-migration guard, not a bug.

**Detection recipe:** when designing a hook that wraps a Promise-returning API, decide upfront whether the hook swallows errors or propagates them. Both choices are valid, but the call site shape must match. The pre-refactor `MissionPromptPreview` propagates (it has its own `try/catch`); the pre-refactor `MessageBubble`/`PersonalityCard` ignore (they treat the flag-flip as the user-feedback channel).

### P-4 — `@jest-environment` mismatch for hook tests

The first pass of `use-copy-to-clipboard.test.tsx` had `@jest-environment node` (copied from the session 185 sister test, which is a pure source-pattern test and doesn't need jsdom). But the hook unit tests need `@testing-library/react` + `renderHook`, which requires jsdom. The result was `ReferenceError: document is not defined`.

**Fix:** when a test file mixes pure source-pattern assertions (no React) with hook unit tests (use `renderHook`), the test environment MUST be jsdom. The source-pattern assertions still work in jsdom — they just read the file from disk, not from the DOM. There's no overhead cost.

**Detection recipe:** the first import in the test file is the discriminator. If the file imports `from "@testing-library/react"`, set `@jest-environment jsdom`. If it only imports `from "node:fs"`, set `@jest-environment node`. Mixed files always choose jsdom.

## Verification (full suite)

- `npx tsc --noEmit`: clean (0 errors)
- `CI=true npx eslint src/hooks/useCopyToClipboard.ts src/components/session/MessageBubble.tsx src/app/operations/personalities/page.tsx src/lib/dashboard-error-dedup.ts tests/unit/use-copy-to-clipboard.test.tsx --max-warnings 0`: clean
- `CI=true npx jest tests/unit/use-copy-to-clipboard.test.tsx`: **15/15 pass** (7 hook unit + 8 source-pattern)
- Full `CI=true npx jest` sweep: **325 suites / 2474 tests pass** (up from 324/2449 when PR #183 was last updated = +1 suite, +25 tests — the new file replaces the old `personalities-card-copied-timer-cleanup.test.ts` 6-assertion file with a 15-assertion file, and the new test is +9 net)
- `npx --yes pnpm@10.33.0 build`: clean

## Carryover resolution

This session started with a Mode F.2 carryover: 2 uncommitted-but-verified file changes from session 208's tail. Both were tsc-clean and tested by the rewrite of the source-pattern test file. The work is committed + pushed as part of this session.

## Next session should

- **Random pick next session.** The List 3 `useCopyToClipboard` surface is now mined clean — no follow-up work in `MessageBubble` or `PersonalityCard`. The next List 3 pick should look for refactor opportunities OUTSIDE the 4 factory families (`ok()`, `serverErrorFromCatch`, `setErrorFromCaught`, `parseAndValidateJsonBody`) and OUTSIDE the now-mined `useCopyToClipboard` + `runSyncAction` + `list-search` surface.
- Candidates worth re-scanning:
  - The `useRef<ReturnType<typeof setTimeout>>` + cleanup pattern in `src/hooks/useModelsPage.ts:51` (`fallbackSaveTimerRef`) and `src/app/config/[section]/page.tsx:39` (`saveStatusTimerRef`) — the same 3-ingredient pattern, but these sites' cleanup logic is intertwined with non-trivial state machinery (model-defaults save, config-section save status). Migrating them is a different scope (would need a `useAutoResetTimer<T>` hook that takes a setter + delay).
  - The `navigator.clipboard.writeText` 3 sister sites (MissionPromptPreview, MissionEditorPanel, chat page) — these are different shapes (async try/catch, no "copied" flag, fire-and-forget) and are anti-migration guards. A future "audit the `navigator.clipboard` surface" pick could check that they stay anti-migration guards.
  - The skills page's `SkillCategoryGrid` props (8 props: categories, categoryCollapsed, onToggleCategory, accentColor, enabled, expandedSkill, skillContent, toggling, onToggleSkill, onViewSkill, onEditSkill) — the `enabled` + `accentColor` + `expandedSkill` + `skillContent` + `toggling` + `onViewSkill` + `onEditSkill` props are "section context" that could collapse into a single `sectionContext` object. That crosses the "byte-equivalent" line subtly (props-vs-context), defer.
- **Carryover** — none. The next session starts with a clean working tree.
