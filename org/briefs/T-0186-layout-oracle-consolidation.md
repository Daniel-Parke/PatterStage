# T-0186 frozen layout-oracle consolidation proposal

The full gate failed the pre-existing C4 repeated-test-window ceiling:
4,834 measured versus 4,800 allowed. The two newly frozen phone geometry
oracles repeat the same isolated Story Weaver story and failed-save route
setup. This is a test-harness duplication, not a reason to move the ceiling.

An independent R2 reviewer must judge whether a distinct ORACLE author may
extract only their common Story Weaver fixture into a `tests/helpers/` module.
The tests are `tests/e2e/story-weaver-save-controls-layout.spec.ts` (frozen
at `fd3450e2`) and `tests/e2e/story-weaver-chapter-heading-layout.spec.ts`
(frozen at `4bf790f0`). Preserve both test names, every geometric assertion,
the 503 failure response, viewport, navigation, retries and worker policy.
The helper must be used by both suites, and the C4 measure must fall to 4,800
or below. The amendment may not alter application source or other tests.

Before editing, record each file's SHA-256 and the Playwright test-name set.
After editing, repeat the name set, run both suites against an owned isolated
listener, run the line census and provide the exact diff. Do not commit or
push. The coordinator will record authorisation and the amendment in T-0186.
