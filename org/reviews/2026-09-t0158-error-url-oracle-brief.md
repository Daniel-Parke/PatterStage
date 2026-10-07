---
summary: Independent oracle for token-free session-unavailable URLs
type: review
tags: [oracle, security, auth]
status: active
---

# T-0158 unavailable-page URL oracle

An independent R3 ORACLE author owns only
`tests/unit/t0158-error-url-cleanup.test.ts`. Do not inspect or edit
production code. Use the accepted ADR-0012/0013/0014 contract and this
observable counterexample: a browser may visit
`/auth/session-unavailable?ps_token=<credential>` directly. Every response
that handles a deliberate token query must leave the final address and every
redirect `Location` free of the credential and `ps_token`. The final
unavailable response must remain 503, carry no session cookie, and prevent
referrer disclosure. A direct visit to the token-free unavailable path must
also return the generic 503. Include an ordinary failed GET hand-off control.

Record exact test names, passing controls, intended reds, focused exit code,
test TypeScript and SHA-256. Do not commit; the coordinator freezes the red
oracle before any source repair. Use a synthetic, unlogged credential.
