# T-0187 supported-alias and raw-path oracle

The independent second review found two more warning mismatches. The
coordinator has not repaired the loaders. Author a new red-first suite,
owning only `tests/unit/legacy-supported-alias-warning.test.ts`.

Use the existing `tests/helpers/legacy-env-loader.ts` process fixture. For
both Node and Git Bash, `.env.local` with `CH_DATA_DIR=legacy-dir` followed by
`PS_DATA_DIR=   ` must leave the canonical whitespace value selected by a
script's raw `||`/`${...:-...}` path reader and must not warn that CH_DATA_DIR
won. This is specific to the two script loaders, not the app's `readEnv`
selector. For both loaders, `CH_NO_SUPPORTED_READER=unused` must still bridge
to `PS_NO_SUPPORTED_READER` for compatibility but must emit no warning: no
supported reader uses it. Include a positive supported-alias control.

Use names and public process behaviour, no source-text assertions. Keep
fixtures under `tmp/`, no operator data or secrets. Run the suite against the
unrepaired loaders and report exact red/pass counts and SHA-256. Failures
must be Jest matcher failures after the process selected the expected value.
Do not edit the existing oracles, helper, loaders, gates, records or claims;
do not commit or push. The coordinator freezes the suite before repair.
