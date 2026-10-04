---
summary: Proposed per-hop address pinning for the confirmed research-fetch DNS bypass
type: review
tags: [adr, security, search]
---

# Proposed ADR-0020: bind research fetches to validated addresses

Status: accepted as drafted by Daniel Parke through the interactive ruling on2026-10-04. No Search implementation or protected ADR entry exists at acceptance; the independent oracle must precede implementation.

## Evidence

The [owned probe](2026-10-t0207-dns-rebinding-probe.mjs) and
[source-bound receipt](2026-10-t0207-dns-rebinding-evidence.json) reproduce
one public guard resolution, one loopback transport resolution and one
forbidden owned listener request whose response becomes research content.
The source comment does not constitute an accepted exception. No external
service or operator data was accessed.

## Proposed decision

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

## Alternatives and rollback

A dependency-free Node HTTP/HTTPS implementation can also pin lookup, but
requires maintaining fetch-compatible redirect, response and decompression
behaviour. That is the alternative if the operator rejects the dependency.
Using an undocumented copy inside Next or changing the URL to an IP would
couple security to framework internals or break HTTPS identity.

Rollback must retain an equivalent validated-address boundary, or temporarily
refuse research-page retrieval. Do not restore the demonstrated bypass merely
to remove the dependency. The approved research capability otherwise remains.

The [EXECUTOR charter](../roles/EXECUTOR.md) puts a new dependency in the
durable decision band. The [repository entry](../../CLAUDE.md) requires an
accepted ADR before editing the protected decisions directory.

Primary API reference: [Undici Agent](https://github.com/nodejs/undici/blob/main/docs/docs/api/Agent.md).
