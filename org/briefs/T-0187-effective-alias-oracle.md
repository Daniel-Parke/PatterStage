# T-0187 effective alias selection oracle

A read-only audit of every warning row found further false claims for values
that an actual consumer rejects or reduces to its default. The coordinator
has not repaired these cases. The run-limit invalid/zero cases have their
own frozen red-first oracle and are outside this brief.

Own only `tests/unit/legacy-effective-alias-warning.test.ts` and
`tests/unit/legacy-script-alias-warning.test.ts`. Cover these concrete cases
with behaviour tests, not source-text checks:

- The app must not claim a selected legacy value for
  `CH_ENABLE_DEPLOY_API=bogus`, `CH_READ_ONLY=bogus`,
  `CH_UPDATE_GIT_BRANCH=;;;`, `CH_PULL_RECONCILE_DISK=true`,
  `CONTROL_HUB_LLM_API=   ` or `CH_ALLOWED_DEV_ORIGINS= , ` when the
  corresponding consumer uses a default or empty result. Verify each
  consumer's result as well as the warning. Keep one or more valid-value
  positive controls.
- The Node `.env.local` bridge must not claim `CH_DATA_DIR=   ` when the
  deploy resolver falls back to discovery. Both script bridges must not
  claim invalid deploy, read-only, reconcile or origins aliases. Preserve
  actual bridge values. The Node deploy script uses the raw update branch,
  unlike the app's sanitiser, so do not assert that its warning is absent
  for `CH_UPDATE_GIT_BRANCH=;;;` without proving its own consumer ignores it.

Use the existing process fixture when useful. Isolate env and temporary
paths; no operator data or secrets. Do not change the existing oracles,
helper, source, records, claims, or gate. Run focused Jest against the
unrepaired cases and report exact names, matcher-failure count and SHA-256
for each file. Do not commit or push. The coordinator will freeze the suite
before implementation.
