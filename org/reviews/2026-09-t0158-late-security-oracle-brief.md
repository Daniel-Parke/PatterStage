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
