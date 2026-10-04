# T0194 Composer queue oracle and implementation brief

Authority: Daniel Parke accepted the exact ADR0019 proposal on 2026-10-04.
Its generic Composer SSE narrowing and 30-day unresolved responsibility
policy are deliberate, authorised changes. Other run streams remain unchanged.
No protected ADR or queue implementation before independently frozen red.

Use one private meta record per Composer agent run, with a versioned prefix.
Keep output/usage in existing run columns. Record the actual submission
endpoint identity and backend ID atomically with attachment. Resolving a
profile again after the POST reply does not prove which endpoint accepted it.
Pin the submission endpoint across existing 429 retries. Preserve all retry
delays, active cap, cancellation and general AgentRuntime behaviour.

Proposed private module src/lib/composer/queue-cleanup.ts exposes these oracle
seams: recordComposerGateway(runId, receipt), loadComposerQueue(runId),
persistComposerTerminal(runId, result), claimComposerQueue(runId, owner, nowMs)
and sweepComposerQueues({nowMs, signal}). These are internal names, not a new
HTTP/CLI contract. Freeze the exact signatures with the oracle author before
implementation. Private receipt/drain capability belongs at the runtime seam,
without making core depend on Hermes modules or changing general runtime callers.

Record fields: version, backendRunId, gatewayIdentity, phase attached/pending/
released, pendingSince, nextAttemptAt, owner pid/token or null,
continuationPending and lastFailure. No credential material. Invalid metadata
fails closed and remains diagnosable. Repeated terminal persistence preserves
the original responsibility timestamp and owner. Immediate transactions protect
attachment, terminal persistence and claims. Every post-await write matches its
owner token; never steal a live or uncertain owner because a lease expired.

Drain only confirmed terminal queues after output/error/usage and stage
finalisation are durable. Compare current resolved endpoint identity before
fetch and reuse that same endpoint. On mismatch send no request or credentials.
Use a finite attempt deadline and release/cancel its reader in finally. EOF or
events 404 confirms release; timeout/transport failure remains pending and
cannot change outcome/usage. Keep one-minute retry spacing across restart.

Recover independently of active-run polling at startup and reconcile ticks.
At most ten due records per tick. Guard engine advancement itself so other
ticks/approval paths cannot bypass unreleased responsibility. Advance only after
release; a crash after advancement but before metadata deletion recognises the
durable transition and cannot cause another paid submission. Retire successful
metadata once continuation is durably satisfied. At 30 unresolved days,
atomically fail the workflow with an operator-review diagnostic preserving the
original gateway identity and completed stage output/usage; retire retry metadata
and never replay the completed stage automatically.

For Composer-backed generic run SSE, serve the existing envelope from durable
local state; never open the competing upstream reader. Keep authentication,
quiet-stream revocation checks, request cancellation and terminal output/error.
Normal Composer UI snapshot SSE, mission/chat streams and URLs are unchanged.

Independent controls: >10 sequential completions, ten active requests still429,
transaction rollback/immutable receipt, persistence before drain, URL mismatch
with zero fetch, timeout/quiet cancellation/restart recovery, concurrent owner
exclusion, ten-record/minute bounds, continuation crash recovery, 30-day
retirement and no upstream reader from generic Composer SSE. Test database
failures without claiming a grant or advancement. No paid providers or operator
data. Behaviour is preferred; absent module must produce matcher red, not a
module-loader/infrastructure failure. Existing suites retain all identities.

Coordinator owns source/metadata; Faraday owns only the named new queue oracle.
Franklin remains read-only until the oracle freezes and writing claims change.
At most two writers. Gate, causal sweep, independent R3 review and every required
exact-head hosted job remain required before T0194 closes.
