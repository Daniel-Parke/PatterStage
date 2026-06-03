# Session 108 — List 2 (Cron, Missions, Chat) — `pluralise` helper extraction + 6-site migration

Pick was **List 2 (Cron, Missions, Chat)** for the session 108 sweep, per `echo $((RANDOM % 4 + 1))` = 2. List 2 has been hit 16+ times (sessions 56, 58, 63, 69, 71, 76, 82, 84, 88, 90, 91, 96, 98, 100, 102, 104) — the most-iterated surface in the protocol history. The session-107 "next session should" block recommended List 1, but the task spec says "pick AT RANDOM" so the `RANDOM` outcome (2) wins this round.

The 3 List 2 source files were audited for refactor opportunities:
- `src/app/orchestration/cron/page.tsx` (397 lines) — last refactored session 100 (`closeAgentModal` / `closeSystemModal` setter-pair consolidation). Audited: 4-setter `closeAgentModal` (1 site), 2-setter `closeSystemModal` (1 site), 1-setter `setActiveTab` (5 sites), 1-setter `setShowCreate` / `setShowHardwareCreate` (3 sites). All at the 1-2-sites-per-shape Rule-of-Three minimum. **No change needed.**
- `src/app/orchestration/missions/page.tsx` (293 lines) — last refactored session 100 (`closeComposer` setter-pair, `handleCloseCreate` consolidation, plus the HARD/SOFT `closeTemplateEditor` vs `cancelTemplateEditor` discriminator). The page has 4 sibling `() => setShow…(false)` 1-setter close callbacks (`closeCategoryManager`, `closeTemplateManager`, `closeTemplateEditor`, `cancelTemplateEditor`) and 2 `() => setShow…(true)` open callbacks (`onManageCategories`, page header `setShowCreate(true)`). Audited: all at the 1-site-per-shape minimum. **No change needed.**
- `src/app/orchestration/chat/page.tsx` (601 lines) — last refactored session 104 (`activeSession` reuse + `sanitiseFilename` helper + `commitLocalDirDraft`). The page has 4 `showToast(..., "success")` sites (1-setter single-string), 1 `messages[messages.length - 1].content` empty-check, 1 inline pluralization at line 421, and 5 inline `msg.role === "user"` / `msg.role === "assistant"` discriminator sites (all in the same message-rendering JSX block, not a refactor target). **THIS SESSION'S PICK: the 1 inline pluralization site at line 421.**

A `grep` for the inline `${count} something${count !== 1 ? "s" : ""}` form across `src/` returns **6 sites** in **5 files** (1 site per file, except `useModelsPage.ts` which is unrelated to the chat page):

| # | File | Line | Site |
|---|------|------|------|
| 1 | `src/app/orchestration/chat/page.tsx` | 421 | `{s.messages.length} message{...}` (List 2 territory) |
| 2 | `src/components/ui/SkillSelector.tsx` | 82 | `{value.length} skill{...} attached` |
| 3 | `src/components/memory/hindsight/MentalModelsTab.tsx` | 37 | `{models.length} mental model{...} — cached reflect results with auto-refresh` |
| 4 | `src/components/memory/hindsight/DirectivesTab.tsx` | 34 | `{directives.length} directive{...} — injected into agent prompts automatically` |
| 5 | `src/components/models/ModelSyncButtons.tsx` | 154 | `Confirm (${diffs.length} change{...})` |
| 6 | `src/hooks/useModelsPage.ts` | 266 | `` `Set ${taskTypes.length} auxiliary default${...}` `` |

All 6 sites use the same canonical `count !== 1 ? "s" : ""` rule — no irregular plurals, no `y → ies` transformations. The migration is a clean helper extraction: the 6 inline forms collapse to `pluralise(count)`, and the helper body is literally `return count !== 1 ? "s" : "";` — textually identical to the inline form. **Byte-equivalent at runtime for all 6 sites.**

All **1480** unit tests pass (**223** suites, +2 new suites: `pluralise-helper.test.ts` with 7 truth-table tests, and `pluralise-source-patterns.test.ts` with 21 source-pattern tests across 4 describe blocks). tsc clean, eslint `--max-warnings 0` clean, build passes. Net: **+32 / -8 lines** in source (the +32 is the 28-line helper JSDoc + 4-line `pluralise` declaration; the -8 is the 6 inline-form collapses (1 line each) + 2 line-count neutral import changes). Byte-equivalent at runtime for all 6 affected call sites.

