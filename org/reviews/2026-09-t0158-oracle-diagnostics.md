---
summary: T-0158 isolated browser-oracle diagnosis before amendment
type: review
tags: [review, security, tests]
status: partial
---

# T-0158 browser-oracle diagnosis, 2026-09-28

The inspected tree was `dev@7d739435` with uncommitted T-0158 source and
documentation. The independently authored oracle remained frozen at that commit.
An isolated local clone used its own `PS_DATA_DIR`, `CH_DATA_DIR` and
`HERMES_HOME`. `npm ci --offline` passed with 776 packages; the Next 16.3.6
production build passed with ten dynamic-filesystem-tracing warnings. The
clone was moved out of `.gate/` into the Windows temporary directory after
Jest discovered its copied tests as duplicate mocks. No operator database was
used. Playwright owned and stopped its port-3801 server. The child fixtures
allocated separate free loopback ports.

The initial command was `npx playwright test
tests/e2e/t0158-browser-sessions.spec.ts --project=chromium --workers=1`
with `PORT=3801` and `PS_GATE_OWN_SERVER=1`. It exited 1: **21 passed, 10
failed, zero skipped**. Those ten failures must not be treated as ten product
defects. An independent read-only sceptic checked the methods and challenged
the assignments below.

| Failure group | Observed result and reproducible method | Current verdict |
| --- | --- | --- |
| Two real-viewport journeys | The 1440x900 run received 429 after sign-out; the following 390x844 sign-in failed. The exact request sequence was not logged. The old proxy counted invalid session-cookie requests as root-token failures. After removing that count, a fresh owned-server rerun of the same two names passed **2/2**. | Source repair supported by the before/after run; add a focused stale-cookie regression. |
| Cookie-attribute sign-in | The test at `tests/e2e/t0158-browser-sessions.spec.ts:193` used default-following Node `fetch`. The 303 carries `Set-Cookie`, but the followed page request has no Node cookie jar and returns 401. The existing `signIn()` helper already uses `redirect: 'manual'`. | Oracle harness fault; preserve the cookie assertions. |
| Navigation renewal and 12-hour boundary | Node `fetch` rewrites a caller-supplied `Sec-Fetch-Mode: navigate` to `cors`. A local HTTP listener printed `cors` for the test's header set. The classifier in `src/proxy.ts` therefore correctly does not renew. The later 401 is consistent with idle expiry, not evidence about the absolute boundary. | Oracle harness fault; use a real browser navigation or raw HTTP transport and preserve the expiry assertions. |
| Three SSE streams and chat | The tests wait on `reader.closed` before reading an initial queued frame. A local `ReadableStream` with `enqueue` then `close` leaves `reader.closed` pending until that frame is consumed. The four 10-second timeouts do **not** prove or refute protected post-revocation output. | Oracle harness fault at the assertion; rerun after draining frames, retaining the no-leak and upstream-abort checks. |
| Private proxy | The test uses a deliberately unresolvable public host and lets `fetch` follow a redirect to it, causing `ENOTFOUND stage.example`. With `redirect: 'manual'`, it can inspect the direct listener's response and cookie. The accepted ADR-0013 requires private-network isolation, while the test exposes the listener directly. | Harness fault plus an unresolved boundary decision; do not silently weaken either the ADR or the test. |

The focused real-SQLite Jest oracle passed its migration and hash assertions.
The direct-proxy Jest oracle remains **4/5** because its GET hand-off invokes
the proxy without a boot generation or session store. A separate direct proxy
probe after a source repair showed that exact body-token list and revoke paths
return a proxy pass-through response while neighbouring paths return 401;
handler-level validation still needs a committed behavioural test. The
unmodified `read-only-actually-reads` and `failed-auth-costs-something` suites
passed **49/49** after the stale-cookie change, and test TypeScript passed.

An independent source review found a token-rotation race: sign-in checks one
root-token value, then session creation rereads the token file. If rotation
occurs between those operations, an old supplied credential can mint a session
bound to the new token. The reviewer reproduced that interleaving with an
in-memory probe, not a live request. A committed regression must fail on the
interleaving before the implementation binds creation to the credential it
just checked. The review also found that `docker-compose.yml` advertised
`localhost` while `PS_PUBLIC_ORIGIN` required `127.0.0.1`; its advertised URL
and the matching runtime guide now use `127.0.0.1`. Expired and revoked
`auth_sessions` rows have no prune rule. That is a separate retention decision,
not authority to delete operational rows in this batch.

