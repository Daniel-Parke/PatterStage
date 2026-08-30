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

One record per task. The contract is
kernel/schemas/task-record.schema.json in the EOS checkout at the commit
this venture pins, but nothing in this repository runs it: the only tool
that reads `org/tasks/` is `check-derived-views.mjs`, which compares the
fields org/TASKS.md shows and validates no others. Treat the schema as
binding by convention. Forty lines is the budget; the shape:

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
rules tier_ruled with reasons. All eleven keys above are required. The
schema allows four more and no others: `oracle_provenance`, which
high-assurance owes; `hypothesis_ledger`, once the circuit breaker is in
play; `resume`, while status is interrupted; and `verdicts`.

Neither diagnosis nor interruption is a mode. `org/policy.json` names
the five modes (express, standard, exploration, high-assurance,
parallel), interrupted is one of the statuses, and that file, not this
one, says what a mode owes. High-assurance owes four artefacts there:
the task record, oracle-provenance, a rollback plan and a review
verdict.

Read a few recent records before writing one, because the set has
drifted past the schema and nothing catches it. `invariants`,
`rollback`, `verification` and `deferred` are common on standard-mode
records, most of the high-assurance records carry no
`oracle_provenance` at all, and one-off narrative keys are frequent.
Where the schema and the corpus disagree, say on the record which you
followed rather than settling the question silently.

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
org/claims.json (the EOS checkout's kernel/schemas/claims.schema.json,
at the commit this venture pins) and committed to
the integration branch. Each lane's task record carries its claim
copy. At merge the integrator verifies the actual diff against the
assigned claims and regenerates the derived views.

## Short-form ADR · org/decisions/ADR-####-<slug>.md

```markdown
---
summary: one line stating the decision, not the topic
type: decision
tags: [process]
status: proposed|accepted|superseded
compiled_from: authored
---

# ADR-#### · Title

**Status:** ACCEPTED by the operator, <date>, <how approval was given>.
A superseded record names the superseding ADR here instead.
**Date:** <date>

## Context
## Decision
## Consequences
```

That is the shape every record in `org/decisions/` uses, and the
identity keys live in the filename and the H1 rather than the
front-matter. `org/decisions/` is the home, ruled by ADR-0008 over the
earlier ADR-0007's proposal; `docs/adr/README.md` stays as the public
pointer to it.

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
