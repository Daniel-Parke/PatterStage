---
summary: Where the consolidation programme stands, how a batch is landed, what is open, and how to pick the work up tomorrow
type: venture
tags: [handover, consolidation]
updated: 2026-09-10
---

# Handover · PatterStage, evening of 2026-09-10

This page is the one to read before touching the tree. It says where the
work stands, what was learned landing it, what is still open, and the exact
steps a batch goes through. Everything it names is on disk; nothing lives in
a chat.

## Read in this order

1. `CLAUDE.md` (the never-rules), then `org/START.md` (boot by mode).
2. `org/plans/2026-09-consolidation.md`: the programme, batches C0 to C8,
   the census that referees it, and the corrections each batch wrote into
   its row.
3. The last task record, `org/tasks/T-0142.json`, and `org/TASKS.md` (the
   derived live view) for the rest.
4. `docs/contributing/testing.md` ("Shared test doubles") and
   `docs/contributing/repo-guide.md` (the read and write rules) for the
   conventions the last batches introduced.

## Where the programme stands

`dev` is pushed and green. Every batch below has a task record, an oracle
committed red first, a gate by exit code, a mutation sweep against the
committed tree, and a chore commit carrying the record and the derived views.

| Batch | Record | What it did | Landed |
| --- | --- | --- | --- |
| C0 the line census | T-0135 | `npm run census:lines`, twelve measures, shrink-only | yes |
| C1 one route body | T-0136 | `route()` wrapper over 115 handlers; 13 routes keep their own catch with a reason | yes |
| C2 one type each | T-0137 | MissionDraftFields, ModelIdentity/ModelRow/ApiModel, syncSuccess/syncFailure | yes |
| C3 one way to write | T-0138 | `runWrite` in `src/lib/api/api-write.ts`; four helpers and toastFromResult deleted; Story Weaver reads on `useApiResource`; census reads by AST; lint rule `no-raw-write-outside-the-helper` | yes |
| (fix) Models page keeps its body | T-0139 | a reload no longer swaps the page for a spinner; found by C3's walk | yes |
| (fix) custom fallback identity | T-0140 | migration 042 (head is 42): a custom fallback keeps its typed name, provider, model id | yes |
| C4 the test harnesses | T-0141 | fifteen factories in `tests/helpers`; 130 suites adopted by six agents with per-file identity; census counts dbSingletonMock as a factory | yes |
| C5 comments that narrate | T-0142 | narration cut file by file (two passes, ten agents); code proved unchanged by a stripped-code diff | yes |
| C6 the page layer | T-0143 | eight agents over disjoint file groups: six design-lint rules to zero (the whole baseline, 369 to 0), the eleven effect reads onto `useApiResource`, 27 one-importer folds, two pages that swapped their body on reload fixed | yes |
| C7 the lib root | T-0144 | 65 of the 71 root files into fifteen domains, by codemod, with every import rewritten; six stay, each saying in its own header why it belongs to no domain | yes |
| C8 closing | T-0145 | the census after beside the before; the plan marked done | no |

The plan's remaining ids moved by two for the fixes taken in between; the
plan header says so.

## The census, now against the plan's targets

| Measure | Plan start | Now | Target |
| --- | --- | --- | --- |
| src lines | 107,123 | 100,890 | ≤ 98,000 |
| tests lines | 121,651 | 121,538 | ≤ 116,000 |
| src lines in a repeated window | 1,416 | 1,190 | ≤ 600 |
| tests lines in a repeated window | 6,028 | 4,786 | ≤ 2,500 |
| routes with their own try/catch | 82 | 13 | ≤ 13 (met, corrected at C1) |
| hand-rolled reads (by AST since C3) | 5 (regex) | 0 | 0 (met) |
| named hooks writing on their own | 4 | 0 | 0 (met) |
| repeated type shapes | 23 | 2 | 3 (met) |
| one-importer components | 130 | 103 | ≤ 95 (missed by 8; see C7) |
| lib root files | 71 | 6 | ≤ 12 (met) |
| comment essays | 107 | 9 | ≤ 60 |
| suites mocking db inline | 100 | 14 | ≤ 20 (met) |
| design-lint debt (all rules) | 350 | 0 | 0 (met) |
| jest | 6,860 | 6,902 (683 suites) | unchanged by a test batch |

## How a batch is landed (the discipline, verbatim from practice)

1. Write the oracle suite first, run it red, commit it red:
   `test: the CN oracle, red at X of Y, T-01xx`.
2. Implement. Patch scripts go through the Write tool, never a bash heredoc
   (heredocs on this box strip a backslash level; a `\b` became a backspace
   byte once).
3. Walk anything visual on the isolated instance:
   `PS_AUTH_TOKEN=u14walk PS_DATA_DIR=<a scratch dir> CH_DATA_DIR=<the same dir> PORT=3939 nohup npx next start -p 3939`
   (any empty directory outside the repo; the instance seeds it),
   visit `/?ps_token=u14walk` first, drive it with a Playwright script, stop
   the port. `npm run build` first if src changed.
