---
summary: Where the 107,123 lines of src and the 121,651 lines of tests are, which of them are the same lines twice, and what a consolidation programme can honestly take out without removing a feature
type: review
tags: [review, consolidation, line-count]
status: done
---

# PatterStage · Consolidation reconnaissance (2026-09-10)

> Measured on `dev` at the close of the UI overhaul's follow-through
> (T-0134). Every number here is from `scripts/tooling/line-census.mjs`
> (`--report` lists what is behind each), whose baseline is cut at these
> values in C0. The programme that follows is
> `org/plans/2026-09-consolidation.md`; the programme this one follows is
> `org/plans/2026-08-consolidation.md`, whose rows for the flat library
> (WO-0024, T-0010) and the god files (WO-0025, T-0011) were done in August
> and are where this one picks up.

## The headline

The operator's complaint was "the line count is bloated". The UI overhaul's
recon (2026-09-06) found that dead code was gone and that the count was
duplication, and its sixteen batches moved the count by 33 lines. This
reconnaissance asks the narrower question the plan needs: **which lines are
the same lines twice, and which are structure that could be one thing?**

| Where | Lines | Files | Note |
|---|---:|---:|---|
| `src/` | 107,123 | 815 | comments 25,091 (24%), blank 8,039 (8%); `.ts`, `.tsx`, `.css`, `.mjs` |
| `src/lib` | 41,089 | 307 | 71 files, 10,759 lines, sit flat at the root |
| `src/components` | 27,052 | 225 | 130 of 202 components have exactly one importer: 16,380 lines |
| `src/app` | 18,238 | 132 | 99 API routes, 8,416 lines |
| `src/modules` | 10,892 | 85 | hermes 6,091; rec-room 4,801 |
| `src/hooks` | 8,232 | 61 | twelve hooks over 200 lines |
| `tests/` | 121,651 | 700 | 42,729 lines before the first `describe` (37%) |
| `scripts/` | 8,715 | | |

**Literal duplication in `src` is small.** 1,416 lines sit inside a six-line
window that repeats, identically after trimming, in two or more files; 439
inside a ten-line window. That is 1.3% of `src`. The recon of 2026-09-06 said
"the line-count problem is duplication, not vestige", and that is true only
in the wider sense: the same *shape* built many times, not the same lines
pasted. So the programme is a structural one, and its honest ceiling is lower
than a copy-paste count would suggest.

**Literal duplication in `tests` is four times larger.** 6,028 lines sit in
repeated six-line windows. The top windows are three stanzas: the `@/lib/host/paths`
mock (twelve files carry the same eleven lines), a hand-rolled `Request`
stub (eleven files), and the `@/lib/db` better-sqlite3 stanza (ten files).
The shared factories U1 built (six of them) are imported by 69 suites; the
db stanza was not one of the six, and 100 suites still mock `@/lib/db`
inline.

## What the same shape built many times looks like

### 1. The API route (99 routes, 8,416 lines)

82 routes carry the same body: `try { … return ok(x) } catch (error) { return
serverErrorFromCatch("GET /api/x", "doing y", error, "Failed to y") }`, 126
times. Six lines and two strings per site that a `route("GET /api/x", async
() => …)` wrapper would own once. Estimated: **600 to 800 lines**, and every
route's error log named from one place.

### 2. Repeated types (a few hundred lines)

The mission draft's optional fields (`references?`, `skills?`,
`suggestedToolsets?`, `goals?`, `modelId?`, `provider?`, `profileName?`,
`missionTimeMinutes?`, `timeoutMinutes?`, `schedule?`) are spelled in nine
files. The model row (`id, name, provider, modelId, baseUrl, contextLength,
credentialsId …`) in seven. The sync source's failure result in seven. One
type each, imported: 23 files to 3. Estimated: **300 to 500 lines**, and one
place to change a field.

### 3. The read and write layer (hooks, 8,232 lines)

