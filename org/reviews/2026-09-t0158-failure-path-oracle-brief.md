---
summary: Independent oracle brief for sign-out failure and GET hand-off outage diagnosis
type: review
tags: [oracle, security, auth]
status: active
---

# T-0158 failure-path oracle brief

**Task:** T-0158, R3. A separate ORACLE author owns only
`tests/unit/t0158-failure-paths.test.ts`. The author may read this brief and
accepted ADR-0012/0013/0014, but must not use production internals as the
oracle. Use disposable real SQLite where possible. Do not edit production,
frozen tests, protected files, derived views or ledgers.

Prove the following observable contracts before implementation:

1. A normal `DELETE /api/auth/session` revokes its own session and clears the
   browser cookie. If session-state revocation fails, the response reports
   failure but still expires the browser cookie. It must not claim that the
   database row was revoked.
2. If the active operator-token source disappears before a browser requests
   self sign-out, the proxy response fails closed and still expires the stale
   cookie. The browser must not retain that cookie merely because the route
   could not run.
3. If session creation fails during an intentional GET `?ps_token=` hand-off,
   following any redirect ends at a token-free browser address with a clear
   storage-unavailable response, not a false invalid-credential message. No
   session cookie is issued. Normal invalid-credential hand-off remains an
   authentication refusal at a token-free address.

Record exact test names, passing controls, intended reds, focused exit codes,
test TypeScript and SHA-256. Do not commit; the coordinator freezes a red
commit before source repair. Never print or persist a credential value.
