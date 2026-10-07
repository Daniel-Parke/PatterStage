---
summary: Durable Composer completion, exclusive queue cleanup and bounded recovery
type: decision
tags: [architecture, composer, runtime]
status: accepted
accepted: 2026-10-04
---

# ADR-0019: Composer completion owns queue cleanup

Status: accepted as drafted by Daniel Parke on 2026-10-04 for T-0194.
The [accepted proposal](../reviews/2026-10-t0194-composer-queue-adr-proposal.md)
records the operator's authority. The independent thirty-case oracle was
committed red in ae6a47be before implementation or this protected entry.

## Context

The pinned Hermes gateway counts retained queues against its ten-run cap.
Polling persists results without consuming those queues. Composer's own
snapshot stream reads SQLite; generic run streams can compete for the upstream
queue. The [verified trace](../reviews/2026-10-t0194-verification.md) distinguishes
completed undrained queues from genuinely active executions.

## Decision

1. Keep Composer completion polling-owned. For Composer-backed runs only,
   the generic run events URL sends its existing SSE envelope from durable
   local state, with open, terminal/error and done events. It no longer
   forwards raw Hermes tool/delta events. Preserve the URL, authentication,
   revocation checks, request cancellation and terminal output/error fields.
   Mission and chat stream behaviour remains unchanged. The normal Composer
   UI continues to use its existing snapshot stream.
2. Persist terminal output, error and usage together with private cleanup
   responsibility in one SQLite transaction. Record the original gateway
   identity when the backend ID is attached. A later profile edit must not
   redirect cleanup to another gateway. Persist no credential material.
3. Only after terminal truth is durable, one process-owned worker claims and
   drains that terminal queue with a finite attempt deadline. Release its
   reader in `finally`. EOF or an events-endpoint 404 confirms release.
   Transport failure or timeout retains pending responsibility and never
   changes the stored outcome or usage.
4. Retry pending cleanup on startup and reconciliation ticks, including
   already terminal runs. Respect the supported single-server deployment;
   concurrent ticks cannot consume the same queue. Interrupted claims are
   recoverable after process restart. Never steal a live owner solely because
   its lease elapsed.
5. Persist pending Composer continuation and advance only after release.
   Recovery uses the existing dispatch guards, without a second paid submit.
   Process at most ten pending records per tick, with one cleanup attempt per
   record per minute. Remove private metadata after continuation is complete.
   If cleanup or continuation remains unresolved for 30 days, fail the workflow
   with an explicit operator-review reason, preserve its completed stage output
   and usage, record the unresolved original gateway identity in that durable
   diagnostic and retire its private retry metadata. Never replay or resubmit
   the completed stage automatically. Existing manual recovery remains an
   operator decision. No new public API or upstream image change is required.

## Verification and rollback

Preserve general runtime callers, ten-active admission, mission/chat streams,
authentication and quiet-stream revocation controls. Independent tests cover
receipt and terminal transaction failures, cancellation, recovery, endpoint
identity, finite reader cleanup, continuation and retention. The full gate,
causal sweep, independent R3 review and hosted jobs remain required.

Rollback must preserve pending responsibility and durable outcomes. Returning
to immediate advancement without an equivalent cleanup owner reopens the
measured admission defect. Do not discard metadata or replay completed stages.
