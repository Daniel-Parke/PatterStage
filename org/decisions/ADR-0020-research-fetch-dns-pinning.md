---
summary: Bind research connections to validated addresses with supported Undici dispatchers
type: decision
tags: [architecture, security, search]
status: accepted
accepted: 2026-10-04
---

# ADR-0020: bind research fetches to validated addresses

Daniel Parke accepted the [proposal](../reviews/2026-10-t0207-dns-pinning-adr-proposal.md)
as drafted on 2026-10-04. The independent nineteen-case oracle was committed
red in fa17377a, with nine matcher failures and no infrastructure errors.

## Context

The [owned probe](../reviews/2026-10-t0207-dns-rebinding-probe.mjs) and
[receipt](../reviews/2026-10-t0207-dns-rebinding-evidence.json) reproduce
a public admission lookup followed by a private transport lookup. One forbidden
owned listener receives the request and its body becomes research content.

## Decision

1. Bind each research-fetch connection to addresses admitted by that hop's
   URL and DNS checks. Refuse mixed public/private results. Do not resolve
   the hostname again in the transport, fall back to an unvalidated address,
   reuse a dispatcher across different validation decisions, or weaken TLS.
2. Add Undici 8.11.2 as a direct runtime dependency and use its supported
   per-request dispatcher/connection options. npm metadata verified this
   candidate and its Node >=22.19.0 requirement on2026-10-04. Advance the
   already approved Node22 minimum into T0207, qualifying it as22.19.0 or newer,
   including package engines and installation guidance. Keep the approved Node24
   build target; T0196 retains the rest of its tooling and CI consolidation.
   Do not leave documented Node20 support inconsistent.
3. Preserve the original Host and HTTPS server name/certificate verification,
   manual redirect checking at every hop, decompression, output shape, URL
   credential refusal and the single existing twelve-second request budget.
   Release each response and owned dispatcher on success, refusal and abort.
4. Keep configured gateway/Searx services separate from attacker-influenced
   research-page fetching. Introduce no new URL, environment key or CLI command.
5. Freeze independent behaviour controls before implementation. Prove zero
   forbidden fixture requests, permitted retrieval, redirect refusal, mixed
   DNS answers, hostname/TLS preservation, cancellation and resource cleanup.
   Run audit, the complete gate, causal sweep and hosted checks before closure.

## Verification and rollback

Independent review qualifies fixture evidence and its limits. The full gate,
supported-runtime checks, causal sweep and hosted jobs remain required.
Rollback must retain an equivalent validated-address boundary or temporarily
refuse research-page retrieval. Do not restore the demonstrated bypass.
