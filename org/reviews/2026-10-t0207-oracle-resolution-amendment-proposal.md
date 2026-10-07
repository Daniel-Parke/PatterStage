---
summary: Proposed independent correction to the research transport fixture's module resolution
type: review
tags: [oracle, security, testing]
---

# T0207 module-resolution amendment proposal

Status: authorised by Daniel Parke through the interactive answer on 2026-10-04. Implementation and verification of the independent amendment remain pending. No frozen assertion changes are authorised.

## Evidence

The 19-case DNS oracle passes alone and before the one-case cancellation suite.
The original cancellation-before-DNS order reproducibly fails fourteen cases:
`tmp/t0207-queue-first-control.json` and its log retain the failures. The ordered
two-case trace reaches public admission and the production lookup, but its call
stack omits the fixture connector and never reaches the fixture response:
`tmp/t0207-queue-first-trace.log`. This implicates an intercepted-module mismatch,
rather than a proven dispatcher shutdown deadlock. No timeout has been raised.

The frozen fixture registered Undici as a virtual module while bootstrapping
the oracle before the direct dependency existed. Undici is now installed.
Independent review must confirm the precise resolver interaction before
accepting the amendment as a repair. The failed and successful receipts remain.

## Requested amendment

Authorise a session other than the original oracle author and implementer to
correct only the Undici mock's resolution to the installed module. Preserve all
19 names, assertions, positive controls, real HTTP/TLS operations, deadlines and
resource checks. Add a fail-closed fixture check if required to prevent any
unintercepted transport from leaving its owned listeners. Do not mock away real
TLS, admit private addresses in production or sort the suite to evade failure.

Record the old hash, new hash, exact change, author, operator authoriser and
date in a new dated amendment. Demonstrate both suite orders pass, including
the previously failing order, and retain the full gate and causal sweep.
Original LF hash: `f62e0aa6be4b7ca25d85bddd10c69e48dd7a821dca0cd6e41b85c348f9510e22`.

The [ORACLE charter](../roles/ORACLE.md), Amendments, requires operator authority
at R3: “a non-implementer session authors it, authorised by a REVIEWER at R2
and by the operator at R3.” The coordinator cannot amend this frozen oracle.
