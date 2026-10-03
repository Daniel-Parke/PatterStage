# T-0179 independent paired React oracle

Own only these four test files:

- `tests/unit/t0179-react-proposal.test.ts` (new)
- `tests/unit/t0175-dependency-proposals.test.ts`
- `tests/unit/t0176-visual-dependency-proposals.test.ts`
- `tests/unit/t0177-knip-proposal.test.ts`

Read `org/tasks/T-0179.json`, PR #233 at
`5e03124f785471d7ad6919437ebd1fc0a02048db`, and the three existing
dependency suites. The PR proposes `react` 19.2.8 and `@types/react`
`^19.2.18` but leaves `react-dom` 19.2.7. Freeze a small red-first oracle
for the coherent proposal: direct `react` and `react-dom` pins at 19.2.8,
`@types/react` range `^19.2.18`, matching root lock ranges and resolved
versions (`react` 19.2.8, `react-dom` 19.2.8, `@types/react` 19.2.18).
Assert relevant peer compatibility and that the Next pair, `@types/react-dom`
range and Playwright range are unchanged. Prefer behaviour or package contract
over broad source text; exact version assertions are appropriate here.

Amend only the now-stale React and React DOM pins and `@types/react` range
in T-0175/T-0176/T-0177. You are a different author from their original
authors and the implementer. Preserve every existing test name and all other
assertions. Run the focused Jest suites against the old package set and report
exact red/pass/skip totals. Run test TypeScript, focused ESLint, the line
census and diff checks. Commit only your four claimed files as the red-first
T-0179 oracle; report the commit, test-name identity and file hashes.
Do not edit packages, lockfile, baselines, scripts, task records, claims or PR
state.
