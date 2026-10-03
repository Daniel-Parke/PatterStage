---
summary: Independent T-0158 token-rotation interleaving oracle assignment
type: review
tags: [oracle, security, auth]
status: active
---

# T-0158 token-rotation race oracle brief

**Author:** independent ORACLE session
`01a0e1fd-fece-7642-8b9d-ec3e48d04e25`. **Task:** T-0158, R3.
**Claim:** only `tests/unit/t0158-token-rotation-race.test.ts` for this
subtask. Do not edit the existing frozen T-0158 suites, production code,
protected files, derived views or append-only ledgers. The accepted contract
is ADR-0013 point 2: token rotation invalidates old browser credentials.

An independent source reviewer reproduced a deterministic interleaving:
credential comparison observed an old root token, then the token source
rotated before session creation read it again. The old supplied credential
minted a session bound to the new root token. Test the observable rule: an old
credential must not issue a browser session usable with a newly rotated root
token, even if the source changes between verification and persistence. Cover
both POST sign-in and the intentional GET hand-off if a stable harness can
interpose the token read; state any method not exercised. A controlled
sequence of token-source values is acceptable. Use real SQLite session rows
where feasible, and preserve constant-time comparison behaviour by using
the real matcher.

Write the behavioural assertion before examining the coordinator's proposed
repair. Run this suite and test TypeScript; report intended red failures,
exit codes, full test names and SHA-256. The coordinator commits the test red
before patching session creation. Do not commit or edit outside your claim.
