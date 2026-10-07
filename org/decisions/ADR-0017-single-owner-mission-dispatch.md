---
summary: One durable owner for unattended mission dispatch and uncertain submission outcomes
type: decision
tags: [missions, dispatch]
status: accepted
accepted: 2026-09-29
---

# ADR-0017: one owner for unattended mission dispatch

**Status:** Accepted by the operator on 2026-09-29 for T-0183.

## Context

Two queue ticks could read the same queued mission and submit under different
run IDs before either wrote `dispatched`. A cron tick could cross the same
gap. Cancellation wrote a terminal local decision, but a later gateway
acknowledgement or rejection could overwrite it. The independently authored
seven-case oracle was red for these behaviours at `4eddd81b`.

## Decision

1. Queue and cron dispatch take a synchronous SQLite transaction before
   network I/O. It checks the existing one-mission single-flight rule,
   claims the mission, inserts one durable run ID and clears the queue flag.
   A losing tick creates no session and makes no gateway request. The run ID
   is the gateway `Idempotency-Key`; the cron occurrence ID stays stable.
2. The operator's spend stop remains before the claim. A blocked tick leaves
   the mission or occurrence due. Attended dispatch keeps its current spend
   policy and public response shape.
3. The gateway acknowledgement updates a run and mission only if the same
   claim is still active. Cancellation makes both terminal. A late success
   does not record a dispatch event and asks the gateway to stop the returned
   backend ID. A late rejection cannot replace the cancellation reason.
4. If PatterStage restarts with a claimed run but no recorded backend ID,
   the outcome is **unconfirmed**. Keep it visible for operator review and
   block automatic replay, including replay under a new key. Do not state
   that the gateway never accepted it. Use existing persisted fields and a
   distinct visible message, with no schema or route removal. The operator
   can inspect the gateway and then use existing manual controls. Without a
   backend ID, PatterStage cannot guarantee remote cancellation.
5. Once a backend ID is known, the existing elapsed run deadlines and
   five-minute 404 grace apply unchanged. An unconfirmed no-ID claim is not
   falsely failed by the normal reconciler's missing-ID branch. No new
   inactivity timer is introduced.

## Consequences and proof

The local database and fake-gateway oracle can prove one PatterStage
submission attempt and local cancellation finality. It cannot prove that
the external gateway retained an idempotency key, charged once or stopped
an unknown-ID run. Recovery therefore favours an explicit review hold over
an automatic paid retry. The red-first concurrent oracle, existing
deadline/grace suites, full gate, visual state, mutation sweep and hosted
acceptance are the T-0183 proofs. Rollback requires an equivalent durable
claim and conditional acknowledgement; simply reverting to the earlier
path would reopen the measured race.
