# List 1 sweep — session 62 (control-hub, 2026-06-03)

Random pick: **List 1** (Dashboard, Sessions, Memory, Logs). The last List 1
session was 61 (factory migration: 13 inline 400/404/500 sites across 5
routes). Sessions 58–60 covered Lists 2, 3, 4. This session re-audits the
List 1 surface for **non-factory** refactors: helpers that don't depend on
the API contract (which was closed by sessions 48/60) but on duplicated
UI-handler logic.

## Findings

### 1. `parseTagsInput` + `parseOptionalTagsInput` helpers (5× → 1)

**File:** `src/components/memory/HindsightBrowser.tsx`

The Hindsight modals (Add Memory, Directive create/edit, Mental Model
create/edit) all take a free-form "Tags (comma-separated)" input. Every
handler ran the same 3-step pipeline inline:

```ts
const tags = <X>Form.tags.split(",").map(t => t.trim()).filter(Boolean);
```

…and three of the five sites then folded the result with
`tags.length > 0 ? tags : undefined` so the JSON body omits the `tags`
key entirely when the user left the field blank (matches the Hindsight
API contract — sending `tags: []` works, but `tags: undefined` is what
the rest of the Hindsight code path produces and keeps the wire payload
tight).

**5× identical parse + 3× identical fold** is well past the Rule of Three.
Extracted to `src/lib/hindsight-tag-input.ts` as two named helpers
(`parseTagsInput` returns `[]`; `parseOptionalTagsInput` returns
`undefined` for empty input).

**Byte-equivalence audit (session-51):** every original site did the
splits + filters in exactly this order, so the produced arrays are
identical (modulo leading/trailing whitespace trimming, which all 5
sites already did). The `undefined` fold is a no-op for the 2 sites
that passed `tags` directly without the `? tags : undefined` check;
the helper is split into two named functions so each site picks the
variant that matches its previous behaviour exactly.

**15 new unit tests** in `tests/unit/hindsight-tag-input.test.ts` cover:
empty, whitespace-only, single tag, trim, double-comma drop, leading/
trailing-comma drop, commas-only, multi-word tags, special characters
(ch-deploy, hermes/gateway, v1.2.3), and the `undefined` fold on the
optional variant.

### 2. `setField(setter, key)` helper for 12× inline modal setter bodies

**File:** `src/components/memory/HindsightBrowser.tsx` (JSX)

The 4 modals (Directive create, Directive edit, Mental Model create,
Mental Model edit) each take 3-4 separate `onNameChange` /
`onContentChange` / `onPriorityChange` / `onTagsChange` / `onQueryChange`
props. The original JSX inlined the same `(v) => setForm(p => ({ ...p,
key: v }))` setter body **12 times** (4 props × 3 modal bodies, minus
the 0-prop AddMemoryModal):

```tsx
onNameChange={(v) => setDirForm(p => ({ ...p, name: v }))}
onContentChange={(v) => setDirForm(p => ({ ...p, content: v }))}
onPriorityChange={(v) => setDirForm(p => ({ ...p, priority: v }))}
onTagsChange={(v) => setDirForm(p => ({ ...p, tags: v }))}
```

12× identical partial-update setter body is past the Rule of Three
twice over. Extracted to a small file-local generic helper:

```ts
const setField = <S,>(
  setter: React.Dispatch<React.SetStateAction<S>>,
  key: keyof S,
) => (v: S[keyof S]) => setter((p) => ({ ...p, [key]: v }));
```

Call site collapses to:
```tsx
onNameChange={setField(setDirForm, "name")}
onContentChange={setField(setDirForm, "content")}
...
```

**Byte-equivalence audit (session-51):** the helper invokes the
`setter` callback with the exact same `(p) => ({ ...p, [key]: v })`
shallow-update closure. React's state-update batching treats the
inline arrow and the helper-returned arrow identically. No
re-render order change, no closure capture difference.

**Why I rejected `useCallback` wrapping the helper itself:** the
helper returns a NEW closure per call, so `useCallback([], ...)` on
the outer factory doesn't stabilise the per-key closures. Wrapping
the *inner* closure with `useCallback(..., [setter, key])` would
require moving the per-key call out of the JSX (a `useMemo` /
`useMemo` per call), which costs more than it saves. The current
shape is the right trade-off.

