# T-0187 supplemental bridge oracle

The frozen oracle in `tests/unit/legacy-boot-warning.test.ts` covers direct
Next.js boot. Read `org/tasks/T-0187.json`, `org/roles/ORACLE.md` and
`org/claims.json`. A separate read-only review found two loaders that copy
a winning `CH_` setting into its canonical `PS_` variable before app boot:
`scripts/tooling/_env-local.mjs` and `scripts/lib/ps-dotenv-local.sh`.
Neither loader currently warns. The coordinator has not edited these
loaders. This is a supplemental red-first test, not an amendment to the
frozen oracle.

Own only `tests/unit/legacy-env-bridge-warning.test.ts`. Write behaviour
tests for both loaders using isolated `.env.local` fixtures. When a `CH_`
key actually supplies a missing `PS_` key, the loader must emit one
token-free warning naming the legacy key and canonical replacement, even
if the loader is called twice in one process. An explicit `PS_` value
wins and produces no warning. The bridge still populates `PS_` with the
legacy value; no user setting is lost. Include a secret-shaped value and
assert it is absent from output. Run Node tests on Windows and Linux;
if Bash is needed, use a relative `tmp/` fixture path valid in Git Bash
and Linux, and restore every environment variable and temporary file.

Keep the suite small. Red evidence must be an assertion failure, not a
module-load or Bash launch failure. Do not edit source, docs, task
records, claims, existing tests, or gates. Do not commit or push. Report
the full test-name set, exact red/pass counts, SHA-256 and files touched.
