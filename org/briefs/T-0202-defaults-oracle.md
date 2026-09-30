# T-0202 independent default-install oracle

The HTTP-enabled Docker fresh scenario now builds successfully but the current
repair refuses the supported default directory because no explicit data key
exists. Reproduce that before the coordinator implements a fallback. Read the
task's ruled R2 tier and ORACLE charter. Do not edit the harness or application.

Own only `tests/unit/release-install-http-defaults.test.ts`, the HTTP probe
helper's new default-path fixtures and a new append-only extension entry in
`org/reviews/2026-09-t0202-oracle-amendment.md`. Work starts only after the
preceding shim amendment author releases those files. Preserve the existing
14 test names, controls and assertions. The REVIEWER authorises added fixtures
under Q-015; the extension must not relax any original case.

Use an owned HOME and no PS_DATA_DIR, CH_DATA_DIR or CONTROL_HUB_DATA_DIR in
environment or dotenv. The fresh file contains only PORT. Require real curl
200/401/200 and bounded owned cleanup against the token in
HOME/patterstage/data/auth-token. Add a wrong-token refusal control. Also
characterise runtime discovery: a database in HOME/PatterStage/data wins over
an existing empty lowercase directory with a different token. Inspect
`src/lib/host/paths.ts` for the existing contract; do not invent a new one.

Give each new test a stable name and semantic assertions, run it red before
the fallback exists, and report exact counts, commands and hashes. Preserve
the unmodified successful control. Return code and JSON evidence distinguish
launch/configuration errors from assertion failures. No credentials in output,
no paid services, no unowned listeners, no commits. Linux and Windows fixture
results remain separate evidence.
