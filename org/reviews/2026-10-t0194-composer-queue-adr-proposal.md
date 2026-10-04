---
summary: Proposed durable Composer queue cleanup and stream ownership
type: review
tags: [adr, composer, runtime]
---

# Proposed ADR-0019: Composer completion owns queue cleanup

Status: accepted as drafted by Daniel Parke on 2026-10-04 through the
interactive operator ruling. No implementation or protected ADR entry exists
at acceptance. The independent oracle must precede implementation.

## Problem and evidence

The pinned Hermes gateway counts retained event queues against its ten-run
admission cap. Polling records completion without consuming the queue. Ten
completed, unconsumed runs can therefore refuse an eleventh run with 429.
The verified source trace is in [T-0194 verification](2026-10-t0194-verification.md).

Composer already sends browser progress from SQLite snapshots through
`src/app/api/composer/runs/[id]/events/route.ts`. The generic
`src/app/api/runs/[id]/events/route.ts` can nevertheless open another upstream
reader for the same Composer run. Hermes readers compete for one queue and
can remove it on disconnect. A cleanup lock alone cannot protect output and
usage before local persistence.

## Proposed decision

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

## Consequences and proof

This deliberately narrows the generic stream for Composer runs. No inspected
Composer UI consumer requires raw Hermes events, but an external consumer may.
That compatibility change needs the operator's acceptance before implementation.
A stalled cleanup can hold successor admission; its pending state
must remain visible through the existing diagnostics, rather than inventing
a failed stage or silently discarding its output.

Independent controls must prove more than ten sequential completions, the
unchanged ten-active-run refusal, persistence before cleanup, no competing
Composer browser reader, timeout and restart recovery, endpoint identity,
usage preservation, bounded metadata and guarded continuation. Keep mission
and chat stream tests and all authentication/revocation controls. Run the full
gate, causal mutation sweep and every required exact-head hosted job.

Rollback must preserve pending responsibility and durable outcomes. Returning
to immediate advancement without an equivalent cleanup owner reopens the
measured admission defect. T-0194 owns this accepted T-0202 follow-up; this
proposal does not claim that the defect has already been fixed.
