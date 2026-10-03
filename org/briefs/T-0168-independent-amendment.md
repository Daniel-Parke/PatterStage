# T-0168 independent bootstrap-oracle path amendment

Read `org/START.md`, `org/roles/ORACLE.md`, `org/TESTING.md`,
`org/tasks/T-0168.json` and this brief. Under Q-015, a session separate from
the T-0163 implementer and T-0167 author must amend the closed oracle.

Hosted push macOS CI `36310868105` failed two event-count assertions in
`tests/unit/t0163-bootstrap-credentials.test.ts`. In an isolated Linux clone,
setting `TMPDIR` to a symlink into `/tmp` reproduces those same two failures
with the other four tests passing. The Node preload observes file operations
under a lexical root, while Node's ESM module location can resolve the
symlink to a physical root. Treat this as a hypothesis until you confirm it.

Your only write claim is `tests/unit/t0163-bootstrap-credentials.test.ts`.
Preserve all six named tests, first-write/before-read permission checks,
fail-closed assertions, credential secrecy and Windows functionality. Ensure
the fixture recognises canonical and lexical paths inside its disposable root,
rejects outsiders, and compares events by canonical identity. Add a focused
regression that exercises a symlinked TMPDIR, without weakening the original
tests or using a live operator directory. A genuinely new named regression
test is permitted if needed, but report the original six-name identity
separately. Run focused Windows and isolated Linux symlink tests where
possible. Record old/new LF hashes, exact test-name sets, and commit only
the owned test file. Do not edit production source, task records, baselines,
manifests or derived views.
