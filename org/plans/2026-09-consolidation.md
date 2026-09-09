---
summary: The consolidation programme, batches C0 to C8, each a way the same thing is done many times made one thing, measured by a line census that can only fall, with no feature removed
type: venture
tags: [plan, consolidation]
status: approved
---

# PatterStage · Consolidation programme (2026-09)

> Evidence: `org/reviews/2026-09-consolidation-recon.md`. Format and
> discipline follow `org/plans/2026-09-ui-overhaul.md`. Batches C0 to C8,
> task records **T-0135 to T-0143**. Approved by the operator's instruction
> of 2026-09-09: "focus on reviewing the entire codebase, with the goal of
> consolidating and massively reducing the line counts where possible … to
> make development easier in future, make maintenance way easier, and to
> start refactoring into more efficient structures where possible."
> Precedence: `org/CONSTITUTION.md` > repo governing files > this plan.
>
> This programme follows `org/plans/2026-08-consolidation.md` (WO-0020 to
> WO-0029, T-0009 to T-0013), which fixed the red jobs, deleted the dead
> weight, made the move canary, grouped six domains out of the flat library
> (T-0010) and decomposed the eighteen god files (T-0011). It picks up where
> that stopped: the seventy-one files still at the library's root, and the
> shapes the overhaul's recon then measured.

## What it is for

Three things, in the operator's words: development easier, maintenance
easier, structures more efficient. The line count is the measure, not the
goal: a line that is the only place a thing is decided is worth keeping, and
a line that is the fourth place the same thing is decided is the one to take
out. So every batch is named for the shape it makes one, and measured by a
census that counts the lines and the shapes and can only fall.

## What must survive

- **Every feature.** Decision 2 of the overhaul: a feature goes only with the
  operator's per-feature sign-off, and this plan proposes none.
- **The gates, unweakened.** `npm run lint` (twelve commands), `tsc`, jest,
  knip, canary, build, Playwright's two projects, the design census. A batch
  that needs a baseline re-cut re-cuts it downward.
- **The commentary culture.** A comment that names the defect a decision
  fixes stays (decision 9). What goes is narration of arithmetic.
- **The test corpus's questions.** The `it()` count and every coverage
  percentage are unchanged by a test batch (the U1 identity oracle).
- **The read contract, the status ladder, the primitive set, the registry,
  the single ring, the drawer.** Everything the overhaul held.

## The census that referees it

C0 adds `scripts/tooling/line-census.mjs` and its ratchet baseline
`scripts/tooling/line-census.baseline.json`, run by `npm run census:lines`,
counting on the tree:

| Measure | Key | Now | Target |
|---|---|---:|---|
| `src` lines | `srcLines` | 107,123 | **≤ 98,000** |
| `tests` lines | `testLines` | 121,651 | **≤ 116,000** |
| src lines in a repeated 6-line window | `srcRepeatedWindowLines` | 1,416 | **≤ 600** |
| tests lines in a repeated 6-line window | `testRepeatedWindowLines` | 6,028 | **≤ 2,500** |
| API routes with the try/serverErrorFromCatch body | `routesWithTryCatch` | 82 (126 sites) | **0** |
| files reading with useState + useEffect + safeApiCall | `handRolledReadHooks` | 5 | **0** |
| the four named action hooks without useApiMutation | `writeHooksWithoutMutation` | 4 | **0** |
| files spelling a repeated type shape (mission draft, model row, sync failure) | `repeatedTypeShapeFiles` | 23 | **3** |
| components with one importer | `oneImporterComponents` | 130 of 202 | **≤ 95** |
| files at the `src/lib` root | `libRootFiles` | 71 | **≤ 12** |
| src files ≥ 60 lines that are ≥ 40% comment | `commentEssays` | 107 | **≤ 60** |
| suites mocking `@/lib/db` inline | `suitesMockingDbInline` | 100 | **≤ 20** |
| design census: inline card chromes / raw controls / raw palette / arbitrary z | (design-lint baseline) | 222 / 24 / 77 / 20 | **≤ 120 / 0 / ≤ 30 / 0** |
| test count, coverage percentages | (jest) | 6,860 | **unchanged by a test batch; may grow with a source batch's oracles** |

The ratchet: a measure may fall and may not rise; `--allow-growth "<reason>"`
records the reason in the commit when one must.

## Batches

The per-batch discipline is the overhaul's, unchanged: one task record; the
oracle first, measured red; patch scripts through the Write tool and run
with `python`; the gate by exit code, with `npm run census:lines` added to
the chain; the isolated instance walked for anything a screen shows; a
mutation sweep against the committed tree; the record; the derived views;
the push. A sceptic reads `git diff` for deleted assertions after every
batch.

### C0 — The line census [S] · T-0135
- `scripts/tooling/line-census.mjs`: the measures above, the ratchet, the
  `--report` mode listing the elements behind each number, `--update-baseline`,
  `--root` and `--baseline` for a fixture tree.
