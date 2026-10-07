# T-0187 independent boot-oracle fixture consolidation

The independently authored effective-alias oracles are green, but the line
census reads 4,820 repeated test-window lines against C4's fixed ceiling of
4,800. Repeated boot mocks and process setup across the T-0187 suites are a
real candidate for extraction. Consolidate at least 20 covered lines of that
duplication; do not edit the census, baseline, or C4 test.

Own only `tests/helpers/legacy-boot-fixture.ts` and these existing suites:
`tests/unit/legacy-boot-warning.test.ts`,
`tests/unit/legacy-run-limit-warning.test.ts`,
`tests/unit/legacy-effective-alias-warning.test.ts`, and
`tests/unit/legacy-script-alias-warning.test.ts`. Use a shared helper where
it reduces actual duplication. Preserve every test name, assertion,
environment boundary, selected-value check, warning privacy check and
process isolation. Keep the relevant Jest mocks effective. Do not edit
product source, other tests, records, claims or governance files.

Capture the complete test-name set and pass count before and after the
refactor. Prove identity byte-for-byte, run the affected suites and the C4
oracle, and report the measured repeated-window count (must be at most
4,800). Do not commit or push. The coordinator handles integration.
