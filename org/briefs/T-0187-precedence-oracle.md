# T-0187 reviewer counterexample oracle

The independent R2 review found two concrete holes in the *new warning*
implementation. The coordinator has not repaired either loader yet.
Read `org/tasks/T-0187.json`, `org/roles/ORACLE.md` and the reviewer's
verdict on the record. This is a new red-first suite, not a change to
either frozen suite.

Own only `tests/unit/legacy-bridge-precedence.test.ts`. Give both the
Node and shell `.env.local` loaders a temporary file with
`CH_DATA_DIR=review-dir` followed by `PS_DATA_DIR=`. The existing
fallback still selects the legacy directory, so each loader must name
`CH_DATA_DIR → PS_DATA_DIR` once without printing the directory. Give
both loaders `CH_READ_ONLY=   ` without a canonical value. The actual
readEnv consumer treats this as unset, so no warning may claim that
alias won. Include a passing Node control if it already has the right
behaviour. Use Git Bash's explicit Windows path and system Bash on
Linux, with isolated `tmp/` fixtures and safe cleanup. A failure must
be a Jest matcher failure, not a process launch/configuration error.

Do not edit any other file, especially the frozen oracles, loaders,
gates, records or claims. Do not commit or push. Run focused Jest
against the unfixed loader code, report exact test names, red/pass
counts and the suite's SHA-256. The coordinator will freeze the test
before changing the loaders.