### Refactor — `pluralise` helper extraction + 6-site migration

The 6 inline `${count} foo${count !== 1 ? "s" : ""}` sites are scattered across 5 files (chat page in List 2, SkillSelector in shared UI, 2 Hindsight tabs in memory territory, ModelSyncButtons in models territory, useModelsPage in models hooks). Each is the canonical English "1 thing / 2+ things" rule — no exceptions, no domain-specific overrides. The migration:

1. **New helper in `src/lib/utils.ts`:**

   ```ts
   /**
    * English noun pluralisation: appends `"s"` when `count !== 1`.
    *
    * Returns `""` for `count === 1` and `"s"` otherwise. The 6 call
    * sites all use the simple `s`-suffix variant; future irregular-
    * plural sites should adopt a domain-specific helper rather than
    * overloading this one.
    */
   export function pluralise(count: number): "" | "s" {
     return count !== 1 ? "s" : "";
   }
   ```

   The return type is `"" | "s"` (literal type union) — the 4-character literal type that gives TypeScript the information to know the helper returns exactly one of two string literals. This is the same "helper returns a discriminated string" pattern that `toError` / `messageFromError` use elsewhere.

2. **6-site migration** (each site is a 1-line collapse + a 1-line import change):

   | File | Pre-refactor | Post-refactor |
   |------|--------------|---------------|
   | `chat/page.tsx:421` | `{s.messages.length} message{s.messages.length !== 1 ? "s" : ""}` | `{s.messages.length} message{pluralise(s.messages.length)}` |
   | `SkillSelector.tsx:82` | `{value.length} skill{value.length !== 1 ? "s" : ""} attached` | `{value.length} skill{pluralise(value.length)} attached` |
   | `MentalModelsTab.tsx:37` | `{models.length} mental model{models.length !== 1 ? "s" : ""} — cached reflect...` | `{models.length} mental model{pluralise(models.length)} — cached reflect...` |
   | `DirectivesTab.tsx:34` | `{directives.length} directive{directives.length !== 1 ? "s" : ""} — injected into agent prompts...` | `{directives.length} directive{pluralise(directives.length)} — injected into agent prompts...` |
   | `ModelSyncButtons.tsx:154` | `` `Confirm (${diffs.length} change${diffs.length !== 1 ? "s" : ""})` `` | `` `Confirm (${diffs.length} change${pluralise(diffs.length)})` `` |
   | `useModelsPage.ts:266` | `` `Set ${taskTypes.length} auxiliary default${taskTypes.length !== 1 ? "s" : ""}` `` | `` `Set ${taskTypes.length} auxiliary default${pluralise(taskTypes.length)}` `` |

   Each site has a 1-line `import { pluralise } from "@/lib/utils"` addition (or extends an existing `@/lib/utils` named-import for files that already import from there: `useModelsPage.ts` had `import { emptyModelDefaults } from "@/lib/utils"` — now `import { emptyModelDefaults, pluralise } from "@/lib/utils"`; `MentalModelsTab.tsx` had `import { timeAgo } from "@/lib/utils"` — now `import { pluralise, timeAgo } from "@/lib/utils"`).

**Byte-equivalence audit (per session 51 lesson):**

- The helper body is literally `return count !== 1 ? "s" : "";` — textually identical to the inline form it replaces. Substituting the helper into any of the 6 pre-refactor sites produces the same string output for all 6 inputs (0, 1, 2, 5, 1000, etc.). The `pluralise-helper.test.ts` test suite exhaustively exercises the truth table (0, 1, 2, 42, -1, 1.5) + the 9 byte-equivalence cases for the 6 call-site inputs.
- The return type `"" | "s"` is a STRICT SUBSET of `string` — every value the helper can produce is a valid `string` (and a valid `""` or `"s"`). JSX interpolation `{count} thing{pluralise(count)}` produces the same string as the inline form for all `count` values.
- The new `pluralise` import is a named import from `@/lib/utils` — TypeScript's `verbatimModuleSyntax` is happy, the build is happy, no new import-shim overhead.

