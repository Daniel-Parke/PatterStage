---
summary: Enforce a nonce-based Content Security Policy for browser documents
type: decision
tags: [security, csp]
status: accepted
accepted: 2026-09-28
---

# ADR-0015: nonce-based browser script policy

**Status:** Accepted by the operator on 2026-09-28 for T-0182. The accepted
proposal and evidence are in
`org/reviews/2026-09-t0182-csp-adr-proposal.md`. The operator selected its
drafted nonce policy, including the scoped inline-style exception.

## Context

The current policy denies framing but does not restrict scripts. A built-app
probe with `script-src 'self'` blocked Next hydration and the Missions dialog.
Next requires a request nonce for its inline scripts. Existing React style
attributes also need a separate style policy. Authentication responses and
loopback HTTP must keep their present behaviour.

## Decision

1. Generate a fresh cryptographically random 128-bit nonce for each proxied
   document request. Replace untrusted incoming CSP and `x-nonce` request
   headers. Forward the matching CSP and nonce to Next, and deliver that CSP
   with the response. Do not persist, log or cache a nonce-bearing document.
2. Enforce production `script-src 'self' 'nonce-<value>' 'strict-dynamic'` and
   `script-src-attr 'none'`. Do not allow production script `unsafe-inline` or
   `unsafe-eval`. Development may use `unsafe-eval` if its need is tested.
   Keep `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`,
   `form-action 'self'`, `frame-ancestors 'none'` and `X-Frame-Options: DENY`.
   Add only measured image, font and connection sources.
3. Allow existing inline style attributes with
   `style-src-attr 'unsafe-inline'`. Keep stylesheets and style elements under
   `style-src-elem 'self' 'nonce-<value>'`. This exception does not authorise
   inline scripts. Record it at programme close if it remains. Component
   cleanup may reduce it later without weakening the script boundary.
4. Preserve status, redirects, cookies, body and cache controls on every
   proxy branch. Apply policy to early proxy responses. Static paths that
   bypass Proxy keep their frame-only header. Test the effective built-app
   response rather than assuming header order.
5. Keep loopback HTTP and the explicit insecure-LAN opt-in. Do not apply
   `upgrade-insecure-requests` there. Existing `PS_PUBLIC_ORIGIN`, origin
   validation and secure-cookie rules remain authoritative. An HTTPS-only
   upgrade directive requires its own built-app proof. This ADR adds no route,
   environment key or LAN opt-in change.

## Acceptance and rollback

An independent R3 oracle is committed red before implementation. A production
build must prove distinct nonces across page requests, resistance to forged
incoming nonce headers, blocked injected script and event handlers, zero
unexpected policy violations, and working sign-in, Missions, Composer and Help
at 1440×900 and 390×844. It must cover framing, authentication refusals,
global error, assets, streams, cache behaviour and bundle effects.

If enforcement breaks a supported journey, obtain a revised ruling rather
than weaken the oracle. Prefer a corrected nonce policy. A return to a
frame-only policy requires a forward-reviewed change that names the reopened
inline-script exposure and preserves framing and authentication controls.
