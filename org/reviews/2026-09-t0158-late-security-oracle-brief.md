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