U15 made `useApiResource` the way a component reads; five files still read
by hand with `useState` + `useEffect` + `safeApiCall` (the Story Weaver pages,
the Composer page and canvas, the script scheduling modal). There is no
equivalent for a write: `useModelActions` (452 lines), `useMissionDispatch`
(421), `useMissionTemplateActions` (335) and `useModelFallbackChain` (232)
each hand-roll busy flags, error strings, toasts and refetches around
`safeApiCall`. A `useApiMutation` on react-query's `useMutation`, with the
house conventions (toast on failure, refetch the endpoint's key on success,
busy while in flight), is the write-side twin. Estimated: **1,500 to 2,500
lines**, and one contract for what a write does when it fails.

### 4. The page layer (components, 27,052 lines)

130 components have one importer: `models/` 14, `missions/` 11, `agents/` 10,
`dashboard/` 9, `skills/` 9, `chat/` 8, `memory/` 8. Some are a page split
into named pieces, which is fine; 29 are under sixty lines, one-use wrappers
that cost an import, a file header and a props interface to say what an
inline block said. With them sit the debts the design census holds: 222
inline card chromes in 87 files, 24 raw controls in 16 files, 77 raw palette
hits, 20 arbitrary z values. Estimated: **1,500 to 2,500 lines**, and the
design census ratchets down.

### 5. Comments (25,091 lines, 24% of src)

107 files of sixty lines or more are 40% comment or more; `api-response.ts`
is 82%, `api-fetch.ts` 63%. The overhaul's decision 9 is the rule: a comment
that names the defect a decision fixes stays; a comment that narrates the
extraction arithmetic goes. Counted narration: "byte-equivalent" 35 lines,
"extracted verbatim / pre-extraction" 46, "session NNN" 24; a wider "used to
/ no longer" history of 281 lines, of which some are the defect and some the
diary. Estimated: **1,500 to 3,000 lines**, read file by file, never by
regex, and the operator reads the diff.

### 6. The test corpus (121,651 lines)

The three stanzas above, a story harness for the seven `story-*` and
`stories-*` suites (60 to 80 duplicated lines each), and the request stub.
Nothing merges by subject (decision 11, unchanged: merging moves lines, it
does not delete them). Estimated: **4,000 to 6,000 lines**, with the U1
identity oracle: the `it()` count and every coverage percentage unchanged.

### 7. The flat `lib` root (71 files, 10,759 lines)

`chat-utils.ts`, `scripts-manager.ts`, `llm.ts`, `chat-repository.ts`,
`schedules-repository.ts`, `credentials-repository.ts`, `runs-repository.ts`,
`skills-repository.ts`, `fallbacks-repository.ts`, `artifacts-repository.ts`
sit beside `src/lib/missions/`, `src/lib/sessions/`, `src/lib/composer/`,
the six domains T-0010 made. Moving the rest costs no lines and the canary's
module graph is path-insensitive; it is a structure batch, measured by
"files at the lib root" (71 to about 12).

## What this programme will not do

- Remove a feature. Decision 2 of the overhaul stands: a feature goes only
  with the operator's per-feature sign-off, and none is proposed here.
- Merge test files by subject (decision 11).
- Squash the migration chain, or touch the schema.
- Trim comments by regex, or trim a comment that names a defect.
- Rename for its own sake.

## The honest ceiling

Adding the estimates: **src −6,000 to −10,000 lines** (107,123 to about
98,000), **tests −4,000 to −6,000** (121,651 to about 116,000). The product
does not halve without removing product; what halves is the number of ways
the same thing is done. The measures that ratchet are the ones the plan sets.

## Method

`scripts/tooling/line-census.mjs --report`, run on the tree at T-0134:

- Line counts: every `.ts`, `.tsx`, `.css` and `.mjs` under `src/` and
  `tests/`.
- Duplication: six-line windows of trimmed, non-comment, non-bracket lines,
  hashed, counted where the same window appears in two or more files; the
  covered-lines figure counts each line once.
- Comment share: lines beginning `//`, `*` or `/*`; an essay is a file of
  sixty lines or more that is 40% comment or more.
- Shapes are matched on the file with its comments stripped, so a comment
  naming a hook does not count as using it.
- One-importer components: a `.tsx` under `src/components` imported by
  exactly one other file in `src`, by alias or relative path.
- Test preamble: lines before the first `describe(`, `test(` or `it(`
  (reported here; not a ratchet, because a preamble is not waste by itself).
- Mock counts: `jest.mock("…")` occurrences per module across `tests/`.
