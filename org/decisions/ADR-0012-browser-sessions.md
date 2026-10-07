---
summary: Opaque, revocable browser sessions and their transport boundary
type: decision
tags: [security, auth, sessions]
status: accepted
---

# ADR-0012: revocable browser sessions

**Status:** accepted by Daniel Parke (operator), 2026-09-27, in the
interactive review of the complete proposal. The accepted text was prepared
outside the protected directory before this approval. **Inspected revision:**
`25ab854f` (2026-09-27). **Owner:** T-0158. **Existing rulings:** Q-020,
Q-022, Q-026, Q-028 in `org/QUESTIONS.md`.

## Evidence and correction

`src/proxy.ts` writes the full operator token to `ps_session` with a one-year
`maxAge` and accepts that cookie as the token. There is no per-browser
revocation or self sign-out. `src/lib/api/auth-token.ts` reads the operator
credential on each request, so token rotation invalidates every Bearer client.
`src/instrumentation.ts` also prints a token-bearing URL at boot. The streams
in `src/lib/sse/event-stream.ts` and
`src/app/api/runs/[id]/events/route.ts` can continue emitting after the
initial proxy check. These are code findings, not a claim that every proxy
configuration leaks a cookie.

The original T-0158 record's statement that `NextRequest.nextUrl.protocol`
universally ignores `X-Forwarded-Proto` is **refuted**. Normal Next request
handling already honours that header. A synthetic `NextRequest` probe did not
model the normal server path. The raw-token, one-year lifetime and revocation
findings survive. Neither the header nor `Host` alone proves the browser's
transport or the remote peer; a caller can supply either unless a trusted
front end controls it. Implementation must correct the record and tests.

## Decision

1. **Keep the operator token for explicit Bearer clients; replace only browser
   cookies.** Generate a new 256-bit secret with a cryptographic random source
   for each browser sign-in. The browser receives only that opaque secret in an
   `HttpOnly`, `SameSite=Lax`, path `/` cookie. Store its SHA-256 hash, never the
   plaintext, in a separate `auth_sessions` SQLite table. The table contains a
   non-secret session identifier, creation and last-active times, absolute and
   idle expiry, revocation time and a boot-generation identifier. No token or
   credential is logged, returned in a session list or saved in browser
   storage. Migrate existing databases through the normal migration path; old
   raw-token cookies are rejected and explicitly cleared.

2. **Enforce two server-side clocks.** A session expires after 30 minutes
   without qualifying user activity and no later than 12 hours after creation.
   The cookie's `Max-Age` cannot exceed the remaining absolute lifetime.
   Deliberate interactive page navigation and user-initiated API actions may
   renew `last_active_at`; polling, prefetch, heartbeats and streams may not.
   Classify these requests explicitly, rather than treating every GET as
   activity. Use the database's atomic conditional update so concurrent
   renewal cannot revive an expired or revoked row. Decide expiry before
   activity renewal at the exact boundary; `now >= expires_at` is expired.
   Token rotation invalidates existing browser sessions as well as Bearer
   authentication with the old token.

3. **Invalidate sessions at every server restart.** Mint a random boot
   generation in the running server process, never from SQLite or an env value
   persisted across restarts. Proxy, route handlers and stream guards must
   observe that same generation in the production bundle. A row whose
   generation differs is invalid even if a restored database contains it.
   If a bundle/process cannot obtain the current generation, fail closed.
   Multi-process installations must prove a single generation and consistent
   revocation before browser sessions are enabled; otherwise document them as
   unsupported. A boot-generation mismatch requires sign-in again, per Q-026.

4. **Make session lifecycle explicit.** Preserve the existing intentional
   `GET ?ps_token=` navigation hand-off, including its clean redirect, for
   compatibility. Add `POST /api/auth/sign-in` with the operator token in the
   request body, and `DELETE /api/auth/session` for self sign-out. Add
   `POST /api/auth/sessions/list` and
   `POST /api/auth/sessions/revoke` for individual management. Both management
   calls require a freshly supplied operator token in the request body or an
   explicit Bearer header; possession of a browser session alone is
   insufficient. Never retain that input in local or session storage. The
   list contains only non-secret metadata and opaque row identifiers. Revoke
   uses an atomic update; already queued responses and all open streams must
   stop emitting once revocation is visible. Sign-out clears the current and
   legacy cookies and revokes the current row. Keep Bearer precedence and
   existing `PS_AUTH_MODE=none` semantics, with no privileged management
   endpoint in that mode.

