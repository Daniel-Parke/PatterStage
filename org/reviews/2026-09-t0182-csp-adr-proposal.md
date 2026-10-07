---
summary: Proposed ADR-0015 for a built-app, nonce-based Content Security Policy
type: review
tags: [security, csp, decision]
status: proposed
inspected_revision: 5b5384721ce8e6a66ec01ec1b45907e23beec10a
---

# Proposed ADR-0015: enforce a nonce-based script policy

**Status:** proposed for operator approval. **Owner:** T-0182, ruled R3.
This proposal is outside the protected `org/decisions/` directory. An
accepted copy may enter that directory only after the operator approves this
decision. The approved Phase 2 plan authorises the batch, but does not settle
its runtime policy and style exception.

## Evidence and scope

`next.config.ts` sends `X-Frame-Options: DENY` and only
`frame-ancestors 'none'` in Content Security Policy (CSP). T-0164's built-app
probe added `script-src 'self'` to a browser document response: Next's inline
scripts were blocked and the Missions dialog would not open. That probe did
not test nonces. `src/app/layout.tsx` already reads request headers; the last
build prerendered only `/_global-error` and `/favicon.ico`. The static global
error page may need separate handling and must be tested, not assumed safe.
There are 48 React `style={{…}}` sites across 22 source files, and the
proxy's HTML sign-in refusal also uses inline style attributes. A nonce on a
`<style>` element cannot authorise those attributes.

The [Next.js 16.3.6 CSP guide](https://nextjs.org/docs/app/guides/content-security-policy)
specifies a fresh request nonce in Proxy, the policy on both the forwarded
request and response, and dynamic rendering for nonce-bearing pages. The
[CSP `style-src-attr` reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src-attr)
distinguishes style attributes from style elements. These sources inform the
design; the built-app oracle decides whether it works in this repository.

## Proposed decision

1. Generate a cryptographically random 128-bit nonce for each proxied
   document request. Overwrite any client-supplied `Content-Security-Policy`
   or `x-nonce` request header before Next renders. Send the same nonce in the
   policy delivered to the browser and in the request header Next reads.
   Never log or persist a nonce. Distinct document responses must not reuse
   the nonce or cached HTML. Preserve the current static-asset cache rules.
2. Enforce `script-src 'self' 'nonce-<value>' 'strict-dynamic'` and
   `script-src-attr 'none'` in production. Do not permit `script-src
   'unsafe-inline'` or production `unsafe-eval`. Development may allow
   `unsafe-eval` for Next debugging, with a separate explicit test. Retain
   `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`,
   `form-action 'self'`, `frame-ancestors 'none'` and
   `X-Frame-Options: DENY`. Start image, font and connection sources at
   same-origin plus the measured `data:` or `blob:` needs. Add no external
   origin to a directive without a reproduced browser need.
3. Permit existing inline **style attributes only** with
   `style-src-attr 'unsafe-inline'`; keep style elements and stylesheets under
   `style-src-elem 'self' 'nonce-<value>'`. This is a named, narrow exception
   for 48 current React style sites and the HTML 401 screen, not permission
   for inline scripts. T-0191 may replace finite style values with classes;
   dynamic measurements may need this exception longer. Record the remaining
   exception at programme close rather than claiming a wholly strict style
   policy.
4. Preserve status, cookies, redirects, body and `Cache-Control` for every
   proxy branch, including anonymous HTML/API 401, token hand-off, session
   expiry, read-only refusal and the public health endpoints. Put a response
   policy on early proxy responses as well as rendered pages. Keep the
   frame-only config header on static paths that bypass Proxy. A fresh build
   must prove the effective final header rather than assuming header order.
5. Do not set `upgrade-insecure-requests` on loopback HTTP or the explicitly
   opted-in insecure LAN mode. `PS_PUBLIC_ORIGIN`, the existing origin check
   and secure-cookie rule remain authoritative for transport. A production
   HTTPS-only upgrade directive may be added only if its built-app and proxy
   tests show no broken connection or hand-off. This ADR itself adds no env
   key, route or change to the LAN opt-in rule.

## Acceptance, cost and rollback

An independently authored R3 oracle must be committed red before source
implementation. On a production build, test two different page nonces and a
forged incoming nonce; blocked injected inline script and event handler;
zero unexpected CSP violations; sign-in, Missions dialog, Composer and Help
at 1440×900 and 390×844 through hard reload and client navigation; framing,
status, cookie, origin and read-only boundaries; fonts, CSS, favicon, static
chunks, browser API and event-stream connections; and a forced global-error
response. Measure route prerender classification, response cache headers,
bundle size and repeat-request latency before and after. If the global error
page or any supported journey cannot satisfy the enforced policy, stop for a
new ruling rather than weaken the oracle or hide a violation.

If enforcement breaks a supported journey after landing, prefer a corrected
nonce policy. A rollback to frame-only CSP must be a forward-reviewed change
that names the reopened inline-script exposure. Frame denial and auth checks
must survive either route.

## Rejected alternatives

- `script-src 'unsafe-inline'` would preserve hydration but fails the approved
  T-0182 security invariant and the injected-script control.
- Removing all inline style attributes in this batch would expand it across
  22 UI files, visual behaviour and component ownership before the security
  boundary is proven. That work belongs in the component batch unless the
  built-app oracle shows the scoped style exception is not viable.
- Next's experimental Subresource Integrity can preserve static generation,
  but it does not by itself settle the observed dynamically generated inline
  hydration scripts. It is not the initial enforcement mechanism.
