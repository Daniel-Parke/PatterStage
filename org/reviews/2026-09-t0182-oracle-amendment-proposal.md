---
summary: Proposed independent amendment to the T-0182 injected-script oracle
type: review
tags: [security, csp, oracle]
status: accepted
inspected_revision: 6460bb9d
---

# T-0182 injected-script oracle amendment proposal

**Status:** operator authorised on 2026-09-28 under the R3 ORACLE charter.
The implementing coordinator will not edit the frozen oracle.

The independent oracle was frozen in `6460bb9d`. Its desktop and phone
"an injected inline script cannot execute" cases create a `<script>` element
from `page.evaluate()` and append it to the live DOM. A built Chromium run
against the accepted nonce policy executed that script. The response had a
fresh 128-bit nonce and a `script-src` containing `strict-dynamic`; a separate
event-handler injection was blocked. The [CSP Level 3 specification](https://www.w3.org/TR/CSP/)
allows non-parser-inserted scripts under `strict-dynamic`. The current test
models code already running with script authority, not an untrusted inline
script inserted into the server's HTML. Its failure does not prove the
document policy is absent.

**Proposed exact amendment:** a separate ORACLE author changes only the body
of those two cases in `tests/e2e/t0182-csp.spec.ts`. Before navigation, use
Playwright routing to fetch the document and insert an un-nonced inline script
into the returned HTML before `</body>`. Preserve the original response
status, headers, other bytes and browser context. Navigate and assert that
the inserted script did not execute, hydration still works and the delivered
policy has the fresh nonce. Keep both case names, viewport parameters, all
other frozen cases and the no-script-unsafe-inline assertion. Prove the
amended case fails against the pre-CSP build and passes only with enforcement.
Record before/after file hashes and identical test-name sets. Do not loosen
the policy, remove `strict-dynamic`, skip a case or edit implementation.

This clarification bounds the ADR's "injected untrusted inline script"
invariant to parser-inserted markup. Code that already holds trusted script
execution may create child scripts under `strict-dynamic`; application code
must not feed attacker text to that API. A separate source audit can assess
such script gadgets if evidence warrants it.
