---
summary: Independent T-0181 fixture-only amendment to keep the test duplication oracle green
type: task-brief
tags: [oracle, security]
---

The full gate stopped at `tests/unit/c4-the-test-harnesses.test.ts`: the
cross-file repeated six-line window count is 4,802 against its fixed 4,800
ceiling. The repeated eight lines in each of
`tests/unit/log-files-t0181-boundary.test.ts` and
`tests/unit/t0181-log-alias-amendment.test.ts` are fixture setup at lines
21–29. The second file is an independently authored frozen amendment.

The assignee owns only `tests/unit/log-files-t0181-boundary.test.ts`, which
the coordinator authored before implementation. Refactor its fixture setup
so the two files no longer share the six-line window. Preserve the temporary
root, in-root regular log, outside sentinel, digest, cleanup guard, all five
test names in this file and all assertions. The sixth initial-oracle case is
in the separate listener suite. No test may skip, weaken or disappear. Prove
the before/after test-name set and assertion count, focused Jest, TypeScript,
ESLint, and the unchanged 4,800 census ceiling. Do not commit; report the
exact count change and sole touched path.
