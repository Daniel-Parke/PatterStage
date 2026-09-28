---
summary: Independent late security oracle brief for T-0158
type: review
tags: [review, security, oracle]
---

# T-0158 late security oracle brief

An independent reviewer found two live paths after the first browser-session
implementation. The oracle author must not implement their fixes. Use
disposable SQLite and local gateway fixtures, preserve existing test names,
and commit the new tests red before changing production code.

1. In `src/app/api/orchestration/chat/route.ts`, a `stream: false` chat POST
   awaits the gateway response and returns its JSON without checking whether
   the caller's browser session was revoked during that wait. Hold the gateway
   response, revoke the session, release the response, and require no protected
   completion body. Cover a still-valid caller as a passing control. Test the
   actual route with a real session and temporary database.
2. `src/lib/api/auth-throttle.ts` derives its key from caller-supplied
   `X-Forwarded-For`. Under direct LAN HTTP, rotate this header across wrong
   sign-in attempts; a single client must reach 429 within the stated typo
   budget. Cover a legitimate first sign-in and the bounded penalty as
   controls. Avoid a fake request that presumes Next has verified the header.

An application fix must retain the existing 15-second penalty ceiling and
must not make missing browser cookies count as failed token guesses. Existing
tests that assume an untrusted forwarded header identifies a distinct client
need independent, identity-preserving amendments with recorded hashes; no
lint or coverage threshold may change.

The independent sceptic then found a clock-boundary gap: after five failed
guesses, moving the wall clock ten minutes backwards makes the reported
`Retry-After` 601 seconds rather than the 15-second maximum. Add a separate
red-first controlled-clock oracle with an ordinary clock control before
changing the throttle implementation. A valid browser session must remain
usable during a root-token penalty; root Bearer guesses can share the bounded
penalty as the accepted availability tradeoff.

# 2026-09-28 isolated browser gate amendment

The full isolated gate passed lint, typecheck, 746 Jest suites (7,303 passing tests, four skips), Knip, canary, build and build purity. Its browser step had 313 passes, 24 existing skips and one failure: the first quiet Composer stream closed before the three-second pre-revocation assertion. The same 31-test browser-session spec passed alone by `npm run gate -- --rerun-alone tests/e2e/t0158-browser-sessions.spec.ts`. The first stream fetch uses a five-second `AbortSignal.timeout` before awaiting the response, so load during response setup can consume the time left for the three-second assertion. An independent author must confirm the cause and may lengthen only that safety deadline while preserving the three-second quiet-stream assertion, revocation assertions and all 31 test names. Both the full-run failure and solo pass remain recorded under the isolated worktree's `.gate` evidence.

# 2026-09-28 committed-tree mutation follow-up

The clean sweep at `79e8cba6` counted two kills, one duplicate anchor and one infrastructure failure. After correcting the manifest, the clean sweep at `acc4b8e8` counted three kills and one infrastructure failure. The remaining mutant commits schema version 42 after creating the v43 table. `getDb()` then fails its required-head check before the fresh-database test reaches an assertion. A different author may wrap that test's initial `ensureDb()` in an explicit successful-bootstrap assertion. Keep all test names and the missing-SQL rollback test. A later clean-tree sweep must report a structured kill, not an infrastructure failure.

# 2026-09-28 quiet-stream recurrence

The final full gate at committed `e910adc9` passed lint, tsc, 746 Jest suites, Knip, canary, build and build purity, then browser E2E failed 312/314 with 24 existing skips. The valid-Bearer/invalid-cookie case lost its Playwright worker with Windows exit 3221226505. The first quiet Composer stream closed before its three-second assertion again, despite the independently lengthened 15-second safety abort. The solo 31-test browser-session spec then passed. This disproves the assertion that the five-second abort was the sole cause. A different author may add bounded frame and server-exit diagnostics to the existing still-open assertion without changing the condition, delay, names or revocation checks. Inspect a full-load reproduction before altering product code or further timing.

# 2026-09-28 fixture race diagnosis

The diagnostic-only full 314-case E2E run at `f3449a8a` passed, so it did not capture a frame tail. Read-only adversarial review found a concrete fixture race: the test inserts a Composer row as `running` with no current node. The built app's background Composer tick scans active rows and `advanceComposerRun` marks a running row without a current node `failed`. The Composer event route treats that as terminal and closes. The tick's timing varies under full-suite load. A human-approval wait (`awaiting_approval`) is the actual quiet, nonterminal Composer state; `composerTick` explicitly skips it. A different author may change only this fixture row to that state while preserving the quiet-stream and revocation assertions and all 31 names. Full-load evidence must still confirm the repair. The separate Windows worker exit remains an unresolved infrastructure event until reproduced or otherwise attributed.
