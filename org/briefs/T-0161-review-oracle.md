# T-0161 independent review-failure oracles

Role: ORACLE. Own only `tests/unit/t0161-backup-selection.test.ts`, `tests/unit/t0161-node-setup-safety.test.ts`, and `tests/unit/t0161-required-step-failures.test.ts` in your fork. The coordinator owns all implementation. Read `org/tasks/T-0161.json` and the independent review described in the current task context. Use disposable fixtures; never touch the operator database, Hermes home or `.env.local`.

Write behavioural tests, red against the committed `dev@296f5d10` candidate, for these reviewer-found paths:

1. Shell backup chooses the same larger database as runtime when `patterstage.db` and `control-hub.db` coexist, including sidecars. A backup under permissive Linux umask gets owner-only permissions. Preserve Windows Git Bash compatibility.
2. The cross-platform `scripts/bootstrap/setup.mjs` backs up an existing database before migration, imports Hermes models and credentials after migration, and stops without printing Setup Complete when any required migration/import/seed fails. It must use isolated temp paths. You may copy the entry module and its local dependencies into a disposable repository and use a Node preload that stubs `child_process.spawnSync` with `syncBuiltinESMExports()` to observe order and failure behaviour. Do not mock away the actual setup control flow.
3. Shell setup and the deploy runner must not report success after a required legacy-data, Hermes state, or catalog seed failure. Prefer executable failure injection over source matching. If a case is infeasible without implementation shaping, report exactly why and what test seam is needed; do not invent a pass.

Keep the tests bounded and cross-platform. Record the complete test-name set. Commit test-only oracles red, with failure counts and LF-normalised SHA-256; report which cases are infrastructure versus genuine assertion failures. No implementation edits and no push.
