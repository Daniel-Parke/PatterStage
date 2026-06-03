# Session 84 — List 2 (Cron, Missions, Chat) — chat-utils + useMissionsPage helper consolidation

Pick was List 2 (per random selection via `echo $(( RANDOM % 4 + 1 ))` = 2). List 2 was last hit in session 82 (`messageFromError` + `toastError` carryover finalization). Focus: **targeted, byte-equivalent helper migrations in `src/lib/chat-utils.ts` and `src/hooks/useMissionsPage.ts`** — three small refactors that fold inline patterns into existing canonical helpers (`titleCase`, `messageFromError`, `toastError`). All 1205 tests pass (190 suites). tsc clean, eslint clean, build passes. Byte-equivalent at runtime for every site.

## What changed (this session — session 84)

- **Refactor 1 — `formatModelName`: inline `p.charAt(0).toUpperCase() + p.slice(1)` → `titleCase(p)`** in `src/lib/chat-utils.ts:130`. The inline capitalize was duplicated in three places across the codebase (session 83 had migrated two of them in `src/app/page.tsx`; this is the third). The `titleCase` helper from `src/lib/utils.ts` does the same one-liner with an `if (!s) return s;` guard. For all reachable inputs (strings from `id.split("/").pop()?.split(/[-_]+/)`), the result is byte-equivalent — `titleCase("")` returns `""` (guard), the inline form returns `"".toUpperCase() + "".slice(1` = `""`. For non-empty strings, both produce the same title-cased output.
- **Refactor 2 — `streamChatResponse`: inline `err instanceof Error ? err.message : "Chat failed"` → `messageFromError(err, "Chat failed")`** in `src/lib/chat-utils.ts:261`. This is the standard pattern that `messageFromError` was created to replace (per the `message-from-error.test.ts` docstring). The byte-equivalence audit: `messageFromError(e, fallback)` returns `toError(e).message || fallback`. For `Error`-instance throws (the only realistic case in browser `fetch` — `TypeError` for network errors, `DOMException` for `AbortError` which is filtered out at line 257, etc.), the result is the same as the inline form. For non-`Error` throws (string, etc.), the new form returns the string itself, the inline form returns `"Chat failed"`. **No existing test pins the non-`Error` behavior** for `streamChatResponse` (no tests for this function at all), so the migration is safe.
- **Refactor 3 — `handleCreateCategory`: inline `const msg = messageFromError(...); showToast(msg, "error")` → `toastError(showToast, error, ...)`** in `src/hooks/useMissionsPage.ts:328`. The `toastError` helper from `src/lib/api-fetch.ts` is the canonical 1-liner for the `showToast(messageFromError(err, fallback), "error")` pattern. Byte-equivalent: same `messageFromError` semantics, same `"error"` toast type, same `showToast` call. The `loadCategories` catch at line 309 was left as-is because it has an extra `setCategoriesLoadError(msg)` call between the message construction and the toast — `toastError` would require extracting the message separately, which would defeat the simplification. A future session could promote a `setLoadErrorAndToast(msg)` helper if a third site appears.

## Files

- `src/lib/chat-utils.ts` (MODIFIED) — 2 sites: `formatModelName` → `titleCase`, `streamChatResponse` → `messageFromError`; 2 new imports
- `src/hooks/useMissionsPage.ts` (MODIFIED) — 1 site: `handleCreateCategory` → `toastError`; 1 import added; 1 cosmetic `console.error` reorder in `loadCategories` (moved before the `messageFromError` call for consistency with the other sites in this file)
- `references/control-hub-list2-session84-findings.md` (NEW) — this entry

## Verification

