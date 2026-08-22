---
summary: PatterStage canonical artefact shapes, task records, spikes, ADRs, questions, incidents
type: venture
tags: [eos]
compiled_from: kernel/templates/org/TEMPLATES.tpl.md
---

# Templates · Canonical artefact shapes

Copy exactly; keys are contracts the tooling and future sessions rely
on. Machine records are JSON written via write-temp-then-rename;
dates are ISO. The task tooling allocates ids.

## Task record · org/tasks/T-####.json

One record per task, validated by
kernel/schemas/task-record.schema.json at the pinned EOS commit.
Forty lines is the budget; the shape:

```json
{
  "id": "T-0001",
  "intent": "one or two sentences on what this task is for",
  "declared": {
    "capabilities": ["network"],
    "side_effects": ["sends-external"]
  },
  "mode": "standard",
  "tier_proposed": "R1",
  "tier_ruled": "R1",
  "reasons": [
    {"factor": "boundary-contact", "tier_floor": "R1",
     "source": "declared", "evidence": "sends-external declared"}
  ],
  "status": "active",
  "owner_session": "S-0000",
  "claims": ["src/notify/"],
  "timestamps": {"opened": "2026-01-01T09:00", "updated": "2026-01-01T09:00"}
}
```

The agent proposes the declared facts and tier_proposed; the router
rules tier_ruled with reasons. High-assurance adds
oracle_provenance; diagnosis adds the hypothesis ledger;
interruption adds resume.

## Resume keys (only while status is interrupted)

Seven keys inside the task record: eos_pin, phase, last_verified,
next_action, blockers, constraints, files_in_flight. A fresh session
must be able to continue from these plus the files they name, alone.
Finished work never writes them.

## Hypothesis ledger row (the circuit breaker)

`{"hypothesis": .., "test": .., "result": .., "learning": ..}`. Three
materially distinct falsified rows with no reduction in uncertainty
stop the line. Express converts to Standard before the first row is
written, so every ledger has a task record.

## Spike note (Exploration entry)

On the task record at entry: the question, the timebox, the budget,
and the exit rule, discard or harden. The branch is spike/T-####, and
it never merges. Harden by opening a fresh task through
the router; the spike's code arrives as material, never as merged
history.

## Parallel plan (integrator only)

Before dispatch: lanes with disjoint path claims written to
org/claims.json (kernel/schemas/claims.schema.json) and committed to
the integration branch. Each lane's task record carries its claim
copy. At merge the integrator verifies the actual diff against the
assigned claims and regenerates the derived views.

## Short-form ADR · org/decisions/ADR-####-<slug>.md

```markdown
---
id: ADR-0000
title:
status: proposed|accepted|superseded
supersedes: null
superseded_by: null
created:
approved_by: null
---
## Context
## Decision
## Consequences
```

Durable-band decisions get one before merge; protected-set changes
need the operator's approval recorded in it. Accepted ADRs are
immutable; reversal is a new superseding ADR.

## Question (an org/QUESTIONS.md entry)

`Q-### (domain): the question, the context link, the owner.` One
decision per entry. Where a guard verdict raised it, name the verdict
(require-approval or manual-only) so the operator knows what waits.

## Incident record · org/incidents/INC-YYYYMMDD-<slug>.md

Opened before any containment action, append-only:

```markdown
---
id: INC-YYYYMMDD-slug
approval: operator, per event, harness reference
opened:
time_limit: default four hours; extension re-approved
---
## Containment
The action taken, why it is the smallest reversible one, and the
rollback path.
## Gates bypassed
Each recorded as bypassed, never as passing.
## Retrospective oracle
Authored after containment by a non-implementer session; reference
and validation status. Closure is blocked until this is green.
## Post-incident review
The follow-up task record id.
```