The default sandbox could not start `tsx` child fixtures: Node failed in
`os.userInfo()` with `uv_os_get_passwd ... ENOMEM` before application code ran.
The same isolated migration outside the sandbox exited 0 and advanced an
empty SQLite database from schema 0 to **43**. Do not count the sandbox
failure as a migration defect or a passing fixture.

The independent ADR-0014 retention and ADR-0013 rotation addenda were
committed red at `3cf2a7f4`: seven intended failures, one passing rollback
control, zero skips. After binding creation to the just-verified credential
and wrapping eligible cleanup plus insert in one SQLite transaction, the two
addenda and the original session-store suite passed **10/10**. A focused run
of old proxy suites remained red at **8 failures, 65 passes**. Six failures
in `proxy-auth.test.ts` assert the old raw cookie or old 401 file-path copy;
the two in `t0158-session-proxy.test.ts` invoke the proxy without a boot/SQLite
fixture or expect the proxy to parse a management body that the handler owns.
These are test-contract/method questions for the independent R3 amendment
procedure, not a green gate verdict.

This note is diagnosis, not a green batch verdict. The full gate, mutation
sweep, corrected built-app oracle, hosted jobs and visual screenshots remain
outstanding. The R3 ORACLE procedure and a different author govern amendments
to the frozen oracle; operator authorisation is pending.

## Wider existing-suite check, 2026-09-28

The first `npx jest --runInBand` over ten mixed existing and new T-0158 unit
suites exited 1: **166 passed, 14 failed, zero skipped**. The original eight
auth/proxy failures remain. Six further failures expose fixtures written before streams rechecked
their caller. Four `chat-failure-truth.test.ts` cases pass a `null` request to
the run-events handler, so `streamAuthorizer` cannot read authentication
headers. The successful-stream control in `chat-proxy-fails-out-loud.test.ts`
supplies a string as the mocked gateway response body; the new stream guard
requires a `ReadableStream` and the handler returns 500. The B1 cancellation
case supplies no authenticated credential; the guard aborts upstream before
the test cancels its reader. These are direct-handler fixture contradictions,
not evidence that a normal authenticated request fails. The original event
name, error detail, gateway and cancellation assertions must remain. A
different author must supply realistic request/stream fixtures under the
closed-oracle amendment procedure if the operator authorises it. Until then,
the whole Jest run and full gate remain red; the 12/12 focused T-0158 addenda
are only partial evidence.

The original ten-suite population was recovered from the ignored local
`.gate/t0158-existing-tests-before.json`: the eight existing auth/stream
suites above, plus `run-migrations-upgrade.integration.test.ts` and
`u15-one-driver-for-sql-migrations.test.ts`. A current run of those exact ten
exited 1 with **173 passed and 13 failed of 186**. Direct comparison of the
sorted suite-path/full-name arrays found all 186 names identical. The ten
test files have no committed diff between `4f322ea2` and `8170aa86`.
The thirteenth failure is the migration oracle expecting schema head 42;
T-0158's new `auth_sessions` migration makes the head 43. It needs an
independent narrow amendment that retains its chain checks. The earlier
180-test figure was a population-selection mistake, not lost test identity.

## Independent rotation cleanup review

An independent source reviewer found that the first rotation-response repair
committed a session row before its post-insert credential recheck, even when
the response then refused the cookie. The same reviewer found that a refused
GET `?ps_token=` hand-off returned its 401 page at the credential-bearing
address. No disclosure beyond the retained address was demonstrated. The
reviewer also noted that a missing token source was labelled 401 after insert
instead of 503; both paths fail closed.

An independently authored five-test cleanup oracle was committed red at
`8170aa86`: three intended failures and two passing controls. It exercises
real SQLite, a rotation at INSERT and a simulated browser redirect journey.
After moving the credential recheck inside the insert/prune transaction, the
four focused T-0158 suites ran **15 passed, two failed**. The rollback check
now proves zero rows after rotation. Both remaining failures are the token-
bearing final URL on failed hand-off. A reliable redirect conflicts with the
earlier frozen direct-401 expectation; a different-author, operator-approved
amendment is pending. The 15/17 focused result is not a gate pass.