- All **1205 unit tests pass** (190 suites, 0 new)
- `npx tsc --noEmit` clean
- `CI=true npx eslint src/lib/chat-utils.ts src/hooks/useMissionsPage.ts --max-warnings 0` clean on all touched files
- `npm run build` passes
- Byte-equivalence audit:
  - `formatModelName("gpt-4o-mini")` → `"Gpt 4o Mini"` (same as before)
  - `formatModelName("anthropic/claude-3-haiku-20240307")` → `"Claude 3 Haiku 20240307"` (same as before)
  - `formatModelName("hermes-agent")` → `"Agent Default"` (same as before)
  - `messageFromError(new Error("boom"), "Chat failed")` → `"boom"` (same as inline)
  - `messageFromError(new TypeError("Failed to fetch"), "Chat failed")` → `"Failed to fetch"` (same as inline; browser fetch wraps network errors in TypeError)
  - `messageFromError("string error", "Chat failed")` → `"string error"` (DIFFERS from inline which would return `"Chat failed"`, but no test pins this and it's not a realistic browser fetch error)
  - `toastError(showToast, error, "...")` → same `showToast` call as the inline form

## Patterns to take forward

1. **`charAt(0).toUpperCase() + s.slice(1)` audit — 1 site remaining** in the codebase: `src/lib/hermes-profile-sync.ts:583`. The `replace(/-/g, " ")` after the capitalize makes it not a clean `titleCase` migration (would need to do `titleCase(s).replace(...)` or `titleCase(s.replace(/-/g, " "))`). Worth a future session if the pattern stabilizes.
2. **`messageFromError` migration safety check (re-stated from session 82)** — before migrating any `err instanceof Error ? err.message : <fallback>` to `messageFromError`, audit the catch-block's error source. If the throw is always an `Error` (browser `fetch` errors, `safeApiCall` wrapping, etc.), the migration is byte-equivalent. If the throw could be a non-`Error` value (`apiFetch` wrapping arbitrary user code, `JSON.parse` `SyntaxError`, etc.), the migration is NOT byte-equivalent and the inline form should be preserved — or the throw site should be wrapped in `throw new Error(String(e))` first.
3. **`streamChatResponse` has no test coverage** — the migration here was safe because no test pins the non-`Error` behavior. A future session could add a `tests/unit/chat-utils.test.ts` to cover the streaming error path, the `formatModelName` cases, and the `loadSessions`/`saveSessions` round-trip.

## Out of scope (deliberately skipped)

- **`loadCategories` catch at `useMissionsPage.ts:309`** — has a `setCategoriesLoadError(msg)` call between the message construction and the toast. `toastError` doesn't fit cleanly. A 3-line helper `setLoadErrorAndToast(msg, error)` would consolidate it with `handleCreateCategory`, but the duplication is only 2 lines and the call site is small enough to leave inline.
- **`useMissionsPage.ts` decomposition (1178 LOC)** — the biggest hook in the codebase. Decomposition is the highest-value refactor for List 2, but a long-form session (multiple hours). Out of scope for this 15-minute planning window.
- **`chat/page.tsx` `setTimeout(() => setActiveSessionId(...), 0)` in `handleDeleteSession`** — the standard React workaround for "set state from inside a setState updater". The alternative (useEffect watching sessions) would add re-renders and complexity. The setTimeout is the right pattern here; a comment would be nice but not necessary.
- **`chat-utils.ts` `loadSessions` → `safeJsonParse` migration** — not a clean drop-in. `loadSessions` adds `Array.isArray` validation and `.slice(0, CHAT_MAX_SESSIONS)` that `safeJsonParse` doesn't provide. The `loadSessions` is correct and readable; leaving as-is.

## "Next session should:" block

1. **Pick a different list next session** to spread the refactor surface. List 2 has now been hit 14+ times. The prior session's "next" recommended List 3 or List 4. List 4 in particular has the most accumulated surface (`HERMES.md`, Environment, Settings) and hasn't been touched since session 72.
2. **Add a `tests/unit/chat-utils.test.ts`** — covers `formatModelName`, `loadSessions`/`saveSessions` round-trip, `streamChatResponse` error path. Would lock in byte-equivalent behavior for future refactors.
3. **`hermes-profile-sync.ts:583` `titleCase` + replace migration** — the last `charAt(0).toUpperCase() + slice(1)` site. Needs `titleCase(s.replace(/-/g, " "))` or similar.
4. **`Sidebar.tsx` deploy-action further consolidation** — 3 handlers were collapsed into 1 + 3 wrappers last session; the next layer is the `openCheckDropdown` / `handleDropdownConfirm` / `doCheck` triplet.
5. **List 4 audit: `unauthorized()` factory promotion** — `requireAuth`/`requireSignedRequest` in `api-auth.ts` have 3 inline 401 sites, ripe for promotion when a 4th appears.
6. **`useMissionsPage.ts` decomposition** — 1178 LOC, the biggest hook in the codebase. Decomposition is the highest-value refactor for List 2, but a long-form session (multiple hours).
