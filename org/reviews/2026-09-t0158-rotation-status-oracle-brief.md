---
summary: Independent oracle brief for a token-rotation authentication refusal
type: review
tags: [oracle, security, auth]
status: active
---

# T-0158 rotation response oracle brief

**Task:** T-0158, R3. **Writable claim:** only
`tests/unit/t0158-rotation-status.test.ts`. The coordinator holds all
production and governance paths. Work from accepted ADR-0013 point 2 and
this brief, without reading production code or existing T-0158 tests.

Test the externally observable response when a root token rotates *after*
an old supplied credential has passed comparison but *before* a browser
session can be committed. The old credential must receive an authentication
refusal (401), with no session cookie. It must not be described as a storage
outage (503). Cover both POST sign-in and the intentional GET token hand-off
if a deterministic harness permits it. As a control, a true session-storage
failure must still return 503 and no cookie. Keep the real constant-time
matcher; a controlled token-source interleaving and real in-memory SQLite are
appropriate independent methods. Do not log token values.

Run only the new suite and test TypeScript. Return exact test names, focused
exit codes, intended red count and SHA-256. Do not commit; the coordinator
will commit the red oracle before changing the error mapping. Do not edit
frozen suites, production code, protected files, derived views or ledgers.
