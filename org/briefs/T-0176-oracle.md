# T-0176 independent visual dependency oracle brief

Author: a separate ORACLE session. Own only `tests/unit/t0176-visual-dependency-proposals.test.ts`. Read `org/START.md`, `org/roles/ORACLE.md` and `org/tasks/T-0176.json`. Do not edit the package files, task records, claims, existing tests or documentation.

Freeze executable acceptance before the package edit. Parse `package.json` and `package-lock.json` as JSON. Require the exact intended direct ranges and matching resolved lockfile versions for `@xyflow/react` `^12.11.6`, `@tailwindcss/postcss` `^4.3.3` and `lucide-react` `^1.41.0`. Keep the root lockfile record coherent with the manifest. Hold all other direct ranges, especially Next and eslint-config-next 16.3.6 and React and React DOM 19.2.7. Do not require a specific unrelated transitive version that npm may legally choose. Use distinct assertions for each proposal, so the old tree is red in three cases and the preservation checks remain green. Existing Composer E2E and the design census cover rendering; do not duplicate them with source-text assertions.

Record exact stable test names, red/pass/skip counts and any environment issue. Do not amend this oracle after implementation; another author must make any amendment.
