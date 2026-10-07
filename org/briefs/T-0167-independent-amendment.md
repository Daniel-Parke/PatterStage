# T-0167 independent macOS oracle amendment

Read `org/START.md`, `org/roles/ORACLE.md`, `org/TESTING.md`,
`org/tasks/T-0167.json` and this brief. The closed T-0163 oracle is red on
hosted macOS push CI 36309526484: its Node setup test injects chmod refusal,
but the fixture expects success because `IS_LINUX` is false on macOS. The
product's fail-closed exit is correct. Under Q-015, a session other than the
implementer must author and date the amendment.

Your only write claims are the three existing files
`tests/unit/t0163-bootstrap-credentials.test.ts`,
`tests/unit/t0163-hermes-env-permissions.test.ts` and
`tests/unit/t0163-review-regressions.test.ts`. Preserve all 22 named tests,
their behaviour assertions and their fixtures. Make POSIX permission and
chmod-denial checks apply on macOS and Linux; preserve the Windows functional
path. Do not edit source, task records, baselines, manifests or other tests.
The hosted red run is the red-first oracle. Report before/after LF hashes,
the identical test-name set, focused Windows/Linux results and any macOS
limit. Commit only the owned test files.
