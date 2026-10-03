# T-0177 independent Knip oracle and closed-oracle amendment

You own only these three files in a separate writing lane:

- `tests/unit/t0177-knip-proposal.test.ts` (new)
- `tests/unit/t0175-dependency-proposals.test.ts` (existing)
- `tests/unit/t0176-visual-dependency-proposals.test.ts` (existing)

Read `org/tasks/T-0177.json` and the existing two dependency oracles. Author a
small independent red-first oracle for PR #227's exact intent: manifest range
`knip: ^6.34.0`, root lockfile range, resolved Knip 6.34.0, preservation of
other direct ranges and paired Next/React pins. Prefer an actual Knip JSON
contract check over another copy of the manifest if it is practical and
bounded. Preserve the existing strict Knip issue-identity ratchet.

Amend only the old Knip expected ranges in the T-0175 and T-0176 closed
oracles. You are a different author from both original oracle authors and
the implementer. Compare the full test-name sets before and after and keep
every existing name and assertion. Run focused Jest on all three files
against the old manifest and report the exact red/pass/skip totals. Check
TypeScript and focused ESLint. Commit only your three claimed test files with
a red-first test commit that names T-0177. Report the commit, diff, test-name
identity and hashes. Do not change package files, baselines, scripts, task
records or PR state. Do not wait for an implementation from the coordinator.
