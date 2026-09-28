---
summary: Independent consolidation of repeated schedule-row fixtures without relaxing the fixed test census
type: brief
tags: [oracle, tests, census]
---

# T-0183 schedule fixture consolidation

Read `org/START.md`, `org/tasks/T-0183.json` and this brief. Your only write
paths are `tests/unit/scheduler-tick.test.ts`,
`tests/unit/schedule-minimum-interval.test.ts` and new
`tests/helpers/schedule-record-fixture.ts`.

The T-0183 red-first oracle and identity-preserving scheduler amendments added
real tests, but the existing `c4-the-test-harnesses` fixed ceiling is now red:
4,815 cross-file repeated test-window lines against 4,800. Do not change the
ceiling, census rule, baseline or unrelated tests. The two owned suites each
construct substantially the same ScheduleRecord. Extract one shared fixture
with explicit defaults into the named helper, retain the variation in the
callers and remove the duplicate bodies. Avoid a helper that merely hides
assertions or creates incompatible schedule states.

Before editing, record both suites' exact test-name sets. After editing,
prove byte-equal name sets, both suites green, test TypeScript and file ESLint
green, `git diff --check` green and `node scripts/tooling/line-census.mjs
--report` reports at most 4,800 repeated test-window lines. The source and
test line counts may change honestly; give the net. Report file SHA-256 values.
Do not edit other files or commit. If this extraction does not meet the fixed
ceiling without losing a behaviour, stop and report that fact.
