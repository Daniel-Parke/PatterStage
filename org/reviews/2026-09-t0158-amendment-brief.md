---
summary: Proposed narrow amendment scope for authentication and stream fixtures
type: review
tags: [oracle, security, tests]
status: active
---

# T-0158 independent oracle-amendment brief

The operator instructed the agent on 2026-09-28 to complete all three
remaining prerequisite tasks after being told that narrow, different-author
amendments were pending. This authorises the fixture and redirect amendments
specified here. It does not authorise weakening a behavioural assertion or
changing the accepted private-proxy trust design. The author must
read the original task's frozen hashes, record old and new hashes and exact
test-name sets, and retain every behavioural assertion. Any new assertion
must strengthen the contract. A product failure remains a product failure.

The preimplementation report in `.gate/t0158-existing-tests-before.json`
identified ten existing Jest suites and 186 passing tests. A current run of
those exact ten suites enumerated the same 186 full names: 173 passed and 13
failed. The initial 180-test comparison had substituted the two new T-0158
suites for `run-migrations-upgrade.integration.test.ts` and
`u15-one-driver-for-sql-migrations.test.ts`. `git diff 4f322ea2..HEAD` shows
no changes to any of the original ten test files. Six `proxy-auth.test.ts` cases assert
the former raw cookie or former token-file-path onboarding copy. Preserve the
same-origin, CSRF, URL-stripping and loopback-hint claims while setting up a
real opaque session and checking that its cookie does not contain the root
token. The two `t0158-session-proxy.test.ts` failures use a direct proxy
without process boot or SQLite, and expect the proxy itself to parse a
management request body. Give the proxy a real isolated store; check the
exact management handler as well as adjacent denied paths.

Four `chat-failure-truth.test.ts` cases pass a null request to a handler that
now rechecks a caller before each stream emission. Supply an authenticated
request without changing the event-name, cause-chain or ordinary-event
assertions. The successful-stream control in
`chat-proxy-fails-out-loud.test.ts` supplies a string in place of a response
body. Supply an actual `ReadableStream` and a caller credential; preserve its
status and content-type claims. The B1 cancellation test provides no caller
credential, so the guard closes its stream before reader cancellation.
Authenticate that request and retain the abort-signal before/after claims.
The thirteenth original-suite failure is the migration suite's schema-head
assertion: T-0158 adds schema 43 after the previous fallback-identity head
at 42. Retain its chain-contiguity and head checks while updating the fixture
to name the new last applier.

The built-app browser suite ran 31 tests: 21 passed and ten failed. Its
redirect-following fetch, overwritten `Sec-Fetch-Mode`, undrained stream
frames and private-proxy reachability are classified separately in
`2026-09-t0158-oracle-diagnostics.md`. Preserve the cookie flags, expiry
boundaries, no protected frames after revocation, upstream cancellation,
redirect stripping and both viewport journeys. The private-proxy case waits
for a separate operator ruling; do not infer that an unresolvable hostname or
a directly exposed HTTP listener is a supported proxy deployment.

The frozen `t0158-rotation-status.test.ts` expects an immediate 401 when a
GET hand-off rotates during insertion. A separate, red-first cleanup oracle
proves this leaves `ps_token` in the address bar. Amend that single test to
follow the clean redirect and assert the final 401, no issued cookie, and no
token in any `Location` or final URL. Preserve its name and its POST/storage
controls. The private-proxy browser case stays untouched until the operator
chooses the trust boundary.

The amendment author owns only specifically assigned test paths and must
prove each suite's sorted full-name set before and after. The coordinator
then reruns the corrected focused tests, all Jest suites and the built-app
browser suite on an isolated instance. The full gate remains red until those
checks actually pass.
