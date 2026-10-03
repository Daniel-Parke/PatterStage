# T-0187 inherited and repeated legacy-source oracle

The final independent R2 review reproduced two loader provenance gaps.
Neither loader warns when inherited `CH_DATA_DIR=review-legacy-dir` wins with
no `.env.local`. Git Bash also loses the warning after the line order
`CH_DATA_DIR=legacy-dir`, `PS_DATA_DIR=chosen-dir`, `PS_DATA_DIR=`. A repeated
winning CH line can duplicate its name in one warning. The coordinator has
not repaired these cases.

Own only `tests/unit/legacy-inherited-env-warning.test.ts` and
`tests/unit/legacy-repeated-lines-warning.test.ts`. Use fresh Node and Git
Bash child processes, safe isolated `tmp/` directories, and actual script
selection (`ps-deploy.mjs`/`ps_data_dir` or the same raw precedence they use).
Clear unrelated inherited aliases, then deliberately set the one under test.
With no `.env.local`, both loaders must warn once for the winning inherited
CH_DATA_DIR, with key names but no path. With the three-line file, Git Bash
must warn once when the legacy path wins. With repeated CH lines, Git Bash
must name the pair once in that line. Add canonical-winner controls that do
not warn. Do not assert against source text or change the existing oracles.

Do not edit loaders, helper, records, claims or other paths; do not commit or
push. Run focused Jest before implementation and report exact names, red/pass
counts, SHA-256 and proof that failures are matchers after successful process
execution, not launch errors.