### 3. Type the dashboard polling `extract` array — remove the `any` cast

**File:** `src/app/page.tsx` (dashboard polling)

The dashboard polls 3 endpoints on independent intervals via a
declarative `polls: [{url, ms, extract}]` array. The `extract` field
was typed inline as `(d: { data?: unknown }) => ...`, and the
`pollIntervals.map()` consumer had to cast it via
`(extract as (d: any) => any)` to drop the per-element type into
the async loop. The result was a single `eslint-disable-next-line
@typescript-eslint/no-explicit-any` comment on the cast.

Replaced the per-element inline type with a module-local
`PollExtractor` alias:

```ts
type DashboardUpdate = Partial<Pick<typeof data, "monitor" | "processes" | "missions">>;
type PollExtractor = (d: { data?: unknown }) => DashboardUpdate | null;
const polls: Array<{ url: string; ms: number; extract: PollExtractor }> = [...];
```

The `polls.map()` consumer now calls `extract(raw)` directly, with
the type checker verifying the return shape. The `eslint-disable`
comment is gone. The 3 inline `(d: { data?: unknown }) =>` parameter
types on the extractor functions collapse to the inferred `(d) =>`.

**Byte-equivalence audit:** the helper signature is identical (still
takes `{ data?: unknown }`, still returns the same shape). The
`setData(update)` call in the consumer sees the same input as
before. The only difference is the cast is gone — the function
behaviour is byte-identical.

## What was rejected

- **`parseInt(priority) || 0` extraction (2 sites)** — only 2 occurrences
  in `HindsightBrowser.tsx` (create + edit directive). Below Rule of Three.
  Left inline.
- **`memories/loading/loadingInitial` useMemo consolidation in
  HindsightBrowser** — the `loading` and `loadingInitial` flags are
  intentionally distinct (loading = search-in-flight, loadingInitial =
  first load). Collapsing them would change the spinner text. Left
  alone.
- **Dashboard batched `safeApiCall` `?.data?.data?.X ?? Y` repetition
  (8 sites)** — explicitly rejected by session-57 ("8 lines of
  repetition, not enough to justify a new helper. Left alone.").
  Same applies this session.
- **`HindsightBrowser` 4-quadrant modal prop drilling (24 props total)**
  — extracting a single `DirectiveFormContext` would save lines but
  add indirection. The flat prop shape is more grep-able and the
  modals are stable contracts. Left alone.
- **`hindsight/utils.ts` 3 helper functions (parseMemoryContent,
  parseReflectResponse, hindsightFactTypeBadgeColor) without tests** —
  Rule of Three for testability: parseMemoryContent has 5 conditional
  branches, parseReflectResponse has 1, hindsightFactTypeBadgeColor
  has 5. The first qualifies (3+ branches) but adding tests for a
  tiny regex match + Python-repr parser is low-yield. The bridge
  test (`hindsight-bridge.test.ts`) already exercises the parse path
  transitively. Left for a future session if a 2nd consumer appears.

## Verification

- All 1024 unit tests pass (174 suites, +15 from this session)
- `npx tsc --noEmit` clean
- `CI=true npx eslint . --max-warnings 0` clean (was: 1
  `eslint-disable-next-line @typescript-eslint/no-explicit-any`
  in src/app/page.tsx; now: 0)
- `npm run build` passes
- `grep -nE "status: (400|404|500)" src/app/api/{sessions,logs,memory,monitor}/**/*.ts` — 0 hits
  (unchanged from session 61)

## Files touched

- `src/lib/hindsight-tag-input.ts` (NEW) — 38-line helper, 2 named functions
- `tests/unit/hindsight-tag-input.test.ts` (NEW) — 15 tests
- `src/components/memory/HindsightBrowser.tsx` (MODIFIED) — 5 sites use
  `parseTagsInput`/`parseOptionalTagsInput`; 12 sites use `setField(setter, key)`
- `src/app/page.tsx` (MODIFIED) — `PollExtractor` type, `any` cast removed
- `references/control-hub-list1-session62-findings.md` (NEW) — this file
