# T-0187 final provenance oracle

Independent ORACLE owns only `tests/unit/legacy-branch-and-port-provenance.test.ts`.
Do not edit implementation, existing oracle suites, records or protected paths.

Verify with real child processes that an inherited `CH_UPDATE_GIT_BRANCH` without
`.env.local` does not claim to supply a branch when the deploy runner's selected
default remains `dev`. Cover both `loadEnvLocal` and the Git Bash loader; preserve
a positive case in which a file-supplied alias truly wins. Never execute an update.

Verify Hindsight setup's final dashboard port selection and warning with inherited
`CONTROL_HUB_PORT`, an unrelated inherited `_p`, and absent `.env.local`. Avoid
executing the setup script's installation or service operations. Test the actual
bounded final selection block, with a child Bash process and isolated temporary
paths; do not assert on source spelling alone.

Run the new suite before source repairs. Report named test identities, the
intended matcher failures and passing controls. Do not commit or change source.
