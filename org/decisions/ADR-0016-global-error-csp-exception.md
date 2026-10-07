---
summary: A named fail-closed CSP exception for Next's static global error
type: decision
tags: [security, csp]
status: accepted
accepted: 2026-09-28
---

# ADR-0016: fail-closed global-error CSP exception

**Status:** Accepted by the operator on 2026-09-28 for T-0182.

ADR-0015 requires a fresh nonce and zero unexpected CSP violations on
browser documents. Next 16.3.6 pre-renders its internal `/_global-error`
response at build time. That HTML has no request nonce. The production
browser probe of the Webpack build at 1440×900 found nine blocked resources:
six framework chunk requests (five unique URLs), two inline scripts and
one inline style element. The full gate's Turbopack build has ten blocked
resources: seven framework chunk requests (six unique URLs), the same
two inline scripts and one inline style. In each build, one runtime chunk
request appears twice. The response remains HTTP 500 with a useful
heading, `X-Frame-Options: DENY` and `frame-ancestors 'none'`; the no-JS
fallback test passes at desktop and phone widths.

The operator ruled that the static fallback may **fail closed** under the
strict policy. Do not add `unsafe-inline`, `unsafe-eval`, a same-origin
script exception, a report-only policy or a maintained framework patch
to make its scripts run. The operator accepted both exact build patterns
on 2026-09-28 and kept Turbopack as the production build. ADR-0015
governs every other document. The global-error oracle must pin these
two known blocked-resource patterns, retain
the useful fallback, framing denial and a working positive CSP control,
and reject any additional or changed violation. Review the exception
after a Next upgrade or a change to the error page.

This is an exception to the zero-violation acceptance line for the
framework's pre-rendered 500 fallback only. It does not authorise CSP
violations in application routes, authentication refusals or other
error responses.
