# T-0174 independent Pages publication oracle brief

Author: an independent ORACLE session. Own only `tests/unit/t0174-pages-publication.test.ts`. Read `org/START.md`, `org/tasks/T-0174.json` and `org/roles/ORACLE.md`. Do not edit the workflow, guard script, task record, claims, existing tests or documentation.

Before implementation, freeze executable acceptance for these behaviours:

- Parse `.github/workflows/docs-pages.yml` as YAML. Require upload-pages-artifact and deploy-pages both at v5, an upload input enabling hidden files, and a pre-upload invocation of `node scripts/docs/check-publish-artifact.mjs site` after the docs build and before upload.
- Require the deploy job to run only for `refs/heads/main`, including `workflow_dispatch`; retain the current triggers, permissions and `/PatterStage/` base.
- Exercise the new guard CLI against temporary fixture trees. A directory with a nonempty `index.html` and an empty root `.nojekyll` must pass. A missing or nonempty `.nojekyll`, a root `.env`, a nested dotfile and a symlink must fail without exposing file contents. Make symlink coverage portable: on Windows, only create it when supported; Linux CI must exercise it.

The guard CLI does not exist yet, so fixture tests should fail on the original tree, alongside the workflow assertions. Treat a missing executable as a red prerequisite, not as proof of the guard's behaviour. Record each test name and the red count. Do not use source-text-only assertions when a YAML or CLI behaviour assertion is possible. The implementing session will not amend this oracle; later changes require a different author.