5. **Pin browser transport to `PS_PUBLIC_ORIGIN`.** For network deployment,
   require an explicit absolute origin with scheme, host and optional port;
   reject paths, credentials, fragments and ambiguous forms. This configured
   origin is authoritative for cookie security and exact `Origin` comparison.
   `Sec-Fetch-Site` can supplement but never override a mismatched or absent
   required `Origin` on cookie-authenticated unsafe requests. A trusted reverse
   proxy must strip incoming forwarding headers and set its own; no auth
   decision trusts client-supplied `X-Forwarded-Proto` or `Host` alone. HTTPS
   gets `Secure` cookies. Direct loopback HTTP remains supported. Non-loopback
   HTTP is rejected by default. An explicit
   `PS_INSECURE_LAN_HTTP=1` with an `http://` public origin permits it and
   warns at boot that a network observer may capture the session; this is a
   recorded exception to the HTTPS/Secure session guidance. The default
   startup binds to loopback; `start:network` remains available, subject to
   this origin policy. Document reverse-proxy and Windows/Git Bash examples.

6. **Keep `PS_READ_ONLY` about application data.** Authentication lifecycle
   writes are allowed only for the existing safe-method token hand-off and
   these exact unsafe method/path pairs:

   | Method and path | Permitted authentication state change |
   | --- | --- |
   | `POST /api/auth/sign-in` | Create one browser session |
   | `DELETE /api/auth/session` | Revoke the caller's session and clear cookie |
   | `POST /api/auth/sessions/list` | Read session metadata with fresh operator credential; no application write |
   | `POST /api/auth/sessions/revoke` | Revoke a named session with fresh operator credential |

   No wildcard `/api/auth/*` exemption. Other unsafe methods and all
   application writes still receive the existing refusal. The hand-off is an
   explicit auth-store side effect of a safe navigation, not permission for
   other safe-method application writes.

7. **Fail closed.** A missing or failed `auth_sessions` migration, unavailable
   storage, failed hash comparison, absent generation, invalid origin or
   uncommitted session creation never grants a browser session. Do not send a
   cookie before the insert commits. Check expiry, generation and revocation
   before each stream emission and on quiet-stream ticks. On invalidation,
   abort the upstream source, close the downstream stream and emit no further
   protected data. Apply this to the shared SSE helper, run-events proxy and
   chat streaming response, with cancellation tests.

## Consequences and alternatives

Existing browsers must sign in again on upgrade and after every restart.
Individual sign-out and revocation no longer disrupt Bearer clients. SQLite
becomes part of browser authentication availability; errors deny access rather
than falling back to the root token cookie. The session table is operational
state that backup and restore may carry, but its boot generation prevents a
restored row from authenticating after restart.

The explicit insecure LAN option permits plaintext transport by operator
choice. It does not make that transport safe. A proxy that fails to strip
untrusted forwarding headers is outside the supported secure-LAN setup. An
always-Secure cookie would break direct loopback HTTP; a raw-token cookie with
a shorter lifetime would still lack per-browser revocation; rotating the
operator token on sign-out would disrupt all Bearer clients. Those alternatives
do not meet Q-020/Q-022/Q-026.

## Implementation and acceptance contract

T-0158 is R3 and requires a separate ORACLE author, a red-first committed
oracle, owned claims, rollback and a full unchanged-tree gate. Before source
changes, test the current production bundle's proxy/route/stream generation
sharing; a unit-only singleton test is insufficient. The independent oracle
must cover 256-bit randomness and hash-only persistence, cookie attributes,
legacy-cookie rejection, 30-minute and 12-hour boundaries, no renewal from
polling/prefetch/streams, concurrent renewal/revocation, individual and self
revocation, operator-token rotation, restart and restored database rows,
storage and migration failures, exact origins and the three transport modes,
read-only lifecycle exceptions and application-write refusals, and every
protected stream including quiet periods. Preserve existing test identities
when adapting old raw-cookie assertions. Walk sign-in, session management and
sign-out at 1440×900 and 390×844. Run the complete gate, mutation sweep and
hosted push/PR jobs before closing the task. Revert the auth change and its
schema migration only through a forward-compatible rollback; never drop a
session table containing live rows as an emergency shortcut.

The code plan must identify where boot generation is minted, how separate
Next bundles see it, how requests are classified as interactive, and how the
proxy's successful validation is made available to stream handlers without
trusting a caller-supplied header. If the production-bundle test cannot prove
those properties, implementation stops for a new design review.

## Sources checked

- `src/proxy.ts`, `src/lib/api/auth-token.ts`, `src/instrumentation.ts`,
  `src/lib/sse/event-stream.ts`, `src/app/api/runs/[id]/events/route.ts`,
  `src/app/api/orchestration/chat/route.ts` at `25ab854f`.
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): opaque random identifiers, server-side idle and absolute expiry, revocation.
- [Next.js 16 Proxy guide](https://nextjs.org/docs/app/getting-started/proxy) and
  [authentication guide](https://nextjs.org/docs/app/guides/authentication):
  Proxy runs before requests, but is not by itself a complete session or
  authorisation solution; prefetched requests also pass through it.
