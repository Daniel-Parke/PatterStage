---
summary: Operator-authorised independent fixture correction with both suite orders verified
type: review
tags: [oracle, testing, security]
---

# T0207 oracle amendment, 2026-10-04

Reason: the original virtual Undici mock missed a cached installed-module ID
when the cancellation import chain ran first. Jest's shared resolver caches
module IDs without virtual-mock state. The resulting real transport bypassed
the owned connector. This was a fixture-resolution defect, not a demonstrated
dispatcher shutdown deadlock or a reason to extend timeouts.

Author: Faraday, session `01a1062b-0f36-7702-885b-476fd150d9bf`, distinct from
original author Helmholtz and the coordinator implementer. Authoriser: Daniel
Parke, interactive acceptance on 2026-10-04 of the narrow amendment proposal.

Change: register the installed Undici mock without `virtual:true`; add a native
connection fence that permits only the fixture's owned listeners. No product
TLS policy, DNS admission, test timeout or behaviour assertion changes.

File: `tests/unit/research-fetch-dns-pinning.test.ts`.
Old LF SHA256: `f62e0aa6be4b7ca25d85bddd10c69e48dd7a821dca0cd6e41b85c348f9510e22`.
New LF SHA256: `188e687d9469fb5f4530aaf252151f32b815288dde02af9fea6c027467bc4bfb`.
All 19 names, test bodies, 128 assertion call expressions and deadlines held.
Original bytes remain in commit fa17377a and the preserved red receipts.

The fenced original reports six passed, fourteen failed and zero runtime errors;
all fourteen unowned connection attempts were blocked. The amended original
queue-before-DNS order and reverse order each pass 20/20, including the separate
one-case invalid-cancellation control. Actual test types, scoped ESLint and diff
check exit zero. Exact logs, source bindings and identity checks are retained in
`tmp/t0207-resolution-amendment/freeze.json`.

Independent Parfit review remains required. This amendment does not establish
full-gate, causal-sweep, hosted or release acceptance.

Historical correction: the prototype relocation receipt's statement that the
operator was informed before relocation is inaccurate. The coordinator informed
the operator after restoring the exact root bytes. No full gate ran while that
failing oracle was relocated. The old receipt is retained unchanged.