- `npm run census:lines`, and the testing guide names both censuses.
- The recon filed under `org/reviews/`, this plan under `org/plans/`.
- Verify: the census refuses a planted growth and accepts a fall on a
  fixture tree; the baseline committed at today's numbers.

### C1 — One route body [M] · T-0136
- `route(name, handler)` in `src/lib/api-route.ts`: catches, logs through
  `serverErrorFromCatch` with the route's name, returns the handler's
  response. The 126 sites converted by script; the two strings per site
  become the one name.
- `requireAuth` stays where it is (three routes, the proxy does the rest).
- Verify: `routesWithTryCatch` 82 to 0; every API contract suite green
  unchanged; a mutant that swallows the error inside the wrapper is killed.

### C2 — One type each [S] · T-0137
- `MissionDraftFields` in `src/lib/missions/mission-types.ts`, imported by the
  nine; `ModelRow` beside the models repository for the seven; the sync
  source's failure result for the seven. Any other shape the census's window
  report shows three or more times.
- Verify: `tsc` proves the shapes were the same; `repeatedTypeShapeFiles` 23
  to 3.

### C3 — One way to write [L] · T-0138
- `useApiMutation(endpoint, opts)` beside `useApiResource`: react-query's
  `useMutation`, toast on failure through the feedback context, `refetch` of
  the named keys on success, `busy` while in flight, the optional two-step
  confirm. The four named action hooks onto it; the five hand-rolled reads
  onto `useApiResource`.
- `design-lint`'s `no-raw-fetch-in-component` extended to a write in a click
  handler that is not through the hook.
- Verify: `handRolledReadHooks` and `writeHooksWithoutMutation` to 0; the
  mission dispatch loop timed and unchanged; the model actions' contract
  suites green.

### C4 — The test harnesses [L] · T-0139
- `tests/helpers/mocks.tsx` gains the db stanza (the dominant shape, opt-in
  per file), the paths stanza, the request stub; a `tests/helpers/story.tsx`
  harness for the seven story suites; the settings and models fixtures that
  the eight biggest suites each build.
- Verify: the identity oracle (`it()` count, coverage percentages unchanged);
  `testRepeatedWindowLines` and `suitesMockingDbInline`; knip clean.

### C5 — Comments that narrate [M] · T-0140
- File by file, the 107 essays: the extraction arithmetic, the byte-equivalence
  notes, the session numbers, the "used to" diaries that no longer name a
  defect. What stays is what says why.
- Verify: `commentEssays` 107 to ≤ 60; the operator reads the diff; no code
  line changes in this batch (a comment batch is comments).

### C6 — The page layer [L] · T-0141
- One-importer components under sixty lines folded into their one caller
  where the fold reads better; siblings that are one thing merged; the 222
  inline card chromes onto `Card`, the 24 raw controls onto the primitives,
  the raw palette onto the ladder, the arbitrary z onto the scale.
- Verify: `oneImporterComponents`; the design census and design-lint
  baselines re-cut downward; the isolated instance walked at 1440 and 390;
  screenshots recaptured.

### C7 — The lib root [M] · T-0142
- The 71 root files into their domains: `chat/`, `models/`, `schedules/`,
  `scripts/`, `credentials/`, `runs/`, `skills/`, `artifacts/`, with the
  repositories beside their types, the way T-0010 placed the first six.
  Moves, by script, with every import rewritten; the canary's module graph
  is path-insensitive.
- Verify: `libRootFiles` 71 to ≤ 12; `tsc`, knip, the reachability gate,
  `docs:check` and `check-doc-links`.

### C8 — Closing [S] · T-0143
- The census after beside the census before, each measure read against its
  target, the missed ones as numbers. The docs that name a moved path
  updated. The plan marked done.

## What I decided not to do, and why

1. **Not merge test files by subject.** Decision 11: it moves lines rather
   than deleting them, and the suites are the record.
2. **Not delete the comment that names a defect.** The good components are
   good because of them.
3. **Not shorten the API surface.** Three orphan routes went in U15; the rest
   have callers, and `api.md` documents them.
4. **Not introduce a framework** (an ORM, a form library, a state library).
   Each is a second way beside the one being made single.
5. **Not chase the one-importer count to zero.** A page split into named
   pieces is structure; the target is the wrappers that say nothing.

## Risks and how each is held

- **A codemod that changes behaviour.** Every batch's oracle is the contract
  suite that already exists, plus the census; the sweep proves the new shape
  is load-bearing.
- **The comment batch is judgement.** No regex; the diff is the deliverable
  the operator reads, and a comment in doubt stays.
- **Moves break a path a doc names.** `check-doc-links` and the canary's
  route/module surfaces catch it; C7 runs `docs:check`.
- **The identity oracle for tests.** A coverage percentage that moves is a
  defect, not a saving.
