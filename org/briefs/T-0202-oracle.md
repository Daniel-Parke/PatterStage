# T-0202: independent release HTTP-probe oracle

Read org/START.md and org/roles/ORACLE.md. Own only
`tests/unit/release-install-http-smoke.test.ts` and
`tests/helpers/release-install-http-probe.py`. The coordinator owns the
Python install harness, records, mutation manifest and baseline. No product
or harness implementation edits. No Docker or real application launch.

Write a behavioural oracle before the repair. The existing
`Harness.http_smoke` in `tests/integration/test_full_install_update_process.py`
currently starts Next and polls anonymous `/`; production correctly answers
401. Execute the generated probe through a controlled local Bash/HTTP/process
fixture if practical. Python import and Docker interception are allowed;
structural checks are only a small fallback for unavoidable process contracts.
Keep cross-platform Git Bash and Linux working. Do not require a local Hermes
installation, paid credentials or nonstandard Python packages.

Acceptance: require public health exactly 200, anonymous protected access 401
and valid authenticated protected access 200. A wrong credential, redirect,
unhealthy response, request stall or dead launched server cannot pass. Requests
and cleanup are bounded. Success and failure stop only the launched process;
another listener must not be killed or accepted as the launched server.
Never print credential contents. Unmodified controls must launch normally;
red failures must be semantic Jest matcher failures, not missing tools/imports.

Return exact case names, observed red/pass counts, commands, hashes and any
unverified platform limit. Do not commit or amend frozen existing suites. The
coordinator commits your oracle red before changing the implementation.