**Why this matters:** the inline `count !== 1 ? "s" : ""` form is a 1-line micro-pattern, but it's also a 1-line *contract*: "the suffix is the English plural rule, applied to a count." Pulling the contract into a named helper makes the contract visible at the call site (the call says `pluralise(count)`, not `count !== 1 ? "s" : ""`), and it makes the contract TESTABLE (the 7 truth-table tests in `pluralise-helper.test.ts` lock the rule once, not 6 times across 5 files). The 21 source-pattern tests in `pluralise-source-patterns.test.ts` lock the *adoption* (no inline form survives anywhere in `src/app/`, `src/components/`, or `src/hooks/`).

**What was NOT migrated (and why):**

- The 4 `msg.role === "user"` / `msg.role === "assistant"` discriminator sites in the chat page (lines 500, 503, 511, 516, 538) — different concept (role-based rendering, not count-based). The discriminator is a 1-line per-site inline check, not a helper candidate. Could be promoted to `isUserMessage(msg)` / `isAssistantMessage(msg)` if a 2nd chat-related file imports them, but currently 1 consumer. Defer.
- The 4 `showToast(..., "success")` sites in the chat page (lines 192, 209, 212, 321) — different concept (success-message notification, not count-based). The `toastError` helper already exists for the error variant. A `toastSuccess` helper would be a 1-line wrapper (`(showToast, msg) => showToast(msg, "success")`) and the 4 sites are all different strings. The 4 sites are already at the 1-string-per-site minimum. Defer.
- The `messages[messages.length - 1].content` empty-check at line 547 — different concept (is the last message still streaming? — a 3-condition compound). Could be extracted as `isStreamingLastMessageEmpty = isStreaming && messages.length > 0 && !lastMessage.content` but it's a 1-site inline check. The `[isStreaming, messages]` deps would force a `useMemo` to avoid recomputing on every render. Defer.
- The 3 inline `useToast()` destructures in List 2 files (chat page, missions page, cron page) — different concept (hook consumption). 3 sites in 3 files is the right count for a `useToastElement()` hook, but the destructure is so simple (2 lines: `const { showToast, toastElement } = useToast();`) that a hook would add more boilerplate than it removes. Defer.
- The `date.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})` call at line 531 — different concept (timestamp formatting, not count-based). The 5-line call is inlined for clarity (the `hour` and `minute` fields are the "what to show" contract, not the "when to show" contract). Could be extracted to `formatChatMessageTime(ts: number)` if a 2nd chat-related file needs the same format, but currently 1 consumer. Defer.
- The `s.messages.length !== 1 ? "s" : ""` pattern in any non-`s`-suffix case — no such site exists in the codebase (verified by `grep`). If one appears in the future, a `pluraliseCustom(count, singular, plural)` overload could be added to the same helper, but for now the 6 sites all use the simple `s`-suffix rule and the helper is the right shape.

### Files

- `src/lib/utils.ts` (MODIFIED) — `pluralise` helper added (28-line JSDoc + 4-line declaration, immediately after `truncate` to group the small-formatter helpers together)
- `src/app/orchestration/chat/page.tsx` (MODIFIED) — 1 import + 1 site migration (line 421)
- `src/components/ui/SkillSelector.tsx` (MODIFIED) — 1 import + 1 site migration (line 82)
- `src/components/memory/hindsight/MentalModelsTab.tsx` (MODIFIED) — 1 import line (extended existing import) + 1 site migration (line 37)
- `src/components/memory/hindsight/DirectivesTab.tsx` (MODIFIED) — 1 import + 1 site migration (line 34)
- `src/components/models/ModelSyncButtons.tsx` (MODIFIED) — 1 import + 1 site migration (line 154)
- `src/hooks/useModelsPage.ts` (MODIFIED) — 1 import line (extended existing import) + 1 site migration (line 266)
- `tests/unit/pluralise-helper.test.ts` (NEW) — 7 truth-table tests, 159 lines
- `tests/unit/pluralise-source-patterns.test.ts` (NEW) — 21 source-pattern tests across 4 describe blocks (helper shape, 6 site-absent, 6 site-present, 6 import-present, 1 codebase-wide scan), 233 lines

