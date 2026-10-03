---
summary: Independent oracle brief for rotation rollback and failed hand-off URL clearing
type: review
tags: [oracle, security, auth]
status: active
---

# T-0158 rotation cleanup oracle brief

**Task:** T-0158, R3. **Writable claim:** only
`tests/unit/t0158-rotation-cleanup.test.ts`. The coordinator holds all
production and governance paths. Author the tests independently from the
accepted ADR-0012/0013, this brief and observable responses. Do not edit
production code or existing frozen oracles.

Force token rotation during the session INSERT, after the supplied credential
passed its initial comparison. The sign-in response must have no browser
cookie, and the transaction must not leave a newly inserted session row. A
separate control must show normal sign-in commits one row. Use disposable
real SQLite. Inspect only row count, never secret contents.

For intentional GET `?ps_token=` hand-off, force a credential refusal and
check that the browser-facing response does not leave `ps_token` in the
address or `Location`. Cover the ordinary wrong-token case and, if feasible,
rotation during insertion. The response must not issue a session cookie.
The oracle may use a redirect to a clean URL before showing a 401 page, but
must reject a credential-bearing final address. Keep the successful hand-off
URL-stripping assertion as a control. Do not log any token value.

Run the new suite and test TypeScript. Return exact test names, exit codes,
red count, control count and SHA-256. Do not commit. The coordinator commits
the red oracle before implementation. The test should not assume a particular
internal helper or error class.
