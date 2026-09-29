# T-0187 effective run-limit warning oracle

The third independent R2 review found a false warning: with
`CH_RUN_MAX_MINUTES=invalid` and no canonical value, the warning claims
the legacy name supplied the run limit, but `run-deadline.ts` uses its
120-minute default. The coordinator has not repaired this case.

Own only `tests/unit/legacy-run-limit-warning.test.ts`. Write a new
red-first behaviour suite. Verify the effective app deadline value and
warning together for invalid and zero legacy values, then a valid legacy
limit as a positive control. Exercise the Node `.env.local` loader with
`tests/helpers/legacy-env-loader.ts`; exercise Git Bash too if it can be
made a meaningful warning assertion without pretending Bash computes the
mission deadline. Existing aliases must still bridge. No token or path value
may appear in warning output.

Do not edit existing oracles, the helper, source, records, claims or gate;
do not commit or push. Run focused Jest against unrepaired source and
report exact test names, intended matcher failures, passes and SHA-256.