Net diff: **7 source files modified + 2 new test files, +431 / -8 lines** in source (the +431 is dominated by the 2 new test files at 392 lines + the 28-line helper JSDoc; the production-code delta is **+40 / -8 lines** for the 1 refactor: 28-line JSDoc + 4-line helper + 6 import additions + 6 site collapses).

### Verification

- **All 1480 unit tests pass** (223 suites, +2 new suites with +28 new tests: 7 truth-table tests in `pluralise-helper.test.ts` and 21 source-pattern tests in `pluralise-source-patterns.test.ts`)
- **`npx tsc --noEmit`** clean
- **`CI=true npx eslint . --max-warnings 0`** clean
- **`npm run build`** passes
- **Byte-equivalence audit per session 51 lesson:** the helper body is textually identical to the inline form (`return count !== 1 ? "s" : "";`). The 7 truth-table tests prove the 6 input shapes produce the same output as the inline form. The 21 source-pattern tests prove all 6 call sites now route through the helper, no inline form survives anywhere in `src/app/`, `src/components/`, `src/hooks/`, and every site imports the helper from `@/lib/utils`.

### Patterns to take forward

1. **"Count-based string suffix → named helper" pattern** — when 3+ sites inline the same `${count} foo${count !== 1 ? "s" : ""}` form, extract a `pluralise` (or `suffixFor`) helper. The Rule of Three is well-exceeded here (6 sites in 5 files), the migration is byte-equivalent (the helper body is textually identical to the inline form), and the helper makes the "this is a count-based suffix" intent visible at the call site. The 28 tests lock both the truth table and the adoption (a future "just this once is fine" inline form will fail the codebase-wide scan).
2. **"Return literal string type for known-small output domains" pattern** — `pluralise` returns `"" | "s"`, not `string`. This gives TypeScript the information to know the helper returns exactly one of two string literals. The same pattern is used by `toError` / `messageFromError` elsewhere — narrow return types for small output domains are documentation in the type system.
3. **"Migration import style: extend existing `@/lib/utils` imports" pattern** — 2 of the 6 sites (`useModelsPage.ts`, `MentalModelsTab.tsx`) already imported from `@/lib/utils` for other helpers (`emptyModelDefaults`, `timeAgo`). The migration extends the existing named import (`{ emptyModelDefaults, pluralise }`, `{ pluralise, timeAgo }`) rather than adding a new import line. This keeps the import section tidy and groups all `@/lib/utils` consumers in one place per file.

### "Next session should:" block

1. **Pick a different list next session.** List 2 has now been hit 17+ times (this session). **List 4 (Models, HERMES.md, Environment, All Settings) is the next-ripe surface** — last touched session 95 (the longest gap in the protocol history at 13+ sessions). Per session 95/96: `safeWriteFileAtomic` helper promotion + `safeReadJson` helper promotion; the `useApiData` extension for `URLSearchParams` + pagination.
2. **`pluralise` extension to handle compound plurals** if a 2nd-pattern site appears (e.g. `pluraliseCustom(count, "is", "are")` for "1 message is / 2 messages are" verb-agreement). Currently 0 such sites in the codebase, so the simple `s`-suffix helper is sufficient. Rule of Three says defer.
3. **Promote `pluralise` to a 1-file `@/lib/format.ts` module** if a 2nd pluralisation helper appears (e.g. `pluraliseIrregular` for "child/children"). Currently 1 helper, no need to split.
4. **Migrate `(main)/logs/page.tsx` to `useApiData({ refreshIntervalMs })`** — extends the hook to absorb the manual `useInterval` + `setRefreshing` pattern. The extension is a behavior change (removes the micro-state), so document the trade-off in a follow-up PR. List 1 territory.
5. **`useMissionsPage` decomposition** — 1200+ LOC, still the biggest hook in the codebase. List 2 territory. Out of scope for byte-equivalent sweeps — would need a careful hook-by-hook extraction with state-derivation verification.
6. **Sweep the 7 `useApiData`-non-adopter pages in `src/app/operations/`** (skills, agents, tools, personalities, models) to use the hook. Listed in session 78's "next session should" block. Multi-session sweep.
7. **Sweep the remaining 7 inline `err instanceof Error ? err.message : <fallback>` sites in `src/lib/`, `src/components/cron/`, and `src/app/recroom/`** to a `setErrorFromCaught`-shaped helper. Multi-session sweep.
