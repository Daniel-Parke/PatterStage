# T-0158 held-response revocation oracle

The independent R3 reviewer found a contract blocker at `dev@a228a708`:
`GET /api/memory/hindsight` can await a provider after the proxy has checked a
browser cookie and then return protected data after that session is revoked.
ADR-0012 requires already queued protected responses to stop emitting once
revocation is visible. The review is source-supported; a held-response probe is
needed before repair. The green gate and hosted jobs do not cover this race.

An independent oracle author owns only
`tests/unit/t0158-held-response-revocation.test.ts`. Use real disposable SQLite
sessions, a controlled deferred Hindsight action, and the route's actual GET
handler. Start an authenticated request, hold the provider response, revoke the
browser session, release the provider and assert a 401 with no protected marker.
Include a still-valid browser control and a Bearer control. If the route cannot
be called with authentic session context, explain the exact harness limit; do
not count a setup failure as a red oracle. Preserve private credentials in
memory and never print them. Run focused Jest, test TypeScript and ESLint, and
report test names, intended old-tree failures, controls and SHA-256.

Add a held-handler case through the existing `route()` helper, so the shared
handler path is tested as well as the direct Hindsight handler. Revoke its
cookie while the handler awaits, then require denial at response release. The
two fixtures are independently meaningful: a fix limited to either path must
leave the other red.

The coordinator will use the oracle to repair release-time authorisation and
audit other delayed API handlers, including the shared `route()` wrapper and
direct handlers. The independent reviewer must review the finished repair
before T-0158 can close. The full unchanged-tree gate, committed-tree sweep and
all hosted jobs must then run again.
