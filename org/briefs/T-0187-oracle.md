# T-0187 independent ORACLE brief

Task record: `org/tasks/T-0187.json`, ruled R2. The operator approved this
prerelease batch. Read that record and `org/roles/ORACLE.md` before writing.
The coordinator has not changed T-0187 product source. The current head is
`b678e331`, with the five shims and EOS compiler still present and no
legacy boot warning. This is the required red-first point.

Own only `tests/unit/legacy-boot-warning.test.ts` and
`tests/unit/t0187-retired-tools.test.ts`. Write a small behaviour oracle:

- A Node boot with a winning `CH_`, `CONTROL_HUB_`, or `AGENT_HOME` input
  warns once, names only the selected legacy key and its replacement, and
  still starts. Values, including a secret-shaped signing value and a
  data-directory path, must never appear. Repeated `register()` in one
  process must not duplicate the warning. An explicit canonical key wins
  without warning, including when both keys hold the same value. A blank
  canonical value follows the existing per-reader precedence. Edge boot
  does not warn. Use the existing `@/instrumentation` entrypoint; mock its
  unrelated boot dependencies rather than requiring an operator database.
- The five Q-013/tooling-10b repository shims are absent, while
  `scripts/hardware/ch-backup.sh` and all five same-directory `ps-*.sh`
  twins remain. `scripts/tooling/eos-compile.mjs` is absent. These narrow
  structural assertions are authorised because the exact CLI removals
  were ruled. Do not delete or amend existing b15 tests; the coordinator
  handles the two itemised exceptions after the oracle is frozen.

Do not touch product source, docs, records, claims, or existing tests. Do
not weaken a failing assertion. Run just your two suites against this
unfixed tree and report the exact test names, pass/fail counts, failure
messages and SHA-256 of each file. Intended red assertions must be test
matcher failures; module-load/configuration failures are not valid red
evidence. Do not commit; the coordinator will review and commit the frozen
oracle. If an entrypoint cannot be tested without a config error, report
that rather than replacing behaviour evidence with a source-text test.
