# T-0163 independent credential-permission oracle

You are the separate ORACLE author for a security change under `org/TESTING.md`.
Read `org/START.md`, `org/tasks/T-0163.json`, `org/roles/ORACLE.md` and this
brief. Do not read the implementation files or start fixing source. Your only
write claims are `tests/unit/t0163-bootstrap-credentials.test.ts` and
`tests/unit/t0163-hermes-env-permissions.test.ts`. The coordinator owns source,
task records, claims, baselines and the mutant manifest. Both lanes are in
`org/claims.json`; do not exceed the two-lane cap.

Author executable behaviour acceptance with disposable fixtures. Under Linux
umask 000, a fresh Hermes `.env`, a fresh PatterStage `.env.local`, runtime
credential replacement and the plaintext backup must be mode 0600 from
creation. An existing `.env` or `.env.local` made mode 0666 must become 0600
before setup or runtime can complete, preserving prior keys and comments.
If a file cannot be made private, the operation must fail without disclosing
the secret. Include both cross-platform Node setup and Git Bash/POSIX setup,
and the runtime sync and removal paths. On Windows, prove functional behaviour
but reserve POSIX mode assertions for Linux. Use the actual public setup
entries, not source-text assertions, and keep the operator's repository data
outside every fixture. Existing T-0161 fixtures show how to intercept external
install/migration commands without running them.

The oracle must be authored before implementation. Freeze its file hashes,
test-name sets and count, commit only the two owned test files, and demonstrate
a red exit on the unmodified source. A local Docker Linux run is available if
Windows cannot express the permission failure. Report any fixture limitation
honestly; no skip or reduced coverage may turn a red requirement green.

## 2026-09-27 fixture amendment after implementation

The original thirteen names are frozen at commit `1dd40c41`. Native Linux
control fails the `POSIX setup fails closed` test because its fixture insists
that a stubbed later command has run. The intentional chmod refusal exits
before that command and before the fixture's event file exists. Amend only
`tests/unit/t0163-bootstrap-credentials.test.ts` so this exact early refusal
is observable, while launch errors, timeouts and unexpected success still fail.
Preserve all thirteen test names, every mode and secrecy assertion, and the
ordinary setup controls. The coordinator will record a dated amendment with
your commit and before/after test-name identity. Do not edit implementation.