4. The gate, by exit code, on the finished tree, with nothing edited while
   it runs (it stamps the tree before and after): kill ports
   3000/3477/3577/3939/8642, `rm -rf .next/dev`, then in order
   `npm run lint`, `npx tsc --noEmit`, `npx jest`, `npm run lint:knip`,
   `npm run canary:check`, `npm run build`, `npm run test:e2e`,
   `npm run census`, `npm run census:lines`. Read exit codes, never grep for
   "error". A Playwright spec that fails only under the gate's load is
   re-run alone into `e2e2.log` and both are written into the record.
5. `git add -A` and the feat commit, with the gate's numbers in the message.
6. The mutation sweep against the COMMITTED tree (`sweep.py mutants.json`,
   anchors exact, mutants built with json.dump). A survivor gets the test
   it asks for as its own commit, then the mutant is re-run and killed.
7. The record: `org/tasks/T-01xx.json` (intent, tier and reasons, claims,
   invariants, commits, verification with the numbers, mutation, deviation),
   then `taskops.render_views(...)` from PatterTech_EOS,
   `node scripts/tooling/check-derived-views.mjs`,
   `node scripts/docs/build-site.mjs --manifest-only`, the chore commit,
   `git push origin dev`.
8. The line census: `--update-baseline` after a fall; a rise only with
   `--allow-growth "<reason>"`, and the reason is what the file keeps. The
   design-lint baseline works the same way. The output canary is
   re-blessed (`npm run canary:bless`) only for an intended change such as
   a new migration file, in the same commit.

Agents: a batch that touches many files in the same way is split into
disjoint file groups, one background agent each, with a written brief the
agent reads from disk; each agent runs its files before and after, proves
identity (test names through jest's JSON reporter, or the stripped-code
diff for a comment batch), and reports a table. The coordinator runs the
identity oracle, the census and the gate over the whole tree afterwards.

## Open items (none blocking)

- **C7, C8** remain; C7's starting notes are below.
- **Twelve design-lint pragmas** excuse the six C6 rules, each with its
  reason on the line (react-flow nodes, a code block inside rendered HTML,
  a range slider, a two-line list row, the chat composer's ref-focused
  textarea, a POST that reads, a debounced autosave, a warning callout, a
  pill that is a link). Three would go with small primitive changes:
  `Card` taking `role`/`style`/`data-*`, `Textarea` taking a `ref`, a
  warning tone on `LoadErrorBanner`.
- **The useGatewayHealth probes** lost their per-call 3s/5s abort deadlines
  when they moved onto `useApiResource` (apiFetch's default timeout applies).
- **Two design census measures rose**, with the reason written into the
  baseline: mono share 0.67 to 0.68 (the shared Button and Badge are mono by
  decision 10, and the batch adopted them widely) and decorative borders
  below 3:1 691 to 714 (Card's hairline rung is 1.63:1 on purpose). The
  measure that is a target, control borders below 3:1, fell 102 to 82.
- **Rows added as custom fallbacks before migration 042** read "Custom";
  their identity was never stored and cannot be recovered. The CHANGELOG
  says to add them again.
- **An eslint policy call** for the operator: every one-line factory
  adoption in tests pays an `eslint-disable-next-line
  @typescript-eslint/no-require-imports` for the hoisting-safe `require`
  inside `jest.mock`. A tests-scoped override of that rule would free about
  a hundred such lines. Not done, because it is a lint-policy change.
- **Two e2e specs flake only under the gate's load**: the composer spec's
  read after a save (now retries once on ECONNRESET, T-0139) and the help
  deep-link `?` shortcut on Missions (a two-second navigation window).
  Both pass alone every time; the record of each gate says so.
- **T-0140's fallback rows** on the isolated instance's data dir are walk
  artefacts, not product data.

## C8 · closing (start here tomorrow)

- The plan's last batch (T-0145) reads the census after beside the census
  before, each measure against its target, and marks the plan done. The
  numbers are in this page's table and in each batch's record; the two that
  missed are `src` and `tests` lines (targets 98,000 and 116,000, currently
  100,890 and 121,538) and one-importer components (target 95, currently
  103).
- Where the remaining src lines are, measured rather than guessed: the
  census `--report` prints `srcDup.byFile` and `essays`. The largest single
  duplication left is HindsightBrowser's 65 lines and the three hindsight
  tab hooks that repeat each other, then the models page's handler lists,
  which are a prop-drilling shape rather than copied code.
- Docs that name a moved path are all updated (`docs:check` and
  `check-doc-links` are in the gate), but the guides were written before C6
  and C7 changed how a screen reads and where a lib file lives; the guide
  for a screen a batch changed is the batch's own job, so nothing is
  outstanding there. What C8 owes is the design-tokens page's account of
  the primitives now that every screen uses them.

## Release

The v1.0.0 tag waits on the operator after the programmes; the release
actions (the migration script on a copy of a real install, the Docker
matrix, the tag) are in `docs/running/migration.md`'s release checklist and
`org/plans/2026-09-final-release.md`. Nothing here changes that order.
