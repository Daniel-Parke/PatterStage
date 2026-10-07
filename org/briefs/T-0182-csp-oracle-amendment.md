# T-0182 independent injected-script oracle amendment

You are a separate R3 ORACLE author under `org/roles/ORACLE.md`. Read
`org/START.md`, `org/tasks/T-0182.json`, accepted
`org/decisions/ADR-0015-content-security-policy.md`, and
`org/reviews/2026-09-t0182-oracle-amendment-proposal.md`. The operator
authorised the amendment on 2026-09-28. You did not write the initial CSP
oracle or the implementation. Your only write claim is
`tests/e2e/t0182-csp.spec.ts`, recorded in `org/claims.json`.

Change only the two viewport copies of the test named "an injected inline
script cannot execute". Inject an un-nonced, parser-inserted inline script
into the delivered HTML response before `</body>` by intercepting the
document response. Preserve status, headers, all other body content,
browser context, and the existing assertions about nonexecution and
hydration. The policy must still contain the fresh nonce. Preserve all test
names, other test bodies, the no-script-unsafe-inline assertion, and the
accepted policy. Do not edit any source, fixture, record, or other test.

Before and after, capture SHA-256 and the test-name set. Run the focused
browser tests against the current production build. Prove red against a
pre-CSP build if feasible without altering shared implementation; otherwise
state that proof is unobserved. Do not commit. Report exact command results.
