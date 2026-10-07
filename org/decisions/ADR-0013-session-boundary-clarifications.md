---
summary: Complete the session transport, token rotation, read-only and onboarding boundary
type: decision
tags: [security, auth, sessions]
status: accepted
---

# ADR-0013: complete the browser-session boundary

**Status:** accepted by Daniel Parke (operator), 2026-09-27, in the
interactive review of this complete proposal. **Inspected revision:**
`25ab854f` plus accepted ADR-0012 at `658e49a2`, 2026-09-27. **Owner:** T-0158.
**Supersedes:** ADR-0012 only on the six points below; its other decisions
remain in force. An independent read-only reviewer found these gaps after the
operator accepted ADR-0012. The accepted text is immutable under
`org/CONSTITUTION.md` Part III, so this is a new decision rather than an edit.

## Decision

1. **Make the TLS boundary enforceable.** `npm run start` binds to loopback.
   For a same-host HTTPS reverse proxy, the app listener also binds loopback;
   the proxy exposes HTTPS and sets forwarding headers after stripping any
   client-supplied versions. For a proxy in another container or host, the app
   listener may bind its private interface only if the operator restricts
   reachability to that trusted proxy by container network or firewall; the
   HTTP app port must not be published to browsers. `PS_PUBLIC_ORIGIN=https://…`
   selects the public origin and Secure cookie, but does not by itself prove
   transport. `npm run start:network` stays available for the explicitly
   opted-in `PS_INSECURE_LAN_HTTP=1` direct-LAN mode and for isolated private
   proxy networks declared with `PS_PRIVATE_PROXY_NETWORK=1`. The managed
   network startup and deploy scripts refuse to launch without one of those
   explicit modes; document and test each supported deployment shape. A direct
   `next start -H 0.0.0.0` invocation bypasses those scripts, so it is outside
   the supported secure-LAN setup. Print a warning for either exception. A
   public HTTPS origin with a directly exposed HTTP listener is unsupported,
   regardless of forwarded headers.

2. **Bind rows to the current root token.** Add a token-binding column to
   `auth_sessions`: an HMAC-SHA-256 digest of the active operator token under a
   process-owned random boot key. The boot key is never persisted or logged.
   Compare that digest with the current `readAuthToken()` value on every
   browser-session validation. File or env token rotation changes the digest
   and invalidates every old browser session without a restart. No plaintext
   token or reusable plain hash is stored in the session table. A missing
   active token fails closed.

3. **Allow only session-state renewal on qualified navigation under
   `PS_READ_ONLY`.** The accepted read-only exceptions include the deliberate
   GET hand-off and an atomic `last_active_at` update for a validated,
   interactive, top-level page navigation. The navigation classifier must
   require browser navigation metadata and must not count prefetch, polling,
   stream reconnection or background fetches. It grants no application write.
   The exact unsafe method/path list in ADR-0012 remains exhaustive.

4. **Route body-token sign-in through a narrow public proxy exception.** Only
   `POST /api/auth/sign-in` may reach its handler without an existing Bearer
   token or session. The handler enforces a small body limit, exact public
   `Origin` (or validated direct-loopback origin), shared failed-attempt
   throttling, constant-time token comparison and atomic session creation.
   Invalid input answers without session state; the proxy does not broaden
   `PUBLIC_PATHS` to all `/api/auth/*`. `PS_READ_ONLY` still permits this exact
   auth lifecycle write.

5. **Replace the logged-token onboarding path.** Boot logs the token-file
   location and a token-free instruction, never the token or a token-bearing
   URL. The 401 page, install and first-hour guides instruct a local operator
   to read `PS_DATA_DIR/auth-token` directly with owner permissions, then use
   POST sign-in or the retained intentional `?ps_token=` URL. With
   `PS_AUTH_TOKEN`, the operator reads their own service or container secret
   source. If the file token is lost, deleting it and restarting mints a new
   one and invalidates Bearer clients and browser sessions; document that
   consequence. The URL hand-off remains supported but is no longer printed
   into persistent logs.

6. **Correct the live task record before code changes.** Replace T-0158's
   universal `X-Forwarded-Proto` assertion with the refuted verdict in
   ADR-0012. Expand claims to migration, session repository, proxy, auth
   routes, boot, streams, UI, startup scripts, docs and oracles. Declare
   `touches-auth` and `migrates-schema`; record the router's R3 verdict for
   protected-set contact and the accepted standards exception. Commit the
   independent red-first oracle before implementation.

## Verification and consequence

Test a direct HTTP attempt to a network-bound listener even when the request
claims HTTPS in `X-Forwarded-Proto`; it must not get a session in the secure
deployment mode. Test same-host loopback proxy, private-network proxy and
insecure-LAN opt-in separately. Rotate the token file while the process is
running and verify that old sessions fail. Confirm interactive navigation
renews under read-only mode while application writes still fail. Verify
unauthenticated POST sign-in is reachable only at its exact path and is
throttled. Check boot logs and every onboarding document for token-bearing
instructions. Preserve Windows/Git Bash startup.

The private-proxy mode requires operator-managed network isolation. The app
cannot infer the peer socket securely from a browser-supplied `Host` or
forwarding header. If isolation is absent, the secure-LAN claim does not hold.

## Evidence

- `package.json` `start` and `start:network`; `scripts/tooling/ps-deploy.mjs`
  listener default; `scripts/bootstrap/install.sh` and `setup.mjs` network
  startup guidance.
- `src/lib/api/auth-token.ts` rereads a rotated file without restart;
  ADR-0012's row list has no token binding.
- `src/proxy.ts` currently checks authentication before any POST handler;
  the proposed body-token sign-in needs a narrow exception.
- `src/instrumentation.ts`, `src/proxy.ts`'s 401 copy and
  `docs/start-here/first-hour.md` currently rely on the logged token URL.
- Independent read-only review by session
  `01a0e253-5069-74f0-9cf7-eda09caff023`, 2026-09-27.
