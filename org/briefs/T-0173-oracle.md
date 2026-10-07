# T-0173 independent oracle brief

Author: a session other than the T-0173 implementer. Work only in `tests/unit/t0173-dependabot-pause.test.ts`. Do not edit the configuration, task record, claims or other tests. Read `org/START.md`, `org/tasks/T-0173.json` and the ORACLE charter first.

Write an executable structural oracle for the temporary version-PR pause. Parse `.github/dependabot.yml` as YAML. Require exactly the npm and GitHub Actions entries, each targeting `dev` and each with `open-pull-requests-limit: 0`. Keep the existing npm ignore rules observable. Prove the test fails on the current configuration, then report its test names and red result. The repository's main-branch content and GitHub security-update settings require a separate external verification and are outside this file's reach.

Do not implement the pause. The implementing session will freeze your oracle before changing either branch. Its author may only amend it through another independent session.
