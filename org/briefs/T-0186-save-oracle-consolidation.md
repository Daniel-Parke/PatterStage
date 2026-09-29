# T-0186 save-oracle fixture consolidation

Independent R2 REVIEWER `01a0ee95-b0e8-7680-8cc0-4323fd31a085`
authorised this narrow amendment on 2026-09-29. After the first phone
fixture extraction, C4 reads 4,820 repeated test-window lines against its
unchanged ceiling of 4,800. The reviewer reproduced 26 lines shared by
`tests/e2e/story-weaver-save-failure.spec.ts` and
`tests/e2e/story-weaver-save-layout.spec.ts`: the two-chapter story data and
the load/spend route setup. One extraction of both should remove that
duplication. The frozen suites' commits and earlier fixture-amendment hashes
remain historical evidence.

A distinct ORACLE author may edit only those two suites and one new helper
`tests/helpers/story-weaver-save-fixture.ts`. Share story construction and
load/spend setup only. Preserve each test name, every assertion in its test,
different story IDs, HTTP 503 and network failure cases, successful update
responses, viewport coverage and each suite's update branch. Do not edit
application source, other tests, the C4 check or its ceiling.

Before editing, capture the test-name sets and SHA-256 for both suites. After
editing, compare exact diffs, names and assertions, run both Playwright specs
on an owned isolated listener, and remeasure the census. The result must be
4,800 or below. Do not commit or push; report any unresolved count honestly.
