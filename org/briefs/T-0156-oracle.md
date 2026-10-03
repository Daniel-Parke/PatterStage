# T-0156 Help boundary oracle

Scope: `tests/e2e/help.spec.ts` and the small Jest boundary check in
`tests/unit/t0156-help-client-boundary.test.tsx`. Read the committed
`docs/manifest.json` at test
discovery and exercise every listed guide slug through an authenticated,
isolated production server. A guide must answer successfully and render its
article, not merely return an index or a streamed application error. Report
the exact slug of each failure. A missing slug must retain a 404.

In a browser, open a non-index guide that has a previous-page link. Prove the
Help heading, article and previous-link icon render across the server/client
boundary. The production page must remain a Server Component because it reads
the generated corpus from disk.

The Jest check renders the server page with a client `LinkButton` double that
rejects a function-valued icon prop. It must fail on the original `ChevronLeft`
prop and pass when the rendered icon crosses as a child. This is the focused
mutant control; the production browser oracle remains the acceptance test.

Run the oracle against the unchanged source in an isolated checkout and commit
the red result before editing the Help implementation. Preserve existing test
names. After the fix, run the focused oracle, a 1440x900 and 390x844 visual walk,
the complete gate on a frozen tree, and the committed-tree mutation sweep.
