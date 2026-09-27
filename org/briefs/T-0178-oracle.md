# T-0178 independent Playwright oracle

Own only these four test files:

- `tests/unit/t0178-playwright-proposal.test.ts` (new)
- `tests/unit/t0175-dependency-proposals.test.ts`
- `tests/unit/t0176-visual-dependency-proposals.test.ts`
- `tests/unit/t0177-knip-proposal.test.ts`

Read `org/tasks/T-0178.json` and the three existing dependency suites.
Write a small red-first oracle for PR #228's exact range and resolution:
`@playwright/test: ^1.62.1` in manifest and root lockfile, and version
`1.62.1` for `@playwright/test`, `playwright` and `playwright-core`.
Retain every other direct range and the paired Next and React pins. A
version assertion is acceptable for this dependency proposal; the coordinator
will run the full browser and screenshot evidence.

Change only the old Playwright expected range in the three closed suites.
You are a different author from their original authors and the implementer.
Preserve the complete existing test-name sets and all assertions. Run focused
Jest against the old package version and report exact red/pass/skip totals.
Run test TypeScript, focused ESLint and diff checks. Commit only your four
claimed test files as the red-first T-0178 oracle, then report the commit,
test-name identity and file hashes. Do not edit package, lockfile, baselines,
scripts, records, claims or PR state.
