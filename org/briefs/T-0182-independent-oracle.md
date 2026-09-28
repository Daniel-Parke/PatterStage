# T-0182 independent CSP oracle

You are the separate ORACLE author for T-0182. Read `org/START.md`,
`org/tasks/T-0182.json`, `org/roles/ORACLE.md`, this brief and the accepted
`org/decisions/ADR-0015-content-security-policy.md`. Do not read current
implementation files or implement the policy. Existing tests may be read for
fixture conventions only. Your exact write claims, committed in
`org/claims.json` before dispatch, are:

- `tests/unit/t0182-csp-policy.test.ts`
- `tests/e2e/t0182-csp.spec.ts`

Author behavioural tests against the public request/browser boundary. Give
each test a stable descriptive name. At minimum prove a fresh CSP nonce across
two authenticated document responses; a forged incoming `x-nonce` or CSP
request header is ignored; the response has no script `unsafe-inline` or
production `unsafe-eval`; injected inline script and event-handler execution
are blocked; the frame denial remains; nonce-bearing HTML has no reusable
cache directive; and unauthorised HTML keeps its status and CSP. Test ordinary
client hydration and the Missions dialog in a built app. Test both desktop
and 390×844 phone viewport where fixtures permit. Record any acceptance
criterion that cannot be automated directly; do not replace it with a
source-text assertion or a passing skip.

The existing E2E harness uses port 3000 and an isolated data directory.
Never use the operator's repository data. Do not modify shared fixtures or
implementation. Freeze your test files and hashes before implementation.
Run the new tests on unmodified source and report exact red counts and any
fixture limitations. Do not make a failing requirement pass by weakening it.
You do not own task records, baseline files, mutant manifests or derived
views. The coordinator handles integration and red-first commit.
