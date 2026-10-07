# T-0177 independent oracle amendment for the 4,800 cap

The first full T-0177 gate passed lint and TypeScript, then failed two Jest
tests. The mission-schema drift is owned by the coordinator. This lane owns
only the other failure: 4,819 repeated test-window lines against C4's 4,800
limit. The committed line census already records the rise, but C4 is a
stricter assertion and must remain at 4,800.

Your exclusive write scope is `tests/helpers/dependency-oracle-types.ts` and
the T-0175, T-0176 and T-0177 dependency oracle suites. You are a different
author from each original oracle author and the implementer. Extract truly
shared type and manifest/lockfile loading scaffolding used by three suites
to remove at least 19 repeated lines with a net code reduction. A read-only
projection found that sharing types alone lands at 4,805, so measure the
combined helper before editing. Do not use formatting tricks, move
code into uncounted data, drop an assertion, reduce a test, or change any test
name. If the combined helper does not suffice, report the measured gap and
propose another genuine consolidation before further edits.

Run the three suites, focused typecheck, focused ESLint and
`node scripts/tooling/line-census.mjs --report`. Compare the full existing
test-name sets before and after, with all 21 passing. Report before/after
repeated-window and total test-line counts, exact paths and file hashes.
Commit only your claimed helper and three test files. Do not edit package,
schema, baseline, task record or claim files. The coordinator will rerun the
full gate on an exact isolated candidate after your commit.
